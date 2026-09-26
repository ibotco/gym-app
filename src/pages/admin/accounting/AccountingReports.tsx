import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LayoutGrid, BookMarked, ChevronLeft, RefreshCw } from 'lucide-react'
import { Field, Select, Empty, SearchField } from '../../../components/ui'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { tableToRows } from '../../../lib/tableExport'
import type { ExportRow } from '../../../lib/export'
import { useApp } from '../../../context/AppContext'
import { formatGhs } from '../../../lib/utils'
import { accountName } from '../../../lib/accounting'
import { keepAccountRow, resolveFinPrefs } from '../../../lib/financialReporting'

export type ReportId =
  | 'checkBalance'
  | 'receivables'
  | 'analysis'
  | 'cashBook'
  | 'bankBook'
  | 'reconciliation'
  | 'contribution'
  | 'listAccounts'
  | 'ledger'
  | 'subLedger'
  | 'generalLedger'
  | 'generalJournal'

export const STATEMENT_REPORTS: { id: ReportId; label: string; desc: string; grid?: boolean }[] = [
  { id: 'checkBalance', label: 'Check Balance', desc: 'For checking balance of accounts.', grid: true },
  { id: 'receivables', label: 'Other Receivables Balance(s)', desc: 'Outstanding balances owed to the organisation.' },
  { id: 'analysis', label: 'Receipt/Payment Analysis Book', desc: 'Analyses receipts and payments per account.' },
  { id: 'cashBook', label: 'Cash Book', desc: 'Cash receipts and payments with running balance.' },
  { id: 'bankBook', label: 'Bank Book', desc: 'Bank deposits and withdrawals with running balance.' },
  { id: 'reconciliation', label: 'Bank Reconciliation', desc: 'Compares bank statements with book balances.' },
  { id: 'contribution', label: 'Contribution Per Head', desc: 'Totals contributions received per contributor.' },
  { id: 'listAccounts', label: 'List of Accounts', desc: 'The full chart of accounts.' },
  { id: 'ledger', label: 'Ledger', desc: 'Detailed entries and balance for one account.' },
  { id: 'subLedger', label: 'Sub-Ledger', desc: 'Account entries broken down by party.' },
  { id: 'generalLedger', label: 'General Ledger', desc: 'Debit, credit and balance totals per account.' },
  { id: 'generalJournal', label: 'General Journal', desc: 'Chronological journal entries with their lines.' },
]

