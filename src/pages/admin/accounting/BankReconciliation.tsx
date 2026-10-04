import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Printer, CheckCircle2, Undo2, Eye, Landmark, FileCheck2, Scale } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea, SearchField, DatePicker, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import {
  bankEntries, windowEntries, entryDirection, reconSummary, reconDifference,
  computeStartingBalance, nextDay,
} from '../../../lib/reconciliation'
import type { AccountHistoryEntry, BankReconciliation } from '../../../types'

type Wizard = {
  id?: string
  bankAccountId: string
  periodStart: string
  statementDate: string
  statementBalance: string
  notes: string
}

type Filter = 'all' | 'deposits' | 'withdrawals' | 'cleared' | 'uncleared'

const ghs = (n: number) => formatGhsExact(n)

export function BankReconciliationPage() {
  const app = useApp()
  const { reconciliations, banks, accountHistory, upsertReconciliation, deleteReconciliation, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [bankId, setBankId] = useState(() => {
    const open = reconciliations.find((r) => r.status === 'open')
    return open?.bankAccountId || banks[0]?.id || ''
  })
  const [q, setQ] = useState('')
  const [histQ, setHistQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [wizard, setWizard] = useState<Wizard | null>(null)
  const [deleting, setDeleting] = useState<BankReconciliation | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  const bank = banks.find((b) => b.id === bankId)
  const bankName = (id: string) => banks.find((b) => b.id === id)?.name || id

  const openRecon = useMemo(
    () => reconciliations.find((r) => r.bankAccountId === bankId && r.status === 'open'),
    [reconciliations, bankId],
  )

  const ledger = useMemo(() => (bank ? bankEntries(accountHistory, bank) : []), [accountHistory, bank])

  // ---------- workspace math ----------
  const ws = useMemo(() => {
    if (!openRecon || !bank) return null
    const rows = windowEntries(ledger, openRecon.periodStart, openRecon.statementDate)
    const cleared = new Set(openRecon.clearedEntryIds || [])
    const starting = openRecon.startingBalance ?? computeStartingBalance(bank, previousRecon(bankId))
    const sum = reconSummary(rows, cleared, starting)
    return { rows, cleared, starting, sum, diff: reconDifference(openRecon.statementBalance, sum) }
  }, [openRecon, ledger, bank, bankId, reconciliations])

  function previousRecon(id: string): BankReconciliation | undefined {
    return [...reconciliations]
      .filter((r) => r.bankAccountId === id && r.status === 'reconciled')
      .sort((a, b) => b.statementDate.localeCompare(a.statementDate))[0]
  }

  const toggleCleared = (entryId: string) => {
    if (!openRecon || !ws || !bank || !canManage) return
    const ids = new Set(openRecon.clearedEntryIds || [])
    if (ids.has(entryId)) ids.delete(entryId); else ids.add(entryId)
    const sum = reconSummary(ws.rows, ids, ws.starting)
    persist({ ...openRecon, clearedEntryIds: [...ids], clearedDeposits: sum.clearedDeposits, clearedWithdrawals: sum.clearedWithdrawals, bookBalance: sum.endingBook, difference: reconDifference(openRecon.statementBalance, sum) })
  }

  const setAllCleared = (on: boolean) => {
    if (!openRecon || !ws || !bank) return
    const ids = on ? ws.rows.map((r) => r.id) : []
    const sum = reconSummary(ws.rows, ids, ws.starting)
    persist({ ...openRecon, clearedEntryIds: ids, clearedDeposits: sum.clearedDeposits, clearedWithdrawals: sum.clearedWithdrawals, bookBalance: sum.endingBook, difference: reconDifference(openRecon.statementBalance, sum) })
  }

  const persist = (r: BankReconciliation) => upsertReconciliation(r)

  // ---------- wizard ----------
  const openWizard = (existing?: BankReconciliation) => {
    const id = existing?.bankAccountId || bankId || banks[0]?.id || ''
    const b = banks.find((x) => x.id === id)
    const prev = previousRecon(id)
    setWizard(existing
      ? { id: existing.id, bankAccountId: existing.bankAccountId, periodStart: existing.periodStart || (prev ? nextDay(prev.statementDate) : ''), statementDate: existing.statementDate, statementBalance: String(existing.statementBalance), notes: existing.notes || '' }
      : { bankAccountId: id, periodStart: prev ? nextDay(prev.statementDate) : '', statementDate: new Date().toISOString().slice(0, 10), statementBalance: '', notes: '' })
    void b
  }

  const wizardStarting = useMemo(() => {
    if (!wizard) return 0
    const b = banks.find((x) => x.id === wizard.bankAccountId)
    if (!b) return 0
    const prev = previousRecon(wizard.bankAccountId)
    return computeStartingBalance(b, prev)
  }, [wizard, banks, reconciliations])

  const saveWizard = () => {
    if (!wizard) return
    if (!wizard.bankAccountId) { toast.error('Select a bank account.'); return }
    const statementBalance = Number(wizard.statementBalance)
    if (!Number.isFinite(statementBalance)) { toast.error('Enter the statement ending balance.'); return }
    if (!wizard.statementDate) { toast.error('Enter the statement end date.'); return }
    const clash = reconciliations.find((r) => r.status === 'open' && r.bankAccountId === wizard.bankAccountId && r.id !== wizard.id)
    if (clash) { toast.error('That account already has an open reconciliation. Finish or delete it first.'); return }
    const b = banks.find((x) => x.id === wizard.bankAccountId)!
    const prev = previousRecon(wizard.bankAccountId)
    const starting = computeStartingBalance(b, prev)
    const existing = wizard.id ? reconciliations.find((r) => r.id === wizard.id) : undefined
    const rec: BankReconciliation = {
      id: wizard.id || uid('rc'),
      companyId: existing?.companyId, branchId: existing?.branchId,
      bankAccountId: wizard.bankAccountId,
      periodStart: wizard.periodStart || undefined,
      statementDate: wizard.statementDate,
      startingBalance: starting,
      statementBalance,
      bookBalance: existing?.bookBalance ?? starting,
      difference: existing?.difference ?? Math.round((statementBalance - starting) * 100) / 100,
      clearedDeposits: existing?.clearedDeposits, clearedWithdrawals: existing?.clearedWithdrawals,
      clearedEntryIds: existing?.clearedEntryIds, finishedAt: existing?.finishedAt,
      status: existing?.status || 'open',
      notes: wizard.notes.trim() || undefined,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    persist(rec)
    log(user?.id || 'system', wizard.id ? 'UPDATE' : 'CREATE', 'BankReconciliation', `${wizard.id ? 'Updated' : 'Started'} reconciliation for ${bankName(wizard.bankAccountId)} — statement ${wizard.statementDate}`)
    toast.success(wizard.id ? 'Reconciliation updated' : 'Reconciliation started', 'Match the cleared items until the difference is 0.00.')
    setBankId(wizard.bankAccountId)
    setWizard(null)
  }

  // ---------- finish / undo ----------
  const finishRecon = () => {
    if (!openRecon || !ws) return
    if (Math.abs(ws.diff) >= 0.005) { toast.error('Difference must be 0.00 to finish.', `You are ${ghs(Math.abs(ws.diff))} away.`); return }
    persist({ ...openRecon, status: 'reconciled', finishedAt: new Date().toISOString(), difference: 0 })
    log(user?.id || 'system', 'UPDATE', 'BankReconciliation', `Finished reconciliation for ${bankName(openRecon.bankAccountId)} — ${ws.sum.clearedCount} cleared items`)
    toast.success('Reconciliation finished 🎉', 'The statement period is now reconciled.')
  }

  const undoRecon = (r: BankReconciliation) => {
    persist({ ...r, status: 'open', finishedAt: undefined })
    log(user?.id || 'system', 'UPDATE', 'BankReconciliation', `Re-opened reconciliation for ${bankName(r.bankAccountId)}`)
    toast.success('Reconciliation re-opened', 'Cleared marks were kept — adjust and finish again.')
  }

  const doDelete = () => {
    if (!deleting) return
    deleteReconciliation(deleting.id)
    log(user?.id || 'system', 'DELETE', 'BankReconciliation', `Deleted reconciliation for ${bankName(deleting.bankAccountId)}`)
    toast.success('Reconciliation deleted')
    setDeleting(null)
  }

  // ---------- history ----------
  const historyRows = useMemo(() => {
    const ql = histQ.trim().toLowerCase()
    return [...reconciliations]
      .filter((r) => !ql || bankName(r.bankAccountId).toLowerCase().includes(ql))
      .sort((a, b) => b.statementDate.localeCompare(a.statementDate))
  }, [reconciliations, histQ, banks])

  const columns: Column<BankReconciliation>[] = [
    { key: 'bank', header: 'Bank account', sortValue: (r) => bankName(r.bankAccountId), render: (r) => <span className="font-semibold">{bankName(r.bankAccountId)}</span> },
    { key: 'period', header: 'Statement period', sortValue: (r) => r.statementDate, render: (r) => <span className="text-mist">{r.periodStart ? `${formatDate(r.periodStart)} – ` : ''}{formatDate(r.statementDate)}</span> },
    { key: 'stmt', header: 'Statement balance', sortValue: (r) => r.statementBalance, align: 'right', render: (r) => ghs(r.statementBalance) },
    { key: 'book', header: 'Book balance', sortValue: (r) => r.bookBalance, align: 'right', render: (r) => ghs(r.bookBalance) },
    { key: 'diff', header: 'Difference', sortValue: (r) => r.difference, align: 'right', render: (r) => <span className={r.difference === 0 ? 'font-semibold text-lime' : 'font-semibold text-ember'}>{ghs(r.difference)}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Badge tone={r.status === 'reconciled' ? 'lime' : 'amber'}>{r.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.status === 'reconciled' && <button className="rounded-lg p-2 text-mist hover:text-lime" title="View report" onClick={() => setReportId(r.id)}><Eye className="size-4" /></button>}
          {canManage && r.status === 'open' && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Continue" onClick={() => setBankId(r.bankAccountId)}><FileCheck2 className="size-4" /></button>}
          {canManage && r.status === 'reconciled' && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Undo (re-open)" onClick={() => undoRecon(r)}><Undo2 className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit details" onClick={() => openWizard(r)}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const report = reportId ? reconciliations.find((r) => r.id === reportId) : null
  const reportData = useMemo(() => {
    if (!report) return null
    const b = banks.find((x) => x.id === report.bankAccountId)
    const rows = b ? windowEntries(bankEntries(accountHistory, b), report.periodStart, report.statementDate) : []
    const cleared = new Set(report.clearedEntryIds || [])
    return { bank: b, clearedRows: rows.filter((e) => cleared.has(e.id)) }
  }, [report, banks, accountHistory])

  const doPrint = () => {
    setPrinting(true)
    document.body.classList.add('recon-printing')
    window.print()
    document.body.classList.remove('recon-printing')
    setPrinting(false)
  }

  // ---------- workspace view ----------
  const wsRows = useMemo(() => {
    if (!ws) return []
    const ql = q.trim().toLowerCase()
    return ws.rows.filter((e) => {
      const isCleared = ws.cleared.has(e.id)
      if (filter === 'cleared' && !isCleared) return false
      if (filter === 'uncleared' && isCleared) return false
      if (filter === 'deposits' && entryDirection(e) !== 'deposit') return false
      if (filter === 'withdrawals' && entryDirection(e) !== 'withdrawal') return false
      if (ql && !`${e.description || ''} ${e.relType} ${formatDate(e.dateCreated)}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [ws, q, filter])

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'deposits', label: 'Deposits' }, { id: 'withdrawals', label: 'Withdrawals' },
    { id: 'cleared', label: 'Cleared' }, { id: 'uncleared', label: 'Uncleared' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><span>/</span><span className="font-semibold text-inherit">Bank Reconciliation</span>
      </div>
      <PageHeader
        title="Bank Reconciliation"
        desc="Match your bank statement against the general ledger — clear items until the difference reaches zero, then close the period."
        actions={canManage ? <Button onClick={() => openWizard()}><Plus className="size-4" /> Start reconciliation</Button> : undefined}
      />

      {/* account selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={bankId} onChange={(e) => { setBankId(e.target.value); setQ(''); setHistQ(''); setFilter('all') }} className="w-64" aria-label="Bank account">
          {banks.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
        </Select>
        {bank && <Badge tone="zinc">Book balance {ghs(bank.balance)}</Badge>}
        {openRecon && <Badge tone="amber">Open statement · ends {formatDate(openRecon.statementDate)}</Badge>}
      </div>

      {openRecon && ws && bank ? (
        /* ---------------- matching workspace ---------------- */
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="grid gap-4 xl:col-span-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Statement ending balance</p>
              <p className="mt-1 text-xl font-extrabold">{ghs(openRecon.statementBalance)}</p>
              <p className="text-[11px] text-mist">{openRecon.periodStart ? `${formatDate(openRecon.periodStart)} – ` : ''}{formatDate(openRecon.statementDate)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Cleared deposits</p>
              <p className="mt-1 text-xl font-extrabold text-lime">{ghs(ws.sum.clearedDeposits)}</p>
              <p className="text-[11px] text-mist">{ws.rows.filter((e) => entryDirection(e) === 'deposit' && ws.cleared.has(e.id)).length} items cleared</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Cleared withdrawals</p>
              <p className="mt-1 text-xl font-extrabold text-ember">{ghs(ws.sum.clearedWithdrawals)}</p>
              <p className="text-[11px] text-mist">{ws.rows.filter((e) => entryDirection(e) === 'withdrawal' && ws.cleared.has(e.id)).length} items cleared</p>
            </div>
            <div className={`card p-4 ${Math.abs(ws.diff) < 0.005 ? 'border-lime' : ''}`}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Difference</p>
              <p className={`mt-1 text-xl font-extrabold ${Math.abs(ws.diff) < 0.005 ? 'text-lime' : 'text-ember'}`}>{ghs(ws.diff)}</p>
              <p className="text-[11px] text-mist">{Math.abs(ws.diff) < 0.005 ? 'Ready to finish ✓' : 'Must reach 0.00 to finish'}</p>
            </div>
          </div>

          <div className="card overflow-hidden xl:col-span-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${filter === f.id ? 'bg-black text-white dark:bg-lime dark:text-black' : 'text-mist hover:text-inherit'}`}>{f.label}</button>
                ))}
              </div>
              <SearchField value={q} onChange={setQ} placeholder="Search description, type, date…" className="ml-auto w-full sm:w-64" />
              {canManage && wsRows.length > 0 && (
                <span className="flex gap-1">
                  <Button variant="outline" onClick={() => setAllCleared(true)}>Mark all</Button>
                  <Button variant="ghost" onClick={() => setAllCleared(false)}>Clear all</Button>
                </span>
              )}
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
                  <tr className="border-b border-line text-left text-[10px] font-bold uppercase tracking-wider text-mist">
                    <th className="w-10 px-3 py-2.5"><input type="checkbox" className="accent-[#c8f542]" checked={wsRows.length > 0 && wsRows.every((e) => ws.cleared.has(e.id))} onChange={(e) => setAllCleared(e.target.checked)} aria-label="Toggle all rows" /></th>
                    <th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 text-right">Deposit</th><th className="px-3 py-2.5 text-right">Withdrawal</th>
                  </tr>
                </thead>
                <tbody>
                  {wsRows.map((e) => {
                    const isDep = entryDirection(e) === 'deposit'
                    const on = ws.cleared.has(e.id)
                    return (
                      <tr key={e.id} className={`border-b border-line last:border-0 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${on ? 'bg-lime/[0.06]' : ''}`}>
                        <td className="px-3 py-2"><input type="checkbox" className="size-4 accent-[#c8f542]" checked={on} disabled={!canManage} onChange={() => toggleCleared(e.id)} aria-label={`Clear ${e.description || e.relType}`} /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-mist">{formatDate(e.dateCreated)}</td>
                        <td className="px-3 py-2"><Badge tone="zinc">{e.relType.replace(/_/g, ' ')}</Badge></td>
                        <td className="px-3 py-2 font-semibold">{e.description || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{isDep ? ghs(e.debit) : ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{!isDep ? ghs(e.credit) : ''}</td>
                      </tr>
                    )
                  })}
                  {!wsRows.length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">
                      No ledger entries in this statement window{q || filter !== 'all' ? ' for the current filters' : ''}. Post receipts, payments or journal entries against {bank.code ? `account ${bank.code}` : 'this bank account'} and they will appear here.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-3">
              <p className="text-[11px] text-mist">{ws.sum.clearedCount} cleared · {ws.sum.unclearedCount} uncleared · starting balance {ghs(ws.starting)}</p>
              {canManage && (
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => openWizard(openRecon)}><Pencil className="size-4" /> Edit details</Button>
                  <Button disabled={Math.abs(ws.diff) >= 0.005} onClick={finishRecon}>
                    <CheckCircle2 className="size-4" /> {Math.abs(ws.diff) < 0.005 ? 'Finish now' : `Finish when difference is 0.00 (${ghs(ws.diff)})`}
                  </Button>
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ---------------- empty state ---------------- */
        <div className="card p-10 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-black/5 dark:bg-white/10"><Scale className="size-7" /></div>
          <p className="font-extrabold">No open reconciliation for {bank?.name || 'this account'}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist">Start a reconciliation: enter the statement ending balance and date, then tick off the ledger entries that appear on the statement.</p>
          {canManage && <Button className="mt-4" onClick={() => openWizard()}><Plus className="size-4" /> Start reconciliation</Button>}
        </div>
      )}

      {/* ---------------- history ---------------- */}
      <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-extrabold"><Landmark className="size-4" /> Reconciliation history</h3>
      <div className="mb-2 flex justify-end">
        <SearchField value={histQ} onChange={setHistQ} placeholder="Search bank account…" className="w-full sm:w-64" />
      </div>
      <DataTable data={historyRows} columns={columns} rowKey={(r) => r.id} pageSize={10} emptyTitle="No reconciliations yet" emptyDesc="Start a reconciliation to match a bank statement against the ledger." />

      {/* ---------------- wizard ---------------- */}
      <Modal open={!!wizard} onClose={() => setWizard(null)} title={wizard?.id ? 'Edit reconciliation' : 'Start reconciliation'}>
        {wizard && (
          <div className="grid gap-3">
            <Field label="Bank account" required>
              <Select value={wizard.bankAccountId} onChange={(e) => setWizard({ ...wizard, bankAccountId: e.target.value })} disabled={!!wizard.id}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statement start date"><DatePicker value={wizard.periodStart} onChange={(v) => setWizard({ ...wizard, periodStart: v })} /></Field>
              <Field label="Statement end date" required><DatePicker value={wizard.statementDate} onChange={(v) => setWizard({ ...wizard, statementDate: v })} /></Field>
            </div>
            <Field label="Statement ending balance (from bank statement)" required>
              <Input type="number" step="0.01" value={wizard.statementBalance} onChange={(e) => setWizard({ ...wizard, statementBalance: e.target.value })} placeholder="0.00" />
            </Field>
            <p className="rounded-lg bg-black/5 px-3 py-2 text-[12px] text-mist dark:bg-white/5">
              Starting book balance: <span className="font-extrabold text-inherit">{ghs(wizardStarting)}</span> — carried forward {previousRecon(wizard.bankAccountId) ? 'from your last reconciled statement' : 'from the account opening balance'}.
            </p>
            <Field label="Notes"><Textarea rows={2} value={wizard.notes} onChange={(e) => setWizard({ ...wizard, notes: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveWizard}>{wizard.id ? 'Save changes' : 'Start reconciling'}</Button>
              <Button variant="ghost" onClick={() => setWizard(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- delete ---------------- */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete reconciliation?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete the {deleting.status} reconciliation for <span className="font-semibold text-inherit">{bankName(deleting.bankAccountId)}</span> ({formatDate(deleting.statementDate)})? Cleared marks will be discarded.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>

      {/* ---------------- report ---------------- */}
      <Modal open={!!report} onClose={() => setReportId(null)} title="Reconciliation report">
        {report && reportData && (
          <div>
            <div className="grid gap-2 text-sm">
              <p><span className="text-mist">Account:</span> <span className="font-bold">{bankName(report.bankAccountId)}</span></p>
              <p><span className="text-mist">Statement period:</span> {report.periodStart ? `${formatDate(report.periodStart)} – ` : ''}{formatDate(report.statementDate)}</p>
              <p><span className="text-mist">Starting balance:</span> {ghs(report.startingBalance ?? report.bookBalance - (report.clearedDeposits || 0) + (report.clearedWithdrawals || 0))}</p>
              <p><span className="text-mist">Cleared deposits:</span> <span className="text-lime">{ghs(report.clearedDeposits || 0)}</span> · <span className="text-mist">withdrawals:</span> <span className="text-ember">{ghs(report.clearedWithdrawals || 0)}</span></p>
              <p><span className="text-mist">Ending book balance:</span> <span className="font-bold">{ghs(report.bookBalance)}</span> · <span className="text-mist">difference:</span> <span className="font-bold text-lime">{ghs(0)}</span></p>
              <p className="text-mist">{reportData.clearedRows.length} cleared items · {report.finishedAt ? `finished ${formatDate(report.finishedAt.slice(0, 10))}` : ''}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={doPrint}><Printer className="size-4" /> Print report</Button>
              <Button variant="ghost" onClick={() => setReportId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* printable A4 report (outside #root so body.recon-printing can hide the app) */}
      {report && reportData && printing && createPortal(
        <div className="recon-print-root">
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Bank Reconciliation Report</h1>
          <p style={{ fontSize: 11, marginBottom: 12 }}>{bankName(report.bankAccountId)} · Statement {report.periodStart ? `${report.periodStart} – ` : ''}{report.statementDate}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 12 }}>
            <tbody>
              <tr><td style={{ padding: '3px 0' }}>Starting book balance</td><td style={{ textAlign: 'right' }}>{report.startingBalance ?? 0}</td></tr>
              <tr><td style={{ padding: '3px 0' }}>Cleared deposits ({reportData.clearedRows.filter((e) => entryDirection(e) === 'deposit').length})</td><td style={{ textAlign: 'right' }}>{report.clearedDeposits || 0}</td></tr>
              <tr><td style={{ padding: '3px 0' }}>Cleared withdrawals ({reportData.clearedRows.filter((e) => entryDirection(e) === 'withdrawal').length})</td><td style={{ textAlign: 'right' }}>{report.clearedWithdrawals || 0}</td></tr>
              <tr style={{ fontWeight: 700 }}><td style={{ padding: '3px 0', borderTop: '1px solid #111' }}>Ending book balance</td><td style={{ textAlign: 'right', borderTop: '1px solid #111' }}>{report.bookBalance}</td></tr>
              <tr><td style={{ padding: '3px 0' }}>Statement ending balance</td><td style={{ textAlign: 'right' }}>{report.statementBalance}</td></tr>
              <tr style={{ fontWeight: 700 }}><td style={{ padding: '3px 0' }}>Difference</td><td style={{ textAlign: 'right' }}>0.00</td></tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <thead><tr style={{ borderBottom: '1px solid #111', textAlign: 'left' }}>
              <th style={{ padding: '3px 4px' }}>Date</th><th style={{ padding: '3px 4px' }}>Type</th><th style={{ padding: '3px 4px' }}>Description</th>
              <th style={{ padding: '3px 4px', textAlign: 'right' }}>Deposit</th><th style={{ padding: '3px 4px', textAlign: 'right' }}>Withdrawal</th>
            </tr></thead>
            <tbody>
              {reportData.clearedRows.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '2px 4px' }}>{e.dateCreated.slice(0, 10)}</td>
                  <td style={{ padding: '2px 4px' }}>{e.relType}</td>
                  <td style={{ padding: '2px 4px' }}>{e.description || ''}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>{entryDirection(e) === 'deposit' ? e.debit : ''}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>{entryDirection(e) === 'withdrawal' ? e.credit : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </div>
  )
}
