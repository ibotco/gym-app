import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, X, Printer, Download, FileStack, Save, Search, RotateCcw } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea, DatePicker, Select, Badge } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { ProjectField, useProjectModule } from '../../../components/ProjectField'
import { FundField, useFundAccounting } from '../../../components/FundField'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, voucherTotal, SEARCH_TYPES } from '../../../lib/accounting'
import { addRecurringInterval } from '../../../lib/accounting'
import { AccountSelect, ApprovalStatusField, useVoucherApprovalRequirement, VoucherStatusBadge, CurrencySelect, ConversionRateField, useConversionRate, StakeholderSelect, useStakeholderClassOptions, printTable, journalVoucherHtml, printJournalVoucher, printVoucherBatch, QuickAddStakeholder } from './common'
import { AttachmentChips, AttachmentField, normaliseAttachments } from './AttachmentField'
import { costCenterOnLineItems } from '../../../lib/costCenters'
import { CostCenterSelect, costCenterName } from '../../../components/CostCenterSelect'
import { queueVoucherForApproval, shouldPostVoucherWithoutApproval } from '../../../lib/approvalSubmission'
import { loadPendingApprovals } from '../../../lib/approvalQueue'
import type { JournalVoucher, JournalLine, JournalTemplate, AttachmentFile } from '../../../types'

type Line = { accountId: string; debit: string; credit: string; costCenterId?: string }
type Form = { id?: string; number: string; date: string; description: string; lines: Line[]; currency: string; conversionRate: string; stakeholderClass: string; stakeholder: string; recurring: string; recurringEvery: string; recurringPeriod: 'days' | 'weeks' | 'months' | 'years'; totalCycles: string; notes: string; attachments: AttachmentFile[]; templateId: string; projectId: string; fundId: string }