/** Same display format as the sale date (MM/DD/YYYY). */
const dFmt = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function T({ head, rows, right }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="bg-[#2e75b6] text-left text-[10px] font-bold uppercase tracking-wider text-white">
              {head.map((h, i) => (<th key={i} className={`px-3 py-2.5 ${right?.includes(i) ? 'text-right' : ''}`}>{h}</th>))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70 bg-white dark:bg-transparent">
            {rows.map((r, ri) => (
              <tr key={ri} className={`${ri % 2 === 1 ? 'bg-[#2e75b6]/[0.05] dark:bg-[#2e75b6]/[0.08]' : ''} transition-colors hover:bg-[#2e75b6]/10 dark:hover:bg-[#2e75b6]/15`}>
                {r.map((c, ci) => (<td key={ci} className={`px-3 py-2.5 ${right?.includes(ci) ? 'text-right tabular-nums' : ''}`}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Bordered label cell attached to a filter control, as in the analysis book mock. */
function FRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-md items-stretch">
      <span className="flex w-32 shrink-0 items-center rounded-l-md border border-r-0 border-line bg-black/[0.02] px-3 text-sm font-bold dark:bg-white/[0.04]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}


export function AccountingReportsPage({
  forcedReport = null,
  bodyOnly = false,
}: {
  /** Preselect this report on mount. */
  forcedReport?: ReportId | null
  /** Render only the report body, for composition inside Accounts Reports. */
  bodyOnly?: boolean
} = {}) {
  const app = useApp()
  /** Financial Reporting Preferences — read live so toggles apply immediately. */
  const frPrefs = resolveFinPrefs(app.accountingSettings)
  const { accounts, receipts, paymentVouchers, journals, banks, reconciliations } = app

  const [report, setReport] = useState<ReportId | null>(forcedReport ?? null)
  const [ledgerAccount, setLedgerAccount] = useState('')
  const [checkAccount, setCheckAccount] = useState('')
  const [subLedgerAccount, setSubLedgerAccount] = useState('')
  const [q, setQ] = useState('')
  /** Expand the report list so every row shows at once. */
  const [showAll, setShowAll] = useState(false)

  /** Receipt/Payment Analysis Book filters — pending values commit on Refresh. */
  const curYear = String(new Date().getFullYear())
  const [aYear, setAYear] = useState(curYear)
  const [aMonth, setAMonth] = useState('')
  const [aType, setAType] = useState('')
  const [aBank, setABank] = useState('')
  const [aApplied, setAApplied] = useState({ year: curYear, month: '', type: '', bank: '' })
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [exportRows, setExportRows] = useState<ExportRow[]>([])
  useEffect(() => {
    setExportRows(tableToRows(bodyRef.current))
  }, [report, aApplied, ledgerAccount, checkAccount, subLedgerAccount])

  /** With no search text the first ten reports fill the window; the rest are
   *  reached by scrolling or by narrowing with the search box. */
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? STATEMENT_REPORTS.filter((r) => r.label.toLowerCase().includes(t)) : STATEMENT_REPORTS
  }, [q])

  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const live = useMemo(() => ({
    receipts: receipts.filter((r) => r.status !== 'void'),
    payments: paymentVouchers.filter((p) => p.status !== 'void'),
    journals: journals.filter((j) => j.status !== 'void'),
  }), [receipts, paymentVouchers, journals])

  /** debit/credit totals per account across receipts, payments and journals. */
  const activity = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>()
    const add = (id: string, d: number, c: number) => {
      const e = map.get(id) ?? { debit: 0, credit: 0 }
      e.debit += d
      e.credit += c
      map.set(id, e)
    }
    for (const r of live.receipts) {
      add(r.depositAccountId, r.amount, 0)
      for (const l of r.lines || []) add(l.accountId, 0, l.amount)
    }
    for (const p of live.payments) {
      add(p.paymentAccountId, 0, p.amount)
      for (const l of p.lines || []) add(l.accountId, l.amount, 0)
    }
    for (const j of live.journals) for (const l of j.lines) add(l.accountId, l.debit, l.credit)
    return map
  }, [live])

  /** Deposit/payment accounts in use — offered as Bank Options. */
  const bankOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const r of live.receipts) ids.add(r.depositAccountId)
    for (const p of live.payments) ids.add(p.paymentAccountId)
    return accounts.filter((a) => ids.has(a.id))
  }, [live, accounts])

  const yearOptions = useMemo(() => {
    const ys = new Set<string>([curYear])
    for (const r of live.receipts) ys.add(r.date.slice(0, 4))
    for (const p of live.payments) ys.add(p.date.slice(0, 4))
    return [...ys].sort().reverse()
  }, [live, curYear])

  /** Per-account receipt/payment totals honouring the applied analysis filters. */
  const analysis = useMemo(() => {
    const inScope = (date: string, acc: string) => {
      if (aApplied.year && !date.startsWith(aApplied.year)) return false
      if (aApplied.month && date.slice(5, 7) !== aApplied.month) return false
      if (aApplied.bank && acc !== aApplied.bank) return false
      return true
    }
    const map = new Map<string, { rec: number; pay: number }>()
    const add = (id: string, rec: number, pay: number) => {
      const e = map.get(id) ?? { rec: 0, pay: 0 }
      e.rec += rec
      e.pay += pay
      map.set(id, e)
    }
    if (aApplied.type !== 'payment') for (const r of live.receipts) if (inScope(r.date, r.depositAccountId)) for (const l of r.lines || []) add(l.accountId, l.amount, 0)
    if (aApplied.type !== 'receipt') for (const p of live.payments) if (inScope(p.date, p.paymentAccountId)) for (const l of p.lines || []) add(l.accountId, 0, l.amount)
    return map
  }, [live, aApplied])

  const balanceOf = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    const e = activity.get(id)
    const net = (e?.debit ?? 0) - (e?.credit ?? 0)
    if (a && (a.type === 'liability' || a.type === 'equity' || a.type === 'income')) return -net
    return net
  }

  const cashEntries = useMemo(() => {
    const rows: { date: string; no: string; party: string; inn: number; out: number }[] = []
    for (const r of live.receipts) if (r.method === 'cash') rows.push({ date: r.date, no: r.number, party: r.receivedFrom, inn: r.amount, out: 0 })
    for (const p of live.payments) if (p.method === 'cash') rows.push({ date: p.date, no: p.number, party: p.paidTo, inn: 0, out: p.amount })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [live])

  const bankEntries = useMemo(() => {
    // acct/kind ride along so the Year · Month · Type · Bank Options
    // parameters can narrow the Bank Book.
    const rows: { date: string; no: string; party: string; inn: number; out: number; acct: string; kind: 'receipt' | 'payment' }[] = []
    for (const r of live.receipts) if (r.method !== 'cash') rows.push({ date: r.date, no: r.number, party: r.receivedFrom, inn: r.amount, out: 0, acct: r.depositAccountId, kind: 'receipt' })
    for (const p of live.payments) if (p.method !== 'cash') rows.push({ date: p.date, no: p.number, party: p.paidTo, inn: 0, out: p.amount, acct: p.paymentAccountId, kind: 'payment' })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [live])

  /** Bank Book rows honouring the applied Year/Month/Type/Bank parameters. */
  const bankBookEntries = useMemo(() => bankEntries.filter((e) => {
    if (aApplied.year && !e.date.startsWith(aApplied.year)) return false
    if (aApplied.month && e.date.slice(5, 7) !== aApplied.month) return false
    if (aApplied.type && e.kind !== aApplied.type) return false
    if (aApplied.bank && e.acct !== aApplied.bank) return false
    return true
  }), [bankEntries, aApplied])

  const contributions = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const r of live.receipts) {
      const e = map.get(r.receivedFrom) ?? { count: 0, total: 0 }
      e.count++
      e.total += r.amount
      map.set(r.receivedFrom, e)
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [live])

  const ledgerRows = useMemo(() => {
    if (!ledgerAccount) return []
    const rows: { date: string; ref: string; debit: number; credit: number }[] = []
    for (const r of live.receipts) {
      if (r.depositAccountId === ledgerAccount) rows.push({ date: r.date, ref: `RCT ${r.number}`, debit: r.amount, credit: 0 })
      for (const l of r.lines || []) if (l.accountId === ledgerAccount) rows.push({ date: r.date, ref: `RCT ${r.number}`, debit: 0, credit: l.amount })
    }
    for (const p of live.payments) {
      if (p.paymentAccountId === ledgerAccount) rows.push({ date: p.date, ref: `PMT ${p.number}`, debit: 0, credit: p.amount })
      for (const l of p.lines || []) if (l.accountId === ledgerAccount) rows.push({ date: p.date, ref: `PMT ${p.number}`, debit: l.amount, credit: 0 })
    }
    for (const j of live.journals) for (const l of j.lines) if (l.accountId === ledgerAccount) rows.push({ date: j.date, ref: `JRN ${j.number}`, debit: l.debit, credit: l.credit })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [live, ledgerAccount])

  const runBalance = (rows: { date: string; no: string; party: string; inn: number; out: number }[]) => {
    let bal = 0
    return rows.map((r) => {
      bal += r.inn - r.out
      return { ...r, bal }
    })
  }

  const activeAccounts = accounts.filter((a) => activity.has(a.id))

  /**
   * Report parameters — Year · Month · Type · Bank Options, with Refresh
   * (commits the pending values) and Print. Shared by the Receipt/Payment
   * Analysis Book and the Bank Book so both are driven the same way.
   */
  const paramsPanel = (
              <div className="mb-6 max-w-xl space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <FRow label="Year">
                    <Select value={aYear} onChange={(e) => setAYear(e.target.value)}>
                      {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
                    </Select>
                  </FRow>
                  <button
                    type="button"
                    onClick={() => setAApplied({ year: aYear, month: aMonth, type: aType, bank: aBank })}
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#27ae60] px-4 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    <RefreshCw className="size-4" /> Refresh
                  </button>
                </div>
                <FRow label="Month">
                  <Select value={aMonth} onChange={(e) => setAMonth(e.target.value)} placeholder="Please Select...">
                    {MONTHS.map((m, i) => (<option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>))}
                  </Select>
                </FRow>
                <FRow label="Type">
                  <Select value={aType} onChange={(e) => setAType(e.target.value)} placeholder="Please Select...">
                    <option value="receipt">Receipt</option>
                    <option value="payment">Payment</option>
                  </Select>
                </FRow>
                <div className="flex flex-wrap items-center gap-4">
                  <FRow label="Bank Options">
                    <Select value={aBank} onChange={(e) => setABank(e.target.value)} placeholder="Please Select...">
                      {bankOptions.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </Select>
                  </FRow>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex h-10 min-w-24 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Print
                  </button>
                </div>
              </div>
  )

  const render = (): { title: string; node: ReactNode } => {
    switch (report) {
      case 'checkBalance': {
        const sel = accounts.find((a) => a.id === checkAccount)
        return {
          title: 'Check Balance',
          node: (
            <div>
              <div className="mb-4">
                <Field label="Account Name">
                  <Select value={checkAccount} onChange={(e) => setCheckAccount(e.target.value)} placeholder="Please Select...">
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <div className="flex h-11 flex-[2] items-center rounded-sm bg-[#231f20] px-4 text-sm font-bold text-white">
                  Balance As At {todayIso} (yyyy-mm-dd)
                </div>
                <div className="flex h-11 flex-1 items-center justify-end rounded-sm bg-[#2e75b6] px-4 text-sm font-bold text-white">
                  {sel ? balanceOf(sel.id).toFixed(2) : '0.00'}
                </div>
              </div>
            </div>
          ),
        }
      }
      case 'receivables': {
        const rows = accounts
          .filter((a) => a.type === 'asset' && balanceOf(a.id) > 0)
          .map((a) => [a.code, <span className="font-semibold">{a.name}</span>, formatGhs(balanceOf(a.id))])
        return {
          title: 'Other Receivables Balance(s)',
          node: rows.length
            ? <T head={['Code', 'Account', 'Outstanding']} right={[2]} rows={rows} />
            : <Empty title="No receivable balances" desc="Asset accounts with outstanding balances appear here." />,
        }
      }
      case 'analysis': {
        const rows = accounts
          .filter((a) => keepAccountRow(frPrefs, (analysis.get(a.id)?.rec ?? 0) - (analysis.get(a.id)?.pay ?? 0)))
          .map((a) => {
            const e = analysis.get(a.id) || { rec: 0, pay: 0 }
            return [
              <span className="font-semibold">{a.name}</span>,
              formatGhs(e.rec),
              formatGhs(e.pay),
              <span className={e.rec - e.pay < 0 ? 'text-ember' : ''}>{formatGhs(Math.abs(e.rec - e.pay))}{e.rec - e.pay < 0 ? ' DR' : ' CR'}</span>,
            ]
          })
        return {
          title: 'Receipt/Payment Analysis Book',
          node: (
            <div>
              {paramsPanel}
              {rows.length
                ? <T head={['Account', 'Receipts', 'Payments', 'Net']} right={[1, 2, 3]} rows={rows} />
                : <Empty title="No entries for the selected filters" desc="Adjust the year, month, type or bank option and press Refresh." />}
            </div>
          ),
        }
      }
      case 'cashBook': {
        const rows = runBalance(cashEntries).map((r) => [dFmt(r.date), r.no, r.party, r.inn ? formatGhs(r.inn) : '—', r.out ? formatGhs(r.out) : '—', <span className="font-semibold">{formatGhs(r.bal)}</span>])
        return {
          title: 'Cash Book',
          node: rows.length ? <T head={['Date', 'Voucher', 'Party', 'Receipts', 'Payments', 'Balance']} right={[3, 4, 5]} rows={rows} /> : <Empty title="No cash transactions" desc="Cash receipts and payments appear here." />,
        }
      }
      case 'bankBook': {
        const rows = runBalance(bankBookEntries).map((r) => [dFmt(r.date), r.no, r.party, r.inn ? formatGhs(r.inn) : '—', r.out ? formatGhs(r.out) : '—', <span className="font-semibold">{formatGhs(r.bal)}</span>])
        return {
          title: 'Bank Book',
          node: (
            <div>
              {paramsPanel}
              {rows.length
                ? <T head={['Date', 'Voucher', 'Party', 'Deposits', 'Withdrawals', 'Balance']} right={[3, 4, 5]} rows={rows} />
                : <Empty title="No entries for the selected filters" desc="Adjust the year, month, type or bank option and press Refresh." />}
            </div>
          ),
        }
      }
      case 'reconciliation': {
        const rows = reconciliations.map((rc) => {
          const bank = banks.find((b) => b.id === rc.bankAccountId)
          return [
            <span className="font-semibold">{bank?.name ?? '—'}</span>,
            dFmt(rc.statementDate),
            formatGhs(rc.startingBalance ?? 0),
            formatGhs(rc.statementBalance),
            formatGhs(rc.bookBalance),
            <span className={rc.difference !== 0 ? 'text-ember' : 'text-lime-600 dark:text-lime'}>{formatGhs(rc.difference)}</span>,
            rc.status,
          ]
        })
        return {
          title: 'Bank Reconciliation',
          node: rows.length ? <T head={['Bank Account', 'Statement Date', 'Starting', 'Statement', 'Book', 'Difference', 'Status']} right={[2, 3, 4, 5]} rows={rows} /> : <Empty title="No reconciliations yet" desc="Run a bank reconciliation to see it here." />,
        }
      }
      case 'contribution': {
        const rows = contributions.map(([who, v], i) => [String(i + 1), <span className="font-semibold">{who}</span>, String(v.count), formatGhs(v.total)])
        return {
          title: 'Contribution Per Head',
          node: rows.length ? <T head={['S/No.', 'Contributor', 'Receipts', 'Total']} right={[2, 3]} rows={rows} /> : <Empty title="No contributions yet" desc="Receipts grouped per contributor appear here." />,
        }
      }
      case 'listAccounts':
        return {
          title: 'List of Accounts',
          node: <T head={['Code', 'Account', 'Type']} rows={accounts.filter((a) => keepAccountRow(frPrefs, balanceOf(a.id))).map((a) => [a.code, <span className="font-semibold">{a.name}</span>, a.type])} />,
        }
      case 'ledger': {
        let bal = 0
        const acc = accounts.find((a) => a.id === ledgerAccount)
        const sign = acc && (acc.type === 'liability' || acc.type === 'equity' || acc.type === 'income') ? -1 : 1
        const rows = ledgerRows.map((r) => {
          bal += sign * (r.debit - r.credit)
          return [dFmt(r.date), r.ref, r.debit ? formatGhs(r.debit) : '—', r.credit ? formatGhs(r.credit) : '—', <span className="font-semibold">{formatGhs(bal)}</span>]
        })
        return {
          title: `Ledger${acc ? ` — ${acc.name}` : ''}`,
          node: (
            <div>
              <div className="mb-3 max-w-sm">
                <Field label="Account">
                  <Select value={ledgerAccount} onChange={(e) => setLedgerAccount(e.target.value)} placeholder="Select account…">
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </Select>
                </Field>
              </div>
              {ledgerAccount
                ? rows.length ? <T head={['Date', 'Voucher', 'Debit', 'Credit', 'Balance']} right={[2, 3, 4]} rows={rows} /> : <Empty title="No entries for this account" desc="Posted vouchers touching the account appear here." />
                : <Empty title="Select an account" desc="Pick an account above to open its ledger." />}
            </div>
          ),
        }
      }
      case 'subLedger': {
        const acc = accounts.find((a) => a.id === subLedgerAccount)
        const rows: { date: string; ref: string; party: string; debit: number; credit: number }[] = []
        if (subLedgerAccount) {
          for (const r of live.receipts) {
            if (r.depositAccountId === subLedgerAccount) rows.push({ date: r.date, ref: `RCT ${r.number}`, party: r.receivedFrom, debit: r.amount, credit: 0 })
            for (const l of r.lines || []) if (l.accountId === subLedgerAccount) rows.push({ date: r.date, ref: `RCT ${r.number}`, party: r.receivedFrom, debit: 0, credit: l.amount })
          }
          for (const p of live.payments) {
            if (p.paymentAccountId === subLedgerAccount) rows.push({ date: p.date, ref: `PMT ${p.number}`, party: p.paidTo, debit: 0, credit: p.amount })
            for (const l of p.lines || []) if (l.accountId === subLedgerAccount) rows.push({ date: p.date, ref: `PMT ${p.number}`, party: p.paidTo, debit: l.amount, credit: 0 })
          }
          for (const j of live.journals) for (const l of j.lines) if (l.accountId === subLedgerAccount) rows.push({ date: j.date, ref: `JRN ${j.number}`, party: j.stakeholder || j.description || '—', debit: l.debit, credit: l.credit })
          rows.sort((a, b) => a.date.localeCompare(b.date))
        }
        let bal = 0
        const sign = acc && (acc.type === 'liability' || acc.type === 'equity' || acc.type === 'income') ? -1 : 1
        const trows = rows.map((r) => {
          bal += sign * (r.debit - r.credit)
          return [dFmt(r.date), r.ref, r.party, r.debit ? formatGhs(r.debit) : '—', r.credit ? formatGhs(r.credit) : '—', <span className="font-semibold">{formatGhs(bal)}</span>]
        })
        return {
          title: `Sub-Ledger${acc ? ` — ${acc.name}` : ''}`,
          node: (
            <div>
              <div className="mb-3 max-w-sm">
                <Field label="Account">
                  <Select value={subLedgerAccount} onChange={(e) => setSubLedgerAccount(e.target.value)} placeholder="Please Select...">
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </Select>
                </Field>
              </div>
              {subLedgerAccount
                ? trows.length ? <T head={['Date', 'Voucher', 'Party', 'Debit', 'Credit', 'Balance']} right={[3, 4, 5]} rows={trows} /> : <Empty title="No entries for this account" desc="Posted vouchers touching the account appear here." />
                : <Empty title="Select an account" desc="Pick an account above to open its sub-ledger with parties." />}
            </div>
          ),
        }
      }
      case 'generalLedger': {
        const rows = accounts
          .filter((a) => keepAccountRow(frPrefs, balanceOf(a.id)))
          .map((a) => {
            const e = activity.get(a.id)
            return [a.code, <span className="font-semibold">{a.name}</span>, formatGhs(e?.debit ?? 0), formatGhs(e?.credit ?? 0), <span className="font-semibold">{formatGhs(Math.abs(balanceOf(a.id)))}{balanceOf(a.id) < 0 ? ' CR' : ' DR'}</span>]
          })
        return {
          title: 'General Ledger',
          node: rows.length
            ? <T head={['Code', 'Account', 'Total Debit', 'Total Credit', 'Balance']} right={[2, 3, 4]} rows={rows} />
            : <Empty title="No ledger activity yet" desc="Post vouchers to see account totals here." />,
        }
      }
      case 'generalJournal': {
        const rows: ReactNode[][] = []
        for (const j of [...live.journals].sort((a, b) => a.date.localeCompare(b.date))) {
          j.lines.forEach((l, i) => {
            rows.push([
              i === 0 ? dFmt(j.date) : '',
              i === 0 ? `JRN ${j.number}` : '',
              i === 0 ? <span title={j.description}>{j.description || '—'}</span> : '',
              accountName(accounts, l.accountId),
              l.debit ? formatGhs(l.debit) : '',
              l.credit ? formatGhs(l.credit) : '',
            ])
          })
        }
        return {
          title: 'General Journal',
          node: rows.length
            ? <T head={['Date', 'Voucher', 'Description', 'Account', 'Debit', 'Credit']} right={[4, 5]} rows={rows} />
            : <Empty title="No journal entries" desc="Posted journal vouchers appear here chronologically." />,
        }
      }
      default:
        return { title: '', node: null }
    }
  }

  const current = report ? render() : null

  const body = current && (
    <>
      <ReportPrintSheet title={current.title}>{current.node}</ReportPrintSheet>
      <h2 className="mb-4 flex items-center gap-2.5 border-b border-line pb-3 text-2xl font-semibold text-[#2e75b6] dark:text-sky-300">
        {report === 'checkBalance' ? <LayoutGrid className="size-6 shrink-0" /> : <BookMarked className="size-6 shrink-0" />}
        {current.title}
      </h2>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-bold text-white transition hover:brightness-110"
        >
          Print
        </button>
        {exportRows.length > 0 && <ExportButtons filename={`statements-${report}`} rows={exportRows} compact />}
      </div>
      <div ref={bodyRef}>{current.node}</div>
    </>
  )

  /** Composed inside Accounts Reports — right-pane content only. */
  if (bodyOnly) return <div>{body}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Statements/Ledgers</h1>
        <p className="mt-1 text-sm text-mist">
          {`Accounting reports — pick one on the left to view it here. ${STATEMENT_REPORTS.length} reports in total.`}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="ml-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-line bg-white px-2.5 text-xs font-semibold text-[#1a56b0] transition hover:bg-[#2e75b6] hover:text-white dark:bg-white/[0.04] dark:text-sky-300"
          >
            {showAll ? 'Show compact list' : 'Show all at once'}
          </button>
        </p>
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card flex flex-col self-start overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SearchField value={q} onChange={setQ} placeholder="Search reports…" />
          </div>
          <div className={`${showAll ? '' : 'max-h-[406px] '}flex-1 divide-y divide-line overflow-y-auto overscroll-contain`}>
            {visible.map((r) => {
              const active = report === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReport(r.id)}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'flex h-[58px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 px-4 text-left transition ' +
                    (active ? 'bg-[#2e75b6] text-white' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]')
                  }
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    {r.grid ? <LayoutGrid className={`size-4 shrink-0 ${active ? 'text-white' : 'text-mist'}`} /> : <BookMarked className={`size-4 shrink-0 ${active ? 'text-white' : 'text-mist'}`} />}
                    {r.label}
                  </span>
                  <span className={`pl-[26px] text-[10px] leading-tight ${active ? 'text-white/80' : 'text-mist'}`}>{r.desc}</span>
                </button>
              )
            })}
            {visible.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-mist">No reports match “{q}”.</div>
            )}
          </div>
        </div>

        <div className="card min-h-[420px] p-5">
          {!current ? (
            <h2 className="flex items-center gap-2 border-b border-line pb-3 text-2xl font-semibold text-[#2e75b6] dark:text-sky-300">
              <ChevronLeft className="size-6" /> Reports: Make a selection
            </h2>
          ) : (
            body
          )}
        </div>
      </div>
    </div>
  )
}