/** Income-style inclusive date presets for the Journal Entry register filters. */
function rangeFor(type: string): { start: string; end: string } {
  const now = new Date()
  const d = (date: Date) => date.toISOString().slice(0, 10)
  if (type === 'today') {
    const today = d(now)
    return { start: today, end: today }
  }
  if (type === 'this_week') {
    const day = now.getDay() || 7
    const start = new Date(now); start.setDate(now.getDate() - day + 1)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { start: d(start), end: d(end) }
  }
  if (type === 'this_month') {
    return { start: d(new Date(now.getFullYear(), now.getMonth(), 1)), end: d(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  }
  if (type === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    return { start: d(new Date(now.getFullYear(), quarter * 3, 1)), end: d(new Date(now.getFullYear(), quarter * 3 + 3, 0)) }
  }
  if (type === 'this_year') {
    return { start: d(new Date(now.getFullYear(), 0, 1)), end: d(new Date(now.getFullYear(), 11, 31)) }
  }
  if (type === 'last_year') {
    return { start: d(new Date(now.getFullYear() - 1, 0, 1)), end: d(new Date(now.getFullYear() - 1, 11, 31)) }
  }
  return { start: '', end: '' }
}

function JournalViewModal({
  viewing,
  accounts,
  companyName,
  costCenterEnabled,
  costCenters,
  onClose,
  onPrint,
}: {
  viewing: JournalVoucher | null
  accounts: ReturnType<typeof useApp>['accounts']
  companyName: string
  costCenterEnabled: boolean
  costCenters: ReturnType<typeof useApp>['costCenters']
  onClose: () => void
  onPrint: (j: JournalVoucher) => void
}) {
  if (!viewing) return null
  const totalDebit = viewing.lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = viewing.lines.reduce((s, l) => s + (l.credit || 0), 0)
  return (
    <Modal open={!!viewing} onClose={onClose} title={viewing.number || 'Journal Entry'} wide>
      <div className="space-y-3">
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-bold">{companyName}</p>
              <p className="text-xs text-zinc-500">{viewing.description}</p>
              <p className="font-mono text-xs text-zinc-500">{viewing.number}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatDate(viewing.date)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase tracking-wide text-sky-600">Journal Entry</p>
              <VoucherStatusBadge status={viewing.status} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {[
              ['Currency', viewing.currency || 'GHS'],
              ['Stakeholder class', viewing.stakeholderClass || '—'],
              ['Stakeholder', viewing.stakeholder || '—'],
              ['Recurring', viewing.recurring && viewing.recurring !== 'no' ? (viewing.recurring === 'custom' ? `Every ${viewing.recurringEvery} ${viewing.recurringPeriod}` : `Every ${viewing.recurring} month(s)`) : 'No'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-zinc-100 py-1.5">
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">{k}</span>
                <span className="text-right text-xs font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  {costCenterEnabled && <th className="px-3 py-2 text-left">Cost center</th>}
                </tr>
              </thead>
              <tbody>
                {viewing.lines.map((l, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{accountName(accounts, l.accountId)}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.debit ? formatGhsExact(l.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.credit ? formatGhsExact(l.credit) : '—'}</td>
                    {costCenterEnabled && <td className="px-3 py-2">{costCenterName(costCenters, l.costCenterId)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50/60">
                  <td colSpan={costCenterEnabled ? 3 : 2} className="px-3 py-2 text-right font-bold uppercase tracking-wider text-zinc-500">Total</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-sky-600">{formatGhsExact(totalDebit)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-sky-600">{formatGhsExact(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {viewing.notes && <p className="mt-3 text-xs text-zinc-600"><strong>Notes:</strong> {viewing.notes}</p>}
          {(() => {
            const files = normaliseAttachments(viewing)
            if (!files.length) return null
            return (
              <div className="mt-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Attachments</p>
                <AttachmentChips files={files} readOnly />
              </div>
            )
          })()}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onPrint(viewing)}><Printer className="size-4" /> Print</Button>
          <Button variant="outline" className="flex-1" onClick={() => onPrint(viewing)}><Download className="size-4" /> Download PDF</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

export function JournalVoucherPage() {
  const app = useApp()
  const { journals, accounts, users, company, activeBranch, systemSettings, costCenters, upsertJournal, deleteJournal, journalTemplates, upsertJournalTemplate, deleteJournalTemplate, log, projects, funds } = app
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const projOn = useProjectModule()
  const fundOn = useFundAccounting()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const showCostCenter = costCenterOnLineItems(company)
  const lineGridCls = showCostCenter
    ? 'grid grid-cols-12 gap-x-2 gap-y-4 md:gap-2 md:grid-cols-[minmax(0,1fr)_100px_100px_130px_36px]'
    : 'grid grid-cols-12 gap-x-2 gap-y-4 md:gap-2 md:grid-cols-[minmax(0,1fr)_100px_100px_36px]'
  const { base: baseCode, rateFor } = useConversionRate()
  const stakeholderClassOptions = useStakeholderClassOptions()

  const initialRange = rangeFor('this_month')
  const [searchType, setSearchType] = useState('this_month')
  const [start, setStart] = useState(initialRange.start)
  const [end, setEnd] = useState(initialRange.end)
  const [filterStakeholder, setFilterStakeholder] = useState('')
  const [voucherQ, setVoucherQ] = useState('')
  const [applied, setApplied] = useState({ start: initialRange.start, end: initialRange.end, stakeholder: '', q: '' })
  const [editing, setEditing] = useState<Form | null>(null)
  const [viewing, setViewing] = useState<JournalVoucher | null>(null)
  const [deleting, setDeleting] = useState<JournalVoucher | null>(null)
  const [expandedJournalIds, setExpandedJournalIds] = useState<Set<string>>(() => new Set())

  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name || id : '—')

  const rows = useMemo(() => {
    const ql = applied.q.trim().toLowerCase()
    return [...journals]
      .filter((j) => {
        if (applied.start && j.date < applied.start) return false
        if (applied.end && j.date > applied.end) return false
        if (applied.stakeholder && j.stakeholderClass !== applied.stakeholder) return false
        if (ql && !`${j.number} ${j.description}`.toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [journals, applied])

  const onSearchType = (type: string) => {
    setSearchType(type)
    if (type === 'custom') return
    const range = rangeFor(type)
    setStart(range.start)
    setEnd(range.end)
  }
  const doSearch = () => setApplied({ start, end, stakeholder: filterStakeholder, q: voucherQ.trim() })
  const doReset = () => {
    const range = rangeFor('this_month')
    setSearchType('this_month')
    setStart(range.start); setEnd(range.end)
    setFilterStakeholder(''); setVoucherQ('')
    setApplied({ start: range.start, end: range.end, stakeholder: '', q: '' })
  }
  const showAll = () => {
    setSearchType('custom')
    setStart(''); setEnd('')
    setFilterStakeholder(''); setVoucherQ('')
    setApplied({ start: '', end: '', stakeholder: '', q: '' })
  }

  // Row selection — same pattern as the Chart of Accounts list.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const allSelected = rows.length > 0 && rows.every((j) => selected.has(j.id))
  const toggleOne = (id: string) => {
    setShowBulk(false) // selecting rows only ENABLES Bulk Actions — the menu opens on click
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleAll = () => {
    setShowBulk(false)
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) rows.forEach((j) => n.delete(j.id))
      else rows.forEach((j) => n.add(j.id))
      return n
    })
  }
  const setStatusBulk = (status: 'posted' | 'draft') => {
    const selectedJournals = journals.filter((journal) => selected.has(journal.id) && journal.status !== status)
    let savedAsDraft = 0
    let queued = 0
    let failed = 0
    selectedJournals.forEach((journal) => {
      const updated: JournalVoucher = { ...journal, status: 'draft' }
      if (status === 'draft') {
        upsertJournal(updated)
        savedAsDraft += 1
        return
      }
      const approval = queueVoucherForApproval({
        companyId,
        branchId: journal.branchId ?? activeBranch?.id ?? app.activeBranchId ?? '',
        menuId: 5,
        documentType: 'JOURNAL',
        documentNo: updated.number,
        date: updated.date,
        createdBy: users.find((item) => item.id === updated.createdBy)?.name || user?.name || 'Current User',
        party: updated.description,
        amount: voucherTotal(updated),
        submission: { kind: 'journal', record: updated },
      })
      if (approval.status === 'storage-error') failed += 1
      else if (approval.status === 'queued') queued += 1
      else { upsertJournal(updated); savedAsDraft += 1 }
    })
    if (savedAsDraft) toast.success(`${savedAsDraft} journal voucher(s) saved as Draft${status === 'posted' ? ' because no active approval step matched' : ''}.`)
    if (queued) toast.update(`${queued} journal voucher(s) submitted for approval; they will be Posted only after final approval.`)
    if (failed) toast.error(`${failed} journal approval request(s) could not be stored.`)
    setSelected(new Set()); setShowBulk(false)
  }
  const deleteBulk = () => {
    journals.filter((j) => selected.has(j.id)).forEach((j) => deleteJournal(j.id))
    toast.success(`${selected.size} entr${selected.size > 1 ? 'ies' : 'y'} deleted`)
    setSelected(new Set()); setShowBulk(false)
  }
  const buildJournalOpts = (j: JournalVoucher) => ({
    number: j.number,
    date: j.date,
    description: j.description,
    amount: voucherTotal(j),
    lines: j.lines.map((l) => ({ account: accountName(accounts, l.accountId), debit: l.debit || 0, credit: l.credit || 0 })),
    orgLine1: company.legalName || company.name,
    orgLine2: activeBranch?.name,
    tel: company.phone,
    email: company.email,
    digitalAddress: company.digitalAddress,
    website: company.webAddress,
    logo: company.logoImage,
    issuedBy: users.find((u) => u.id === j.createdBy)?.name || user?.name || '',
    footerText: `© ${new Date().getFullYear()} ${systemSettings.appName}. | Phone : ${company.phone} | All Rights Reserved.`,
    notes: j.notes,
    currencyLabel: j.currency || 'GHS',
  })
  const printVoucher = (j: JournalVoucher) => printJournalVoucher(buildJournalOpts(j))

  const printBulkVouchers = () => {
    const sel = rows.filter((j) => selected.has(j.id))
    if (!sel.length) return
    printVoucherBatch(`Journal Vouchers (${sel.length})`, sel.map(buildJournalOpts).map(journalVoucherHtml))
    setShowBulk(false)
  }

  const printList = () => {
    const sel = rows.filter((j) => selected.has(j.id))
    const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2,'0')
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const label = `Journal Entr${sel.length === 1 ? 'y' : 'ies'}`
    printTable({
      title: 'Journal Entry',
      subtitle: `${company.name} — ${sel.length} ${label.toLowerCase()} — printed ${stamp}`,
      headers: [
        { label: 'Number', mono: true, width: '12%' },
        { label: 'Date', mono: true, width: '11%' },
        { label: 'Description', width: '36%' },
        { label: 'Lines', num: true, width: '7%' },
        { label: 'Debit', num: true, width: '12%' },
        { label: 'Credit', num: true, width: '12%' },
        { label: 'Status', width: '10%' },
      ],
      rows: sel.map((j) => {
        const d = j.lines.reduce((s, l) => s + (l.debit || 0), 0)
        const c = j.lines.reduce((s, l) => s + (l.credit || 0), 0)
        return [j.number, fmt(j.date), j.description, String(j.lines.length), formatGhsExact(d), formatGhsExact(c), j.status]
      }),
      totals: [
        'Total',
        '',
        '',
        String(sel.reduce((s, j) => s + j.lines.length, 0)),
        formatGhsExact(sel.reduce((s, j) => s + j.lines.reduce((x, l) => x + (l.debit || 0), 0), 0)),
        formatGhsExact(sel.reduce((s, j) => s + j.lines.reduce((x, l) => x + (l.credit || 0), 0), 0)),
        '',
      ],
      footer: `Printed on ${stamp} · ${company.name}`,
    })
    setShowBulk(false)
  }

  const columns: Column<JournalVoucher>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = !allSelected && rows.some((j) => selected.has(j.id)) }}
          onChange={toggleAll}
          aria-label="Select all"
        />
      ),
      render: (j) => (
        <input
          type="checkbox"
          checked={selected.has(j.id)}
          onChange={() => toggleOne(j.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${j.number}`}
        />
      ),
    },
    {
      key: 'number', header: 'Number', sortValue: (j) => j.number,
      render: (j) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold">
          {j.number}
          {j.recurring && j.recurring !== 'no' && (
            <Badge tone="lime">{j.recurring === 'custom' ? `Every ${j.recurringEvery} ${j.recurringPeriod}` : `Every ${j.recurring} mo`}</Badge>
          )}
        </span>
      ),
    },
    { key: 'date', header: 'Date', sortValue: (j) => j.date, render: (j) => <span className="text-mist">{formatDate(j.date)}</span> },
    { key: 'desc', header: 'Description', sortValue: (j) => j.description, render: (j) => <span className="font-semibold">{j.description}</span> },
    { key: 'lines', header: 'Lines', sortValue: (j) => j.lines.length, align: 'center', render: (j) => j.lines.length },
    { key: 'amount', header: 'Amount', sortValue: (j) => voucherTotal(j), align: 'right', render: (j) => <span className="font-semibold">{formatGhs(voucherTotal(j))}</span> },
    { key: 'status', header: 'Status', sortValue: (j) => j.status, render: (j) => <VoucherStatusBadge status={j.status} /> },
    ...(projOn ? [{ key: 'project', header: 'Project', sortValue: (x: JournalVoucher) => x.projectName || '', render: (x: JournalVoucher) => <span className="text-mist">{x.projectName || '—'}</span> }] : []),
    ...(fundOn ? [{ key: 'fund', header: 'Fund', sortValue: (x: JournalVoucher) => x.fundName || '', render: (x: JournalVoucher) => <span className="text-mist">{x.fundName || '—'}</span> }] : []),
    {
      key: 'actions', header: 'ACTIONS',
      render: (j) => (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="View" onClick={() => setViewing(j)}><Eye className="size-4" /></button>
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(j)}><Pencil className="size-4" /></button>}
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Print" onClick={() => printVoucher(j)}><Printer className="size-4" /></button>
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(j)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const renderJournalDetails = (j: JournalVoucher) => {
    const recurring = j.recurring && j.recurring !== 'no'
      ? j.recurring === 'custom'
        ? `Every ${j.recurringEvery || 1} ${j.recurringPeriod || 'months'}`
        : `Every ${j.recurring} month${j.recurring === '1' ? '' : 's'}`
      : 'No'
    const fields: { label: string; value: string }[] = [
      { label: 'Currency', value: j.currency || 'GHS' },
      { label: 'Exchange rate', value: j.conversionRate ? String(j.conversionRate) : '—' },
      { label: 'Stakeholder class', value: stakeholderClassOptions.find((option) => option.id === j.stakeholderClass)?.label || j.stakeholderClass || '—' },
      { label: 'Stakeholder', value: j.stakeholder || '—' },
      { label: 'Recurring', value: recurring },
      { label: 'Created by', value: userName(j.createdBy) },
      ...(projOn ? [{ label: 'Project', value: j.projectName || '—' }] : []),
      ...(fundOn ? [{ label: 'Fund', value: j.fundName || '—' }] : []),
      ...(j.notes ? [{ label: 'Notes', value: j.notes }] : []),
    ]
    const lines = j.lines || []
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
    return (
      <div className="space-y-3 px-4 py-3 sm:px-6">
        <div className="grid gap-x-4 gap-y-2 rounded-lg border border-line bg-black/[0.02] p-3 text-xs dark:bg-white/[0.02] sm:grid-cols-2 xl:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist">{field.label}</p>
              <p className="mt-0.5 break-words font-semibold">{field.value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-black/[0.03] text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.04]">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Account code</th>
                  <th className="px-3 py-2 text-left">Account name</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  {showCostCenter && <th className="px-3 py-2 text-left">Cost center</th>}
                </tr>
              </thead>
              <tbody>
                {lines.length ? lines.map((line, index) => {
                  const account = accounts.find((item) => item.id === line.accountId)
                  return (
                    <tr key={`${j.id}-line-${index}`} className="border-t border-line/60">
                      <td className="px-3 py-2 text-mist">{index + 1}</td>
                      <td className="px-3 py-2 font-mono">{account?.code || '—'}</td>
                      <td className="px-3 py-2 font-semibold">{accountName(accounts, line.accountId)}</td>
                      <td className="px-3 py-2 text-right font-mono">{line.debit ? formatGhsExact(line.debit) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{line.credit ? formatGhsExact(line.credit) : '—'}</td>
                      {showCostCenter && <td className="px-3 py-2">{costCenterName(costCenters, line.costCenterId)}</td>}
                    </tr>
                  )
                }) : (
                  <tr className="border-t border-line/60">
                    <td colSpan={showCostCenter ? 6 : 5} className="px-3 py-4 text-center text-mist">No journal lines recorded.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-black/[0.02] dark:bg-white/[0.02]">
                  <td colSpan={3} className="px-3 py-2 text-right font-bold uppercase tracking-wider text-mist">Totals</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{formatGhsExact(totalDebit)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{formatGhsExact(totalCredit)}</td>
                  {showCostCenter && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Generate due recurring copies only from posted journals. Each generated
  // copy still passes through the same approval rule and remains Draft until
  // its own approval chain is complete.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    let counter = 0
    for (const j of journals) {
      if (j.status !== 'posted' || !j.recurring || j.recurring === 'no' || !j.nextRecurringDate) continue
      let next = j.nextRecurringDate
      let done = j.cyclesDone || 0
      const limit = j.totalCycles || Infinity
      let generated = 0
      let queued = 0
      let posted = 0
      let drafts = 0
      while (next <= today && done < limit && generated < 36) {
        counter += 1
        const record: JournalVoucher = {
          ...j,
          id: uid('jv'),
          number: `${nextNumber('JV', [...journals, ...loadPendingApprovals(companyId).filter((row) => row.documentType === 'JOURNAL').map((row) => ({ number: row.documentNo }))])}-R${done + 1}${counter > 1 ? `-${counter}` : ''}`,
          date: next,
          status: 'draft',
          recurring: undefined, recurringEvery: undefined, recurringPeriod: undefined,
          totalCycles: undefined, cyclesDone: undefined, nextRecurringDate: undefined,
          notes: `Auto-generated from recurring ${j.number}`,
          createdAt: new Date().toISOString(),
        }
        const approval = queueVoucherForApproval({
          companyId,
          branchId: record.branchId ?? activeBranch?.id ?? app.activeBranchId ?? '',
          menuId: 5,
          documentType: 'JOURNAL',
          documentNo: record.number,
          date: record.date,
          createdBy: users.find((item) => item.id === record.createdBy)?.name || user?.name || 'Current User',
          party: record.stakeholder || record.description,
          amount: voucherTotal(record),
          submission: { kind: 'journal', record },
        })
        if (approval.status === 'storage-error') {
          toast.error('Recurring journal was not saved', 'The approval request could not be stored.')
          break
        }
        if (approval.status === 'queued') queued += 1
        else if (shouldPostVoucherWithoutApproval(approval)) {
          upsertJournal({ ...record, status: 'posted' })
          posted += 1
        } else {
          upsertJournal(record)
          drafts += 1
        }
        done += 1
        generated += 1
        next = j.recurring === 'custom'
          ? addRecurringInterval(next, j.recurringEvery || 1, j.recurringPeriod || 'months')
          : addRecurringInterval(next, Number(j.recurring), 'months')
      }
      if (generated > 0) {
        upsertJournal({ ...j, cyclesDone: done, nextRecurringDate: done >= limit ? undefined : next, recurring: done >= limit ? undefined : j.recurring })
        const outcomes = [
          queued ? `${queued} queued for approval` : '',
          posted ? `${posted} posted` : '',
          drafts ? `${drafts} saved as Draft` : '',
        ].filter(Boolean).join('; ')
        toast.info(`Recurring journal ${j.number}`, `${generated} entr${generated > 1 ? 'ies' : 'y'} created; ${outcomes}.`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const blankForm = (): Form => ({ number: nextNumber('JV', [...journals, ...loadPendingApprovals(companyId).filter((row) => row.documentType === 'JOURNAL').map((row) => ({ number: row.documentNo }))]), date: new Date().toISOString().slice(0, 10), description: '', lines: [{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }], currency: baseCode, conversionRate: '', stakeholderClass: '', stakeholder: '', recurring: 'no', recurringEvery: '1', recurringPeriod: 'months', totalCycles: '', notes: '', attachments: [], templateId: '', projectId: '', fundId: '' })
  const openNew = () => setEditing(blankForm())

  /** Map a saved journal into the edit Form (shared by the list Edit button and
      the ?edit deep-link from the Cash Book voucher view). */
  const openEdit = (j: JournalVoucher) => setEditing({ id: j.id, number: j.number, date: j.date, description: j.description, lines: j.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '', costCenterId: l.costCenterId })), currency: j.currency || baseCode, conversionRate: j.conversionRate ? String(j.conversionRate) : '', stakeholderClass: j.stakeholderClass || '', stakeholder: j.stakeholder || '', recurring: j.recurring || 'no', recurringEvery: j.recurringEvery ? String(j.recurringEvery) : '1', recurringPeriod: j.recurringPeriod || 'months', totalCycles: j.totalCycles ? String(j.totalCycles) : '', notes: j.notes || '', attachments: normaliseAttachments(j), templateId: '', projectId: j.projectId || '', fundId: j.fundId || '' })

  // Deep-link to a source journal: ?edit=<id> opens the editor, while
  // ?view=<id> opens its read-only journal modal (e.g. from Account History).
  const [searchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current) return
    const editId = searchParams.get('edit')
    const viewId = searchParams.get('view')
    const targetId = editId || viewId
    if (!targetId) return
    const j = journals.find((x) => x.id === targetId)
    if (!j) return
    if (editId) openEdit(j)
    else setViewing(j)
    deepLinkHandled.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete(editId ? 'edit' : 'view')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, journals])

  /** Prefill a (blank or in-progress) form from a saved template. */
  const applyTemplateTo = (form: Form, t: JournalTemplate): Form => ({
    ...form,
    templateId: t.id,
    description: form.description || t.description || '',
    lines: t.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '', costCenterId: l.costCenterId })),
    currency: t.currency || baseCode,
    conversionRate: t.currency && t.currency !== baseCode ? String(rateFor(t.currency) ?? '') : '',
    stakeholderClass: t.stakeholderClass || '',
    stakeholder: t.stakeholder || '',
    notes: form.notes || t.notes || '',
  })
  const applyTemplate = (id: string) => {
    const t = journalTemplates.find((x) => x.id === id)
    if (!t || !editing || id === editing.templateId) return
    setEditing(applyTemplateTo(editing, t))
    toast.success('Template applied', `"${t.name}" — ${t.lines.length} line(s) prefilled. Adjust amounts as needed.`)
  }

  const [showTemplates, setShowTemplates] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplModal, setTplModal] = useState(false)
  const useTemplate = (t: JournalTemplate) => {
    setEditing(applyTemplateTo(blankForm(), t))
    setShowTemplates(false)
  }

  /** Working copy of a template being created/edited inside the Templates modal. */
  const [tplForm, setTplForm] = useState<{ id?: string; name: string; description: string; lines: Line[] } | null>(null)
  const openTplForm = (t?: JournalTemplate) => {
    setTplForm(t
      ? { id: t.id, name: t.name, description: t.description || '', lines: t.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '', costCenterId: l.costCenterId })) }
      : { name: '', description: '', lines: [{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }] })
  }
  const setTplLine = (i: number, patch: Partial<Line>) => setTplForm((f) => f && ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }))
  const addTplLine = () => setTplForm((f) => f ? { ...f, lines: [...f.lines, { accountId: '', debit: '', credit: '' }] } : f)
  const tplDebit = tplForm ? tplForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0
  const tplCredit = tplForm ? tplForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) : 0
  const tplBalanced = Math.abs(tplDebit - tplCredit) < 0.005 && tplDebit > 0
  const saveTplForm = () => {
    if (!tplForm) return
    const name = tplForm.name.trim()
    if (!name) { toast.error('Name the template.'); return }
    if (journalTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== tplForm.id)) { toast.error('A template with this name already exists.', 'Use a different name to keep the list readable.'); return }
    const lines: JournalLine[] = tplForm.lines
      .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, costCenterId: l.costCenterId || undefined }))
      .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0))
    if (lines.length < 2) { toast.error('Add at least two lines (a debit and a credit).'); return }
    if (Math.abs(tplDebit - tplCredit) >= 0.005) { toast.error('Debits and credits must balance.'); return }
    const existing = tplForm.id ? journalTemplates.find((t) => t.id === tplForm.id) : undefined
    upsertJournalTemplate({
      id: tplForm.id || uid('jtpl'),
      name,
      description: tplForm.description.trim() || undefined,
      lines,
      companyId: existing?.companyId,
      createdBy: existing?.createdBy || user?.id,
      createdAt: existing?.createdAt || new Date().toISOString(),
    })
    log(user?.id || 'system', tplForm.id ? 'UPDATE' : 'CREATE', 'JournalTemplate', `${tplForm.id ? 'Updated' : 'Saved'} template "${name}"`)
    toast.success(tplForm.id ? 'Template updated' : 'Template saved', `"${name}" is available in the Template select.`)
    setTplForm(null)
  }

  const setLine = (i: number, patch: Partial<Line>) => setEditing((e) => e && ({ ...e, lines: e.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }))
  const addLine = () => setEditing((e) => e ? { ...e, lines: [...e.lines, { accountId: '', debit: '', credit: '' }] } : e)

  const totalDebit = editing ? editing.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0
  const totalCredit = editing ? editing.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) : 0
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff < 0.005 && totalDebit > 0
  const approvalRequired = useVoucherApprovalRequirement({
    companyId, branchId: activeBranch?.id || app.activeBranchId || '', menuId: 5, documentType: 'JOURNAL', amount: totalDebit,
  })

  const save = () => {
    if (!editing) return
    if (!editing.description.trim()) { toast.error('Enter a description.'); return }
    if (editing.currency !== baseCode && !(Number(editing.conversionRate) > 0)) { toast.error('Enter a conversion rate.', `Required for non-base currency ${editing.currency}.`); return }
    if (editing.recurring === 'custom' && !(Number(editing.recurringEvery) > 0)) { toast.error('Enter how often the entry repeats.'); return }
    const lines: JournalLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, costCenterId: l.costCenterId || undefined }))
      .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0))
    if (lines.length < 2) { toast.error('Add at least two lines (a debit and a credit).'); return }
    const d = lines.reduce((s, l) => s + l.debit, 0)
    const c = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(d - c) >= 0.005) { toast.error('Debits and credits must balance.'); return }

    const existing = editing.id ? journals.find((j) => j.id === editing.id) : undefined
    const isNew = !editing.id
    const record: JournalVoucher = {
      id: editing.id || uid('jv'),
      companyId,
      branchId: activeBranch?.id || app.activeBranchId || '',
      number: editing.number.trim(),
      date: editing.date,
      description: editing.description.trim(),
      lines,
      status: 'draft',
      currency: editing.currency || undefined,
      conversionRate: editing.currency !== baseCode && Number(editing.conversionRate) > 0 ? Number(editing.conversionRate) : undefined,
      stakeholderClass: editing.stakeholderClass || undefined,
      stakeholder: editing.stakeholderClass ? (editing.stakeholder || undefined) : undefined,
      projectId: editing.projectId || undefined,
      projectName: projects.find((pr) => pr.id === editing.projectId)?.name || undefined,
      fundId: editing.fundId || undefined,
      fundName: funds.find((fd) => fd.id === editing.fundId)?.name || undefined,
      recurring: editing.recurring !== 'no' ? editing.recurring : undefined,
      recurringEvery: editing.recurring === 'custom' ? Math.max(1, Number(editing.recurringEvery) || 1) : undefined,
      recurringPeriod: editing.recurring === 'custom' ? editing.recurringPeriod : undefined,
      totalCycles: editing.recurring !== 'no' && Number(editing.totalCycles) > 0 ? Number(editing.totalCycles) : undefined,
      cyclesDone: existing?.cyclesDone,
      nextRecurringDate: editing.recurring !== 'no'
        ? (editing.recurring === 'custom'
            ? addRecurringInterval(editing.date, Math.max(1, Number(editing.recurringEvery) || 1), editing.recurringPeriod)
            : addRecurringInterval(editing.date, Number(editing.recurring), 'months'))
        : undefined,
      notes: editing.notes.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      attachmentName: editing.attachments[0]?.name || undefined,
      createdBy: isNew ? user?.id : (existing?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (existing?.createdAt || new Date().toISOString()),
    }
    const approval = queueVoucherForApproval({
      companyId,
      branchId: record.branchId ?? activeBranch?.id ?? app.activeBranchId ?? '',
      menuId: 5,
      documentType: 'JOURNAL',
      documentNo: record.number,
      date: record.date,
      createdBy: users.find((item) => item.id === record.createdBy)?.name || user?.name || 'Current User',
      party: record.stakeholder || record.description,
      amount: d,
      submission: { kind: 'journal', record },
    })
    if (approval.status === 'storage-error') {
      toast.error('Journal entry was not saved', 'The approval request could not be stored. Free up browser storage and try again.')
      return
    }
    if (approval.status === 'queued') {
      // Keep the voucher visible in the Journal list as Draft while the separate
      // browser-local approval request advances through its configured steps.
      // Final approval will update this same journal to Posted.
      upsertJournal(record)
      log(user?.id || 'system', approval.replaced ? 'RESUBMIT' : 'SUBMIT', 'JournalVoucherApproval', `${record.number} — ${formatGhs(d)} · ${approval.row.workflowId}`)
      const firstApprovalStep = approval.row.approvalSteps?.find((step) => step.id === approval.row.currentStepId)
        || approval.row.approvalSteps?.[0]
      const firstApprover = firstApprovalStep
        ? app.roles.find((role) => String(role.id) === String(firstApprovalStep.roleId))?.name || String(firstApprovalStep.roleId)
        : 'configured approver'
      const branchName = activeBranch?.name || record.branchId || 'the active branch'
      toast.success(
        approval.replaced ? 'Journal approval request updated' : 'Journal entry saved as Draft and submitted for approval',
        `${record.number} · First approval: ${firstApprover} · ${branchName}.`,
      )
      setEditing(null)
      return
    }
    const postWithoutApproval = shouldPostVoucherWithoutApproval(approval)
    const savedRecord = postWithoutApproval ? { ...record, status: 'posted' as const } : record
    upsertJournal(savedRecord)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'JournalVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(d)}${postWithoutApproval ? ' · Posted' : ''}`)
    toast.success(
      postWithoutApproval ? isNew ? 'Journal entry saved and posted' : 'Journal entry updated and posted' : isNew ? 'Journal entry saved as Draft' : 'Journal entry updated as Draft',
      postWithoutApproval ? `${editing.number} was posted directly because no approval requirement matched this voucher.` : undefined,
    )
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteJournal(deleting.id)
    log(user?.id || 'system', 'DELETE', 'JournalVoucher', `Deleted ${deleting.number}`)
    toast.success('Journal entry deleted')
    setDeleting(null)
  }

  /** Persist the current form (lines + description) as a reusable template. */
  const doSaveTemplate = () => {
    if (!editing) return
    const name = tplName.trim()
    if (!name) { toast.error('Name the template.'); return }
    if (journalTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) { toast.error('A template with this name already exists.', 'Use a different name to keep the list readable.'); return }
    const lines: JournalLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, costCenterId: l.costCenterId || undefined }))
      .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0))
    if (lines.length < 2) { toast.error('Add at least two lines with amounts first.', 'A template needs a complete set of lines to be useful.'); return }
    const d = lines.reduce((s, l) => s + l.debit, 0)
    const c = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(d - c) >= 0.005) { toast.error('Debits and credits must balance before saving a template.'); return }
    upsertJournalTemplate({
      id: uid('jtpl'),
      name,
      description: editing.description.trim() || name,
      lines,
      currency: editing.currency && editing.currency !== baseCode ? editing.currency : undefined,
      stakeholderClass: editing.stakeholderClass || undefined,
      stakeholder: editing.stakeholder || undefined,
      notes: editing.notes.trim() || undefined,
      createdBy: user?.id,
      createdAt: new Date().toISOString(),
    })
    log(user?.id || 'system', 'CREATE', 'JournalTemplate', `Saved template "${name}"`)
    toast.success('Template saved', `"${name}" is now available in the Template select.`)
    setTplModal(false)
    setTplName('')
  }

  const exportRows = rows.map((j) => ({ number: j.number, date: j.date, description: j.description, amount: voucherTotal(j), lines: j.lines.length, status: j.status }))

  return (
    <div>
      <PageHeader
        title="Journal Entry"
        desc="Manual double-entry journals with balancing debits and credits."
        actions={
          <>
            <ExportButtons filename="journal-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && <Button variant="outline" onClick={() => setShowTemplates(true)}><FileStack className="size-4" /> Templates{journalTemplates.length ? ` (${journalTemplates.length})` : ''}</Button>}
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New Journal Entry</Button>}
          </>
        }
      />
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Search Type</label>
            <Select value={searchType} onChange={(e) => onSearchType(e.target.value)}>
              {SEARCH_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Start Date</label>
            <DatePicker value={start} onChange={setStart} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">End Date</label>
            <DatePicker value={end} onChange={setEnd} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Stakeholder Class</label>
            <Select value={filterStakeholder} onChange={(e) => setFilterStakeholder(e.target.value)}>
              <option value="">All Stakeholders</option>
              {stakeholderClassOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Voucher Number</label>
            <Input value={voucherQ} onChange={(e) => setVoucherQ(e.target.value)} placeholder="Search number or description" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </div>
          <div className="flex items-end gap-2">
            <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={doSearch}><Search className="size-4" /> Search</Button>
            <Button variant="outline" onClick={doReset} title="Reset filters"><RotateCcw className="size-4" /></Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-semibold">Journal Entries <span className="ml-1 text-xs font-normal text-mist">({rows.length} records)</span></p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={showAll}>Show all</Button>
            {canManage && (
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setShowBulk((v) => !v)} disabled={!selected.size}>
                Bulk Actions{selected.size ? ` (${selected.size})` : ''}
              </Button>
              {showBulk && selected.size > 0 && (
                <div className="menu-pop absolute right-0 top-full z-30 mt-1 w-44 rounded-xl p-1.5">
                  <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('posted')}>Mark Posted</button>
                  <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('draft')}>Mark Draft</button>
                  <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={printBulkVouchers}><Printer className="size-4" /> Print</button>
                  <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={printList}><Printer className="size-4" /> Print List</button>
                  <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember" onClick={deleteBulk}><Trash2 className="size-4" /> Delete</button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(j) => j.id}
          emptyTitle="No journal entries"
          emptyDesc="Create your first entry with the New Journal Entry button."
          expandable={{
            isExpanded: (j) => expandedJournalIds.has(j.id),
            onToggle: (j) => setExpandedJournalIds((current) => {
              const next = new Set(current)
              if (next.has(j.id)) next.delete(j.id)
              else next.add(j.id)
              return next
            }),
            label: (j) => j.number,
            render: renderJournalDetails,
          }}
        />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Journal Entry' : 'New Journal Entry'} xl>
        {editing && (
          <div className="space-y-3">
            {journalTemplates.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Template">
                  <Select value={editing.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="">— Start from a template (optional) —</option>
                    {journalTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.lines.length} lines</option>)}
                  </Select>
                </Field>
                <p className="self-end pb-2 text-xs text-mist">Pick a template to prefill the lines — then adjust dates and amounts. Save your own with <span className="font-semibold">Save as template</span> below.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Voucher number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" /></Field>
              <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Currency" required><CurrencySelect value={editing.currency} onChange={(code) => setEditing({ ...editing, currency: code, conversionRate: code === baseCode ? '' : String(rateFor(code) ?? '') })} /></Field>
              <ConversionRateField currency={editing.currency} value={editing.conversionRate} onChange={(v) => setEditing({ ...editing, conversionRate: v })} />
              <ApprovalStatusField visible={approvalRequired} />
            </div>
            <Field label="Description" required><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectField value={editing.projectId} onChange={(pid) => setEditing({ ...editing, projectId: pid })} />
              <FundField value={editing.fundId} onChange={(fid) => setEditing({ ...editing, fundId: fid })} />
              <Field label="Stakeholder Class">
                <Select value={editing.stakeholderClass} onChange={(e) => setEditing({ ...editing, stakeholderClass: e.target.value, stakeholder: '' })}>
                  <option value="">None</option>
                  {stakeholderClassOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              {editing.stakeholderClass && (
                <Field label="Stakeholder">
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <StakeholderSelect stakeholderClass={editing.stakeholderClass} value={editing.stakeholder} onChange={(v) => setEditing({ ...editing, stakeholder: v })} />
                    </div>
                    <QuickAddStakeholder stakeholderClass={editing.stakeholderClass as any} onCreated={(name) => setEditing({ ...editing, stakeholder: name })} />
                  </div>
                </Field>
              )}
            </div>

            {/* Recurring Journal Entry */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Recurring Journal Entry">
                <Select value={editing.recurring} onChange={(e) => setEditing({ ...editing, recurring: e.target.value })}>
                  <option value="no">No</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>Every {n} month{n > 1 ? 's' : ''}</option>
                  ))}
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              {editing.recurring !== 'no' && (
                <Field label="Total cycles">
                  <Input type="number" min="0" value={editing.totalCycles} onChange={(e) => setEditing({ ...editing, totalCycles: e.target.value })} placeholder="Leave blank = repeat forever" />
                </Field>
              )}
            </div>
            {editing.recurring === 'custom' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Repeat every" required>
                  <Input type="number" min="1" value={editing.recurringEvery} onChange={(e) => setEditing({ ...editing, recurringEvery: e.target.value })} />
                </Field>
                <Field label="Period">
                  <Select value={editing.recurringPeriod} onChange={(e) => setEditing({ ...editing, recurringPeriod: e.target.value as Form['recurringPeriod'] })}>
                    <option value="days">Day(s)</option>
                    <option value="weeks">Week(s)</option>
                    <option value="months">Month(s)</option>
                    <option value="years">Year(s)</option>
                  </Select>
                </Field>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-100">Lines</p>
                <Button type="button" size="sm" variant="ghost" className="hidden md:inline-flex" onClick={addLine}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className={`mb-1 hidden ${lineGridCls} px-1 text-[10px] font-bold uppercase tracking-wider text-mist md:grid`}>
                <span>Account</span><span>Debit</span><span>Credit</span>{showCostCenter && <span>Cost center</span>}<span />
              </div>
              <div className="space-y-3">
                {editing.lines.map((l, i) => (
                  <div key={i} className={`${lineGridCls} items-start md:items-center`}>
                    <div className="col-span-12 min-w-0 md:col-span-1">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Account</span>
                      <AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => setLine(i, { accountId: v })} />
                    </div>
                    <div className="col-span-12 min-w-0 md:col-span-1">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Debit</span>
                      <Input aria-label="Debit" type="number" min={0} value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
                    </div>
                    <div className={`${showCostCenter ? 'col-span-12' : 'col-span-10'} min-w-0 md:col-span-1`}>
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Credit</span>
                      <Input aria-label="Credit" type="number" min={0} value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
                    </div>
                    {showCostCenter && (
                      <div className="col-span-10 min-w-0 md:col-span-1">
                        <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Cost center</span>
                        <CostCenterSelect value={l.costCenterId} onChange={(id) => setLine(i, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${i + 1}`} />
                      </div>
                    )}
                    <button
                      type="button"
                      className="col-span-2 mt-[26px] grid h-[42px] w-full shrink-0 place-items-center rounded-md border border-[#36558b] bg-[#36558b] text-white transition hover:bg-[#2c4879] md:col-span-1 md:mt-0 md:w-9 md:border-[#e4e4de] md:bg-white md:text-mist md:hover:border-ember/60 md:hover:bg-rose-500/10 md:hover:text-ember dark:md:border-[#2a2a30] dark:md:bg-[#0d0d0f]"
                      title="Remove line"
                      aria-label="Remove line"
                      onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, idx) => idx !== i) })}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 hidden text-xs text-mist md:block">Row#: {editing.lines.length}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
                <div className="flex h-12 items-center justify-end rounded-md border border-[#d2d5d9] bg-[#e9ecef] px-3 text-right text-sm font-bold text-blue-700 dark:border-[#3a404b] dark:bg-[#20242b] dark:text-blue-300">
                  Row# {editing.lines.length}
                </div>
                <Button type="button" variant="primary" className="h-12 rounded-md bg-[#36558b] px-4 text-sm shadow-sm hover:bg-[#2c4879]" onClick={addLine}>
                  <Plus className="size-4 shrink-0" /> Add New Line
                </Button>
              </div>
              <div className="mt-3 grid gap-1.5 rounded-md border border-line bg-black/[0.03] p-3 text-sm dark:bg-white/[0.04] sm:flex sm:items-center sm:justify-end sm:gap-6 sm:border-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
                <span className="flex items-center justify-between sm:block">Debit total: <span className="font-semibold">{formatGhsExact(totalDebit)}</span></span>
                <span className="flex items-center justify-between sm:block">Credit total: <span className="font-semibold">{formatGhsExact(totalCredit)}</span></span>
                <span className={`${balanced ? 'font-semibold text-lime' : 'font-semibold text-ember'} text-right sm:text-left`}>{balanced ? 'Balanced' : 'Unbalanced'}</span>
              </div>
            </div>

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>
            <Field label="Attachments">
              <AttachmentField files={editing.attachments} onChange={(files) => setEditing({ ...editing, attachments: files })} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {canManage && (
                <Button variant="outline" onClick={() => { setTplName(editing.description.trim() || `Template — ${editing.number}`); setTplModal(true) }}>
                  <Save className="size-4" /> Save as template
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="lime" onClick={save}>{approvalRequired ? 'Save for Approval' : 'Save'}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* View / print */}
      <JournalViewModal viewing={viewing} accounts={accounts} companyName={company.name} costCenterEnabled={showCostCenter} costCenters={costCenters} onClose={() => setViewing(null)} onPrint={printVoucher} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete journal entry?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting.number}</span> ({formatGhs(voucherTotal(deleting))})? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Save current entry as a reusable template */}
      <Modal open={tplModal} onClose={() => setTplModal(false)} title="Save as template">
        <div className="space-y-3">
          <p className="text-sm text-mist">Save the current lines and description as a reusable template. New entries can pick it from the <span className="font-semibold">Template</span> select.</p>
          <Field label="Template name" required>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Rent payment" autoFocus />
          </Field>
          {editing && (
            <div className="rounded-xl border border-line p-3 text-xs text-mist">
              <p className="font-semibold text-ink">{editing.description || '—'} <span className="font-normal">· {editing.lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0)).length} line(s) · {formatGhsExact(totalDebit)}</span></p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTplModal(false)}>Cancel</Button>
            <Button onClick={doSaveTemplate}><Save className="size-4" /> Save template</Button>
          </div>
        </div>
      </Modal>

      {/* Template library — use / edit / delete saved templates */}
      <Modal open={showTemplates} onClose={() => { setShowTemplates(false); setTplForm(null) }} title={tplForm ? (tplForm.id ? 'Edit template' : 'New template') : 'Journal entry templates'} wide>
        {tplForm ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Template name" required>
                <Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} placeholder="e.g. Rent payment" />
              </Field>
              <Field label="Description (prefilled into new entries)">
                <Input value={tplForm.description} onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })} />
              </Field>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-100">Lines</p>
                <Button type="button" size="sm" variant="ghost" className="hidden md:inline-flex" onClick={addTplLine}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className={`mb-1 hidden ${lineGridCls} px-1 text-[10px] font-bold uppercase tracking-wider text-mist md:grid`}>
                <span>Account</span><span>Debit</span><span>Credit</span>{showCostCenter && <span>Cost center</span>}<span />
              </div>
              <div className="space-y-3">
                {tplForm.lines.map((l, i) => (
                  <div key={i} className={`${lineGridCls} items-start md:items-center`}>
                    <div className="col-span-12 min-w-0 md:col-span-1">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Account</span>
                      <AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => setTplLine(i, { accountId: v })} />
                    </div>
                    <div className="col-span-12 min-w-0 md:col-span-1">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Debit</span>
                      <Input aria-label="Debit" type="number" min={0} value={l.debit} onChange={(e) => setTplLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
                    </div>
                    <div className={`${showCostCenter ? 'col-span-12' : 'col-span-10'} min-w-0 md:col-span-1`}>
                      <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Credit</span>
                      <Input aria-label="Credit" type="number" min={0} value={l.credit} onChange={(e) => setTplLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
                    </div>
                    {showCostCenter && (
                      <div className="col-span-10 min-w-0 md:col-span-1">
                        <span className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200 md:hidden">Cost center</span>
                        <CostCenterSelect value={l.costCenterId} onChange={(id) => setTplLine(i, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${i + 1}`} />
                      </div>
                    )}
                    <button
                      type="button"
                      className="col-span-2 mt-[26px] grid h-[42px] w-full shrink-0 place-items-center rounded-md border border-[#36558b] bg-[#36558b] text-white transition hover:bg-[#2c4879] md:col-span-1 md:mt-0 md:w-9 md:border-[#e4e4de] md:bg-white md:text-mist md:hover:border-ember/60 md:hover:bg-rose-500/10 md:hover:text-ember dark:md:border-[#2a2a30] dark:md:bg-[#0d0d0f]"
                      title="Remove line"
                      aria-label="Remove line"
                      onClick={() => setTplForm({ ...tplForm, lines: tplForm.lines.filter((_, idx) => idx !== i) })}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 hidden text-xs text-mist md:block">Row#: {tplForm.lines.length}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
                <div className="flex h-12 items-center justify-end rounded-md border border-[#d2d5d9] bg-[#e9ecef] px-3 text-right text-sm font-bold text-blue-700 dark:border-[#3a404b] dark:bg-[#20242b] dark:text-blue-300">
                  Row# {tplForm.lines.length}
                </div>
                <Button type="button" variant="primary" className="h-12 rounded-md bg-[#36558b] px-4 text-sm shadow-sm hover:bg-[#2c4879]" onClick={addTplLine}>
                  <Plus className="size-4 shrink-0" /> Add New Line
                </Button>
              </div>
              <div className="mt-3 grid gap-1.5 rounded-md border border-line bg-black/[0.03] p-3 text-sm dark:bg-white/[0.04] sm:flex sm:items-center sm:justify-end sm:gap-6 sm:border-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
                <span className="flex items-center justify-between sm:block">Debit total: <span className="font-semibold">{formatGhsExact(tplDebit)}</span></span>
                <span className="flex items-center justify-between sm:block">Credit total: <span className="font-semibold">{formatGhsExact(tplCredit)}</span></span>
                <span className={`${tplBalanced ? 'font-semibold text-lime' : 'font-semibold text-ember'} text-right sm:text-left`}>{tplBalanced ? 'Balanced' : 'Unbalanced'}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTplForm(null)}>Cancel</Button>
              <Button onClick={saveTplForm}><Save className="size-4" /> Save template</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-mist">Pick a template to start a new entry from, or edit and manage saved templates.</p>
              <Button size="sm" variant="outline" onClick={() => openTplForm()}><Plus className="size-4" /> New template</Button>
            </div>
            {journalTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-mist">
                No templates yet. Open an entry, set up its lines, then use <span className="font-semibold">Save as template</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {journalTemplates.map((t) => {
                  const amount = t.lines.reduce((s, l) => s + l.debit, 0)
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{t.name}</p>
                        <p className="mt-0.5 text-xs text-mist">
                          {t.lines.length} line(s) · {formatGhsExact(amount)}
                          {t.lines.map((l, i) => (
                            <span key={i}> {i > 0 && <span className="text-line">·</span>} <span className="text-ink/70">{accountName(accounts, l.accountId)}</span> {l.debit ? `Dr ${formatGhsExact(l.debit)}` : `Cr ${formatGhsExact(l.credit)}`}</span>
                          ))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" onClick={() => useTemplate(t)}><Plus className="size-4" /> Use</Button>
                        {canManage && (
                          <>
                            <button className="rounded-lg p-2 text-mist hover:text-lime" title={`Edit "${t.name}"`} aria-label={`Edit template ${t.name}`} onClick={() => openTplForm(t)}><Pencil className="size-4" /></button>
                            <button className="rounded-lg p-2 text-mist hover:text-ember" title={`Delete "${t.name}"`} aria-label={`Delete template ${t.name}`} onClick={() => { deleteJournalTemplate(t.id); log(user?.id || 'system', 'DELETE', 'JournalTemplate', `Deleted template "${t.name}"`); toast.success('Template deleted', `"${t.name}" was removed.`) }}><Trash2 className="size-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
