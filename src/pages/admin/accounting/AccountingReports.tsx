import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, BookMarked, ChevronLeft, RefreshCw } from 'lucide-react'
import { Field, Select, Empty, SearchField, DatePicker, MultiSelect, Modal } from '../../../components/ui'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { tableToRows } from '../../../lib/tableExport'
import type { ExportRow } from '../../../lib/export'
import type { ReceiptVoucher, PaymentVoucher, JournalVoucher } from '../../../types'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { formatGhs, formatGhsExact, curTitle } from '../../../lib/utils'
import { accountName, ACCOUNT_TYPE_DEFS } from '../../../lib/accounting'
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
  { id: 'cashBook', label: 'Cash Book', desc: 'Cash receipts and payments with running balance.' },
  { id: 'bankBook', label: 'Bank Book', desc: 'Bank deposits and withdrawals with running balance.' },
  { id: 'reconciliation', label: 'Bank Reconciliation', desc: 'Compares bank statements with book balances.' },
  { id: 'listAccounts', label: 'List of Accounts', desc: 'The full chart of accounts.' },
  { id: 'subLedger', label: 'Sub-Ledger', desc: 'Account entries broken down by party.' },
  { id: 'generalLedger', label: 'General Ledger', desc: 'Debit, credit and balance totals per account.' },
  { id: 'ledger', label: 'Ledger Summary', desc: 'Detailed entries and balance for one account.' },
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

/** Quick date-range presets for the report "Period" selector. */
export const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'currentWeek', label: 'Current Week' },
  { value: 'currentMonth', label: 'Current Month' },
  { value: 'currentYear', label: 'Current Year' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'last2Week', label: 'Last 2 Week' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last180', label: 'Last 180 Days' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3Month', label: 'Last 3 Month' },
  { value: 'last6Month', label: 'Last 6 Month' },
  { value: 'last1Year', label: 'Last 1 Year' },
]

/** Resolve a Period preset into an inclusive { from, to } pair of ISO (YYYY-MM-DD) dates. */
export function periodRange(key: string): { from: string; to: string } | null {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x } // Monday
  switch (key) {
    case 'currentWeek': return { from: iso(startOfWeek(today)), to: iso(today) }
    case 'currentMonth': return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }
    case 'currentYear': return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) }
    case 'lastWeek': { const sow = startOfWeek(today); return { from: iso(addDays(sow, -7)), to: iso(addDays(sow, -1)) } }
    case 'last2Week': return { from: iso(addDays(today, -14)), to: iso(today) }
    case 'last30': return { from: iso(addDays(today, -30)), to: iso(today) }
    case 'last180': return { from: iso(addDays(today, -180)), to: iso(today) }
    case 'lastMonth': return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) }
    case 'last3Month': return { from: iso(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())), to: iso(today) }
    case 'last6Month': return { from: iso(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())), to: iso(today) }
    case 'last1Year': return { from: iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())), to: iso(today) }
    default: return null
  }
}

/** Bordered label cell attached to a filter control, as in the analysis book mock. */
function FRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-md items-stretch">
      <span className="flex shrink-0 items-center whitespace-nowrap rounded-l-md border border-r-0 border-line bg-black/[0.02] px-3 text-sm font-bold dark:bg-white/[0.04]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}


export function AccountingReportsPage({
  forcedReport = null,
  bodyOnly = false,
  embedded = false,
}: {
  /** Preselect this report on mount. */
  forcedReport?: ReportId | null
  /** Render only the report body, for composition inside Accounts Reports. */
  bodyOnly?: boolean
  /** Embedded in another page (e.g. All Reports): move report actions inline into the filter row. */
  embedded?: boolean
} = {}) {
  const app = useApp()
  const navigate = useNavigate()
  const { user } = useAuth()
  /** Financial Reporting Preferences — read live so toggles apply immediately. */
  const frPrefs = resolveFinPrefs(app.accountingSettings)
  const { accounts, receipts, paymentVouchers, journals, banks, reconciliations } = app

  const [report, setReport] = useState<ReportId | null>(forcedReport ?? null)
  const [ledgerAccounts, setLedgerAccounts] = useState<string[]>([])
  const [checkAccount, setCheckAccount] = useState('')
  const [subLedgerAccounts, setSubLedgerAccounts] = useState<string[]>([])
  /** List of Accounts output selector: '' | 'list' | 'opening' | 'fixedOpening'. */
  const [listOption, setListOption] = useState('list')
  /** Ledger filters — date range and print mode (all / debit / credit). */
  const [ledgerPeriod, setLedgerPeriod] = useState('')
  const [ledgerFrom, setLedgerFrom] = useState('')
  const [ledgerTo, setLedgerTo] = useState('')
  // Applied Ledger Summary filters — the report only regenerates from these when "Generate" is pressed.
  const [ledgerAppAccounts, setLedgerAppAccounts] = useState<string[]>([])
  const [ledgerAppFrom, setLedgerAppFrom] = useState('')
  const [ledgerAppTo, setLedgerAppTo] = useState('')
  /** True once "Generate" has been pressed for the Ledger Summary. */
  const [ledgerGenerated, setLedgerGenerated] = useState(false)
  /** Ledger Summary display options (see the sample sheet): prefix each line
   *  with its account code, and drop accounts with no balance or movement. */
  const [ledgerShowCodes, setLedgerShowCodes] = useState(true)
  const [ledgerHideZero, setLedgerHideZero] = useState(true)
  /** Sub-Ledger filters — date range, print mode, sub-account (party) and detail/summary view. */
  const [subLedgerPeriod, setSubLedgerPeriod] = useState('')
  const [subLedgerFrom, setSubLedgerFrom] = useState('')
  const [subLedgerTo, setSubLedgerTo] = useState('')
  const [subLedgerClass, setSubLedgerClass] = useState('')
  const [subLedgerNames, setSubLedgerNames] = useState<string[]>([])
  const [subLedgerView, setSubLedgerView] = useState<'detail' | 'summary'>('detail')
  // Applied Sub-Ledger filters — the report only regenerates from these when "Generate" is pressed.
  const [subLedgerAppAccounts, setSubLedgerAppAccounts] = useState<string[]>([])
  const [subLedgerAppFrom, setSubLedgerAppFrom] = useState('')
  const [subLedgerAppTo, setSubLedgerAppTo] = useState('')
  const [subLedgerAppClass, setSubLedgerAppClass] = useState('')
  const [subLedgerAppNames, setSubLedgerAppNames] = useState<string[]>([])
  /** General Ledger filters — date range and detail/summary view. */
  const [glPeriod, setGlPeriod] = useState('')
  const [glFrom, setGlFrom] = useState('')
  const [glTo, setGlTo] = useState('')
  const [glAccounts, setGlAccounts] = useState<string[]>([])
  // Applied General Ledger filters — the report only regenerates from these when "Generate" is pressed.
  const [glAppFrom, setGlAppFrom] = useState('')
  const [glAppTo, setGlAppTo] = useState('')
  const [glAppAccounts, setGlAppAccounts] = useState<string[]>([])
  const [glCollapsed, setGlCollapsed] = useState<Record<string, boolean>>({})
  const [glPage, setGlPage] = useState(1)
  /** General Journal filters — date range. */
  const [gjPeriod, setGjPeriod] = useState('')
  const [gjFrom, setGjFrom] = useState('')
  const [gjTo, setGjTo] = useState('')
  /** Which books feed the General Journal: '' = every double entry (modern
      audit view), 'journal' = journal vouchers only (the strict traditional
      General Journal, since cash/bank have their own books of prime entry),
      'cashbank' = receipts and payments only. */
  const [gjSource, setGjSource] = useState('')
  /** APPLIED General Journal dates/source — committed on Generate, like the General Ledger. */
  const [gjAppFrom, setGjAppFrom] = useState('')
  const [gjAppTo, setGjAppTo] = useState('')
  const [gjAppSource, setGjAppSource] = useState('')
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
  /**
   * Bank Book filters. "Method" chooses HOW the period is narrowed:
   *  - 'month' → by Year + Month
   *  - 'date'  → by a From/To date range
   * Values commit on Refresh.
   */
  const [bkMode, setBkMode] = useState('')
  const [bkYear, setBkYear] = useState(curYear)
  const [bkMonth, setBkMonth] = useState('')
  const [bkFrom, setBkFrom] = useState('')
  const [bkTo, setBkTo] = useState('')
  const [bkAccount, setBkAccount] = useState('')
  /** Bank Book Type filter: '' = all, 'receipt' | 'payment' | 'journal' — mirrors the Cash Book. */
  const [bkType, setBkType] = useState('')
  const [bkApplied, setBkApplied] = useState({ mode: '', year: curYear, month: '', from: '', to: '', account: '', type: '' })
  /** Bank Book only shows rows after Generate is pressed. */
  const [bkGenerated, setBkGenerated] = useState(false)
  /** Cash Book filters — same Method (Month/Date) model as the Bank Book, minus the bank account. */
  const [cbMode, setCbMode] = useState('')
  const [cbYear, setCbYear] = useState(curYear)
  const [cbMonth, setCbMonth] = useState('')
  const [cbFrom, setCbFrom] = useState('')
  const [cbTo, setCbTo] = useState('')
  const [cbAccount, setCbAccount] = useState('')
  /** Cash Book Type filter: '' = both, 'receipt' = receipts only, 'payment' = payments only. */
  const [cbType, setCbType] = useState('')
  const [cbApplied, setCbApplied] = useState({ mode: '', year: curYear, month: '', from: '', to: '', account: '', type: '' })
  /** Cash Book only shows rows after Generate is pressed. */
  const [cbGenerated, setCbGenerated] = useState(false)
  /** Cash Book: voucher whose detail is shown in the pop-up modal (clicked Voucher No.). */
  const [cbView, setCbView] = useState<{ kind: 'receipt' | 'payment' | 'journal'; id: string } | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [exportRows, setExportRows] = useState<ExportRow[]>([])
  useEffect(() => {
    setExportRows(tableToRows(bodyRef.current))
  }, [report, aApplied, cbApplied, bkApplied, ledgerPeriod, ledgerAccounts, ledgerFrom, ledgerTo, ledgerAppAccounts, ledgerAppFrom, ledgerAppTo, ledgerGenerated, ledgerShowCodes, ledgerHideZero, checkAccount, subLedgerPeriod, subLedgerAccounts, subLedgerFrom, subLedgerTo, subLedgerClass, subLedgerNames, subLedgerView, subLedgerAppAccounts, subLedgerAppFrom, subLedgerAppTo, subLedgerAppClass, subLedgerAppNames, glPeriod, glFrom, glTo, glAccounts, glAppFrom, glAppTo, glAppAccounts, glCollapsed, glPage, gjPeriod, gjFrom, gjTo, gjSource, gjAppFrom, gjAppTo, gjAppSource, listOption])

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

  /** Bank Book Account options = chart accounts whose Type is "Bank"
      (detailType 'Bank' / accountTypeId 16), regardless of transaction activity. */
  const bankBookAccountOptions = useMemo(
    () => accounts.filter((a) => a.status !== 'inactive' && (a.accountTypeId === 16 || (a.detailType || '').toLowerCase() === 'bank')),
    [accounts],
  )

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

  /** Accounts classified as Cash & Cash Equivalents (accountTypeId 3, e.g. cash on
      hand / petty cash). The Cash Book is the ledger of these accounts, so EVERY
      transaction that touches them appears — regardless of the payment method. */
  const cashAcctIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of accounts) {
      const dt = (a.detailType || '').toLowerCase()
      if (a.accountTypeId === 3 || dt.includes('cash and cash equivalent') || dt === 'cash on hand' || dt === 'petty cash') ids.add(a.id)
    }
    return ids
  }, [accounts])

  const cashEntries = useMemo(() => {
    // The Cash Book lists ALL transactions involving cash & cash-equivalents
    // accounts — receipts deposited to cash, payments made from cash, AND journal
    // entries that debit/credit a cash account — regardless of payment method.
    // kind + acct ride along so the Type and Account parameters can narrow the book.
    // id + kind let the Voucher No. link back to the source voucher for editing.
    const rows: { id: string; date: string; no: string; party: string; inn: number; out: number; kind: 'receipt' | 'payment' | 'journal'; acct: string; desc: string }[] = []
    for (const r of live.receipts) if (cashAcctIds.has(r.depositAccountId)) rows.push({ id: r.id, date: r.date, no: r.number, party: r.receivedFrom, inn: r.amount, out: 0, kind: 'receipt', acct: r.depositAccountId, desc: r.description || r.lines?.[0]?.narration || r.receivedFrom || '' })
    for (const p of live.payments) if (cashAcctIds.has(p.paymentAccountId)) rows.push({ id: p.id, date: p.date, no: p.number, party: p.paidTo, inn: 0, out: p.amount, kind: 'payment', acct: p.paymentAccountId, desc: p.description || p.lines?.[0]?.narration || p.paidTo || '' })
    for (const j of live.journals) for (const l of j.lines) if (cashAcctIds.has(l.accountId) && (l.debit || l.credit)) rows.push({ id: j.id, date: j.date, no: j.number, party: j.stakeholder || j.description || 'Journal entry', inn: l.debit || 0, out: l.credit || 0, kind: 'journal', acct: l.accountId, desc: j.description || '' })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [live, cashAcctIds])

  /** Cash accounts actually used by cash transactions — offered as the Cash Book Account options. */
  const cashOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const e of cashEntries) ids.add(e.acct)
    return accounts.filter((a) => ids.has(a.id))
  }, [cashEntries, accounts])


  /** Cash Book rows honouring the applied Method (Month/Date) and period — committed on Generate. */
  const cashBookEntries = useMemo(() => cashEntries.filter((e) => {
    if (cbApplied.type && e.kind !== cbApplied.type) return false
    if (cbApplied.account && e.acct !== cbApplied.account) return false
    if (cbApplied.mode === 'month') {
      if (cbApplied.year && !e.date.startsWith(cbApplied.year)) return false
      if (cbApplied.month && e.date.slice(5, 7) !== cbApplied.month) return false
    } else if (cbApplied.mode === 'date') {
      if (cbApplied.from && e.date < cbApplied.from) return false
      if (cbApplied.to && e.date > cbApplied.to) return false
    }
    return true
  }), [cashEntries, cbApplied])

  /** Cash Book opening balance = net cash movements strictly before the applied
      period start, honouring the applied Account and Type filters. Mirrors the
      opening balance shown in the printed Cash Book so the on-screen Opening /
      Closing Balance rows agree with the print. */
  const cbOpening = useMemo(() => {
    let from = ''
    if (cbApplied.mode === 'month') {
      const y = cbApplied.year || curYear
      from = cbApplied.month ? `${y}-${cbApplied.month}-01` : `${y}-01-01`
    } else if (cbApplied.mode === 'date') {
      from = cbApplied.from
    }
    if (!from) return 0
    let opening = 0
    for (const e of cashEntries) {
      if (cbApplied.type && e.kind !== cbApplied.type) continue
      if (cbApplied.account && e.acct !== cbApplied.account) continue
      if (e.date < from) opening += e.inn - e.out
    }
    return opening
  }, [cashEntries, cbApplied, curYear])

  /** Bank & bank-equivalent accounts (Type "Bank", incl. mobile money) — used to pull
      journal entries into the Bank Book, mirroring how cashAcctIds feeds the Cash Book. */
  const bankAcctIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of accounts) {
      const dt = (a.detailType || '').toLowerCase()
      if (a.accountTypeId === 16 || dt.includes('bank') || dt.includes('momo') || dt.includes('mobile money')) ids.add(a.id)
    }
    return ids
  }, [accounts])

  const bankEntries = useMemo(() => {
    // kind + acct ride along so the Type and Account parameters can narrow the Bank Book.
    // Like the Cash Book, journal entries that touch a bank account are included too.
    const rows: { id: string; date: string; no: string; party: string; inn: number; out: number; kind: 'receipt' | 'payment' | 'journal'; acct: string; desc: string }[] = []
    for (const r of live.receipts) if (r.method !== 'cash' && r.status !== 'void') rows.push({ id: r.id, date: r.date, no: r.number, party: r.receivedFrom, inn: r.amount, out: 0, kind: 'receipt', acct: r.depositAccountId, desc: r.description || r.lines?.[0]?.narration || r.receivedFrom || '' })
    for (const p of live.payments) if (p.method !== 'cash' && p.status !== 'void') rows.push({ id: p.id, date: p.date, no: p.number, party: p.paidTo, inn: 0, out: p.amount, kind: 'payment', acct: p.paymentAccountId, desc: p.description || p.lines?.[0]?.narration || p.paidTo || '' })
    for (const j of live.journals) for (const l of j.lines) if (bankAcctIds.has(l.accountId) && (l.debit || l.credit)) rows.push({ id: j.id, date: j.date, no: j.number, party: j.stakeholder || j.description || 'Journal entry', inn: l.debit || 0, out: l.credit || 0, kind: 'journal', acct: l.accountId, desc: j.description || '' })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [live, bankAcctIds])

  /** Bank Book rows honouring the applied Method (Month/Date), period and Account — committed on Generate. */
  const bankBookEntries = useMemo(() => bankEntries.filter((e) => {
    // Type is direction-based for the Bank Book: Deposits = money into the bank
    // account (debit), Withdrawals = money out (credit). Receipts, payments and
    // journal lines all qualify on whichever side they fall.
    if (bkApplied.type === 'deposit' && !(e.inn > 0)) return false
    if (bkApplied.type === 'withdrawal' && !(e.out > 0)) return false
    if (bkApplied.account && e.acct !== bkApplied.account) return false
    if (bkApplied.mode === 'month') {
      if (bkApplied.year && !e.date.startsWith(bkApplied.year)) return false
      if (bkApplied.month && e.date.slice(5, 7) !== bkApplied.month) return false
    } else if (bkApplied.mode === 'date') {
      if (bkApplied.from && e.date < bkApplied.from) return false
      if (bkApplied.to && e.date > bkApplied.to) return false
    }
    return true
  }), [bankEntries, bkApplied])

  /** Bank Book opening balance = net bank movements strictly before the applied
      period start, honouring the applied Account filter. Mirrors the Cash Book so
      the on-screen Opening / Closing Balance rows behave the same way. */
  const bkOpening = useMemo(() => {
    let from = ''
    if (bkApplied.mode === 'month') {
      const y = bkApplied.year || curYear
      from = bkApplied.month ? `${y}-${bkApplied.month}-01` : `${y}-01-01`
    } else if (bkApplied.mode === 'date') {
      from = bkApplied.from
    }
    if (!from) return 0
    let opening = 0
    for (const e of bankEntries) {
      if (bkApplied.type === 'deposit' && !(e.inn > 0)) continue
      if (bkApplied.type === 'withdrawal' && !(e.out > 0)) continue
      if (bkApplied.account && e.acct !== bkApplied.account) continue
      if (e.date < from) opening += e.inn - e.out
    }
    return opening
  }, [bankEntries, bkApplied, curYear])

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


  function runBalance<R extends { inn: number; out: number }>(rows: R[], opening = 0): (R & { bal: number })[] {
    let bal = opening
    return rows.map((r) => {
      bal += r.inn - r.out
      return { ...r, bal }
    })
  }

  const activeAccounts = accounts.filter((a) => activity.has(a.id))

  /**
   * Report parameters — Year · Month · Type · Bank Options, with Refresh
   * (commits the pending values) and Print. Shared by the Receipt/Payment
   * Analysis Book, the Bank Book and the Cash Book so they are driven the same
   * way. `showBank` hides the Bank Options control for cash-only reports.
   */
  const paramsPanel = (showBank = true) => (
              <div className="mb-6 max-w-2xl space-y-4">
                {showBank ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex flex-wrap items-end gap-4">
                    <FRow label="Year">
                      <Select value={aYear} onChange={(e) => setAYear(e.target.value)}>
                        {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
                      </Select>
                    </FRow>
                    <FRow label="Month">
                      <Select value={aMonth} onChange={(e) => setAMonth(e.target.value)} placeholder="Please Select...">
                        {MONTHS.map((m, i) => (<option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>))}
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
                )}
              </div>
  )

  /**
   * Bank Book parameters. "Method" selects the period filter: Month (Year +
   * Month) or Date (From/To range). Laid out as Method + Refresh, then the
   * chosen period inputs, then Account + Print.
   */
  const bankParamsPanel = (
    <div className="mb-6 max-w-4xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FRow label="Method">
          <Select value={bkMode} onChange={(e) => setBkMode(e.target.value)} placeholder="Please Select...">
            <option value="month">Month</option>
            <option value="date">Date</option>
          </Select>
        </FRow>
        <FRow label="Type">
          <Select value={bkType} onChange={(e) => setBkType(e.target.value)} placeholder="Please Select...">
            <option value="">All</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
          </Select>
        </FRow>
        {bkMode === 'month' && (
          <>
            <FRow label="Year">
              <Select value={bkYear} onChange={(e) => setBkYear(e.target.value)}>
                {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
              </Select>
            </FRow>
            <FRow label="Month">
              <Select value={bkMonth} onChange={(e) => setBkMonth(e.target.value)} placeholder="Please Select...">
                {MONTHS.map((m, i) => (<option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>))}
              </Select>
            </FRow>
          </>
        )}
        {bkMode === 'date' && (
          <>
            <FRow label="From Date">
              <DatePicker value={bkFrom} onChange={setBkFrom} max={bkTo || undefined} placeholder="From date" />
            </FRow>
            <FRow label="To Date">
              <DatePicker value={bkTo} onChange={setBkTo} min={bkFrom || undefined} placeholder="To date" />
            </FRow>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <FRow label="Account">
          <Select value={bkAccount} onChange={(e) => setBkAccount(e.target.value)} placeholder="Please Select...">
            {bankBookAccountOptions.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </Select>
        </FRow>
        {(() => {
          // The Bank Book requires a period (Month, or a From/To range) AND an
          // Account before it can be Generated or Printed. Both buttons stay
          // disabled until those are chosen.
          const bankReady = !!bkAccount && (bkMode === 'month' ? !!bkMonth : bkMode === 'date' ? (!!bkFrom && !!bkTo) : false)
          return (
            <>
              <button
                type="button"
                disabled={!bankReady}
                onClick={() => { if (!bankReady) return; setBkApplied({ mode: bkMode, year: bkYear, month: bkMonth, from: bkFrom, to: bkTo, account: bkAccount, type: bkType }); setBkGenerated(true) }}
                title={bankReady ? 'Generate the bank book' : 'Select a Month (or From/To dates) and an Account first'}
                className={'inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-semibold text-white transition ' + (bankReady ? 'cursor-pointer bg-emerald-500 hover:brightness-110' : 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600')}
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => { setBkMode(''); setBkYear(curYear); setBkMonth(''); setBkFrom(''); setBkTo(''); setBkAccount(''); setBkType(''); setBkApplied({ mode: '', year: curYear, month: '', from: '', to: '', account: '', type: '' }); setBkGenerated(false) }}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!bankReady}
                onClick={() => { if (!bankReady) return; printBankBook() }}
                title={bankReady ? 'Print the bank book' : 'Select a Month (or From/To dates) and an Account first'}
                className={'inline-flex h-10 min-w-24 items-center justify-center rounded-md px-6 text-sm font-semibold text-white transition ' + (bankReady ? 'cursor-pointer bg-[#2e75b6] hover:brightness-110' : 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600')}
              >
                Print
              </button>
            </>
          )
        })()}
      </div>
      {!(!!bkAccount && (bkMode === 'month' ? !!bkMonth : bkMode === 'date' ? (!!bkFrom && !!bkTo) : false)) && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Select a Month (or a From Date and To Date) and an Account to generate or print the Bank Book.</p>
      )}
    </div>
  )

  /**
   * The General Journal as double entries: every receipt and payment expanded
   * into its Dr/Cr pair plus the manual journal vouchers, filtered by date and
   * source ('' = all, 'journal' = vouchers only, 'cashbank' = receipts/payments).
   * Shared by the on-screen table and the printable sheet so they never differ.
   */
  type GjEntry = { date: string; no: string; desc: string; lines: { accountId: string; debit: number; credit: number }[] }
  const buildGjEntries = (from: string, to: string, src: string): GjEntry[] => {
    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)
    const wantCashBank = src !== 'journal'
    const wantJournals = src !== 'cashbank'
    const entries: GjEntry[] = []
    for (const r of live.receipts) {
      if (!wantCashBank || !inRange(r.date)) continue
      const alloc = (r.lines || []).filter((l) => l.amount)
      // Dr the money (deposit) account, Cr each income/allocation line.
      entries.push({
        date: r.date,
        no: `RCT ${r.number}`,
        desc: r.description || r.receivedFrom || 'Receipt',
        lines: [
          { accountId: r.depositAccountId, debit: r.amount, credit: 0 },
          ...alloc.map((l) => ({ accountId: l.accountId, debit: 0, credit: l.amount })),
        ],
      })
    }
    for (const p of live.payments) {
      if (!wantCashBank || !inRange(p.date)) continue
      const alloc = (p.lines || []).filter((l) => l.amount)
      // Dr each expense/allocation line, Cr the money (payment) account.
      entries.push({
        date: p.date,
        no: `PMT ${p.number}`,
        desc: p.description || p.paidTo || 'Payment',
        lines: [
          ...alloc.map((l) => ({ accountId: l.accountId, debit: l.amount, credit: 0 })),
          { accountId: p.paymentAccountId, debit: 0, credit: p.amount },
        ],
      })
    }
    for (const j of live.journals) {
      if (!wantJournals || !inRange(j.date)) continue
      entries.push({
        date: j.date,
        no: `JRN ${j.number}`,
        desc: j.description || 'Journal entry',
        lines: j.lines.map((l) => ({ accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0 })),
      })
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no))
  }

  /**
   * Open a new browser tab with a formatted, printable Cash/Bank Book (grouped
   * by voucher, one line per allocation, running DR/CR balance and a Book
   * Summary), built from the currently applied filters. `isCash` selects the
   * Cash Book (method = cash) or the Bank Book (method ≠ cash).
   */
  const printBook = (isCash: boolean) => {
    const applied = isCash ? cbApplied : bkApplied
    const bookLabel = isCash ? 'CASH BOOK' : 'BANK BOOK'
    const inLabel = isCash ? 'Cash In (Debit)' : 'Deposits (Debit)'
    const outLabel = isCash ? 'Cash Out (Credit)' : 'Withdrawals (Credit)'
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const drcr = (n: number) => `${fmtNum(n)} ${n >= 0 ? 'DR' : 'CR'}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))

    // Resolve the reporting period from the applied filter.
    let from = ''
    let to = ''
    let periodTitle = bookLabel
    if (applied.mode === 'month') {
      const y = applied.year || curYear
      if (applied.month) {
        const mi = Number(applied.month)
        from = `${y}-${applied.month}-01`
        to = `${y}-${applied.month}-${String(new Date(Number(y), mi, 0).getDate()).padStart(2, '0')}`
        periodTitle = `${bookLabel} FOR ${MONTHS[mi - 1].toUpperCase()}, ${y}`
      } else {
        from = `${y}-01-01`
        to = `${y}-12-31`
        periodTitle = `${bookLabel} FOR ${y}`
      }
    } else if (applied.mode === 'date') {
      from = applied.from
      to = applied.to
      if (from || to) periodTitle = `${bookLabel} FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`
    }

    const acct = applied.account
    const acctMatch = (id: string) => !acct || id === acct
    const inPeriod = (d: string) => (!from || d >= from) && (!to || d <= to)
    // Cash Book Type filter: 'receipt' → list receipts only, 'payment' → list
    // payments only, '' → both. The Type filter narrows the voucher LISTING.
    // The Book Summary (opening, total receipt/payment, closing) is ALWAYS
    // computed from both receipts and payments (as if Type = All). The running
    // Balance column, however, mirrors the on-screen list table: it starts from
    // the opening balance restricted to the selected Type and only accumulates
    // the listed vouchers.
    // Cash Book Type is voucher-kind based (receipt/payment/journal); the Bank
    // Book Type is direction based (deposit/withdrawal) and is applied per line
    // so a journal that both debits and credits the bank shows only the side
    // asked for.
    const emitKind = isCash ? applied.type : ''
    const emitDir = isCash ? '' : applied.type
    const lineInDir = (inn: number, out: number) => (emitDir === 'deposit' ? inn > 0 : emitDir === 'withdrawal' ? out > 0 : true)
    // The ledger account set that defines this book: cash & cash-equivalents for the
    // Cash Book, bank & bank-equivalents for the Bank Book. Journal entries touching
    // one of these accounts are pulled into the book.
    const bookAcctIds = isCash ? cashAcctIds : bankAcctIds

    // Full scopes — drive the Book Summary. The Cash Book is the ledger of cash &
    // cash-equivalents accounts, so it captures every receipt/payment on a cash
    // account (any method) PLUS journal entries touching cash. The Bank Book keeps
    // its method-based (non-cash) scope.
    const inBook = (acctId: string, method: string) => (isCash ? cashAcctIds.has(acctId) : method !== 'cash')
    const receiptsScope = live.receipts.filter((r) => r.status !== 'void' && inBook(r.depositAccountId, r.method) && acctMatch(r.depositAccountId))
    const paymentsScope = live.payments.filter((p) => p.status !== 'void' && inBook(p.paymentAccountId, p.method) && acctMatch(p.paymentAccountId))
    // Journal entries enter the book via lines that touch one of its accounts
    // (cash accounts for the Cash Book, bank accounts for the Bank Book).
    const journalsScope = live.journals.filter((j) => j.status !== 'void' && j.lines.some((l) => bookAcctIds.has(l.accountId) && acctMatch(l.accountId) && (l.debit || l.credit)))
    const jvCashNet = (j: JournalVoucher) => j.lines.reduce((s, l) => s + (bookAcctIds.has(l.accountId) && acctMatch(l.accountId) ? (l.debit || 0) - (l.credit || 0) : 0), 0)
    /** One side only of a journal's book-account lines — used by the Bank Book's Deposits/Withdrawals filter. */
    const jvBookSide = (j: JournalVoucher, side: 'dr' | 'cr') => j.lines.reduce((s, l) => s + (bookAcctIds.has(l.accountId) && acctMatch(l.accountId) ? (side === 'dr' ? (l.debit || 0) : (l.credit || 0)) : 0), 0)

    // Book Summary opening = net movements strictly before the period start.
    let opening = 0
    if (from) {
      for (const r of receiptsScope) if (r.date < from) opening += r.amount
      for (const p of paymentsScope) if (p.date < from) opening -= p.amount
      for (const j of journalsScope) if (j.date < from) opening += jvCashNet(j)
    }

    // Listing running-balance opening = restricted to the selected Type (matches
    // the list table's Opening Balance row).
    let listOpening = 0
    if (from) {
      if (emitDir) {
        // Direction filter (Bank Book): only the matching side contributes.
        if (emitDir === 'deposit') {
          for (const r of receiptsScope) if (r.date < from) listOpening += r.amount
          for (const j of journalsScope) if (j.date < from) listOpening += jvBookSide(j, 'dr')
        } else {
          for (const p of paymentsScope) if (p.date < from) listOpening -= p.amount
          for (const j of journalsScope) if (j.date < from) listOpening -= jvBookSide(j, 'cr')
        }
      } else {
        if (emitKind !== 'payment' && emitKind !== 'journal') for (const r of receiptsScope) if (r.date < from) listOpening += r.amount
        if (emitKind !== 'receipt' && emitKind !== 'journal') for (const p of paymentsScope) if (p.date < from) listOpening -= p.amount
        if (emitKind === '' || emitKind === 'journal') for (const j of journalsScope) if (j.date < from) listOpening += jvCashNet(j)
      }
    }

    type VLine = { title?: string; accountId?: string; narration?: string; inn: number; out: number }
    type V = { kind: 'receipt' | 'payment' | 'journal'; date: string; no: string; party: string; lines: VLine[] }
    const vouchers: V[] = [
      ...receiptsScope.filter((r) => inPeriod(r.date)).map((r): V => ({ kind: 'receipt', date: r.date, no: r.number, party: r.receivedFrom, lines: (r.lines || []).map((l) => ({ accountId: l.accountId, narration: l.narration, inn: l.amount || 0, out: 0 })) })),
      ...paymentsScope.filter((p) => inPeriod(p.date)).map((p): V => ({ kind: 'payment', date: p.date, no: p.number, party: p.paidTo, lines: (p.lines || []).map((l) => ({ accountId: l.accountId, narration: l.narration, inn: 0, out: l.amount || 0 })) })),
      ...journalsScope.filter((j) => inPeriod(j.date)).map((j): V => {
        const contra = j.lines.filter((l) => !bookAcctIds.has(l.accountId)).map((l) => accountName(accounts, l.accountId))
        const contraTitle = contra.join(', ') || j.description
        return { kind: 'journal', date: j.date, no: j.number, party: j.stakeholder || j.description || 'Journal entry', lines: j.lines.filter((l) => bookAcctIds.has(l.accountId) && acctMatch(l.accountId)).map((l) => ({ title: contraTitle, narration: j.description, inn: l.debit || 0, out: l.credit || 0 })) }
      }),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no))

    let bal = listOpening
    let totalRec = 0
    let totalPay = 0
    const rowsHtml: string[] = []
    for (const v of vouchers) {
      // Summary totals accumulate for EVERY voucher; the running balance
      // accumulates only rows that match the Type filter.
      const show = (!emitKind || v.kind === emitKind) && (!emitDir || v.lines.some((l) => lineInDir(l.inn || 0, l.out || 0)))
      const header = `${v.kind === 'receipt' ? 'Recd' : v.kind === 'payment' ? 'Paid' : 'Journal'}: ${esc(v.party || '—')}`
      if (show) {
        rowsHtml.push(
          `<tr class="vhead"><td>${dmy(v.date)}</td><td>${esc(v.no)}</td><td class="bold">${header}</td><td></td><td></td><td></td></tr>`,
        )
      }
      const lines = v.lines.length ? v.lines : [{ accountId: '', narration: '', inn: 0, out: 0 }]
      for (const l of lines) {
        const rec = l.inn || 0
        const pay = l.out || 0
        totalRec += rec
        totalPay += pay
        if (!show) continue
        // Bank Book direction filter also drops the opposite side of a voucher.
        if (!lineInDir(rec, pay)) continue
        bal += rec - pay
        const title = esc(l.title ?? (l.accountId ? accountName(accounts, l.accountId) : ''))
        const narr = l.narration ? `<div class="narr"><b>Narr. :</b>${esc(l.narration)}</div>` : ''
        rowsHtml.push(
          `<tr class="vline"><td></td><td></td><td><div class="acct">${title}</div>${narr}</td>` +
          `<td class="num">${fmtNum(rec)}</td><td class="num">${fmtNum(pay)}</td><td class="num">${drcr(bal)}</td></tr>`,
        )
      }
    }
    // Book Summary closing = opening + total receipts − total payments.
    const closing = opening + totalRec - totalPay

    // Book Summary account label.
    const sumAcct = acct ? accounts.find((a) => a.id === acct) : (isCash ? accounts.find((a) => a.id === 'ac_1010') : undefined)
    const acctCode = sumAcct?.code || '—'
    const acctTitle = sumAcct ? sumAcct.name : (isCash ? 'Cash Account' : 'Bank Account')
    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency

    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')

    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : `<tr><td colspan="6" style="text-align:center;padding:24px;color:#666">No ${isCash ? 'cash' : 'bank'} transactions for the selected period.</td></tr>`

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; }
  .book tr.vhead td { border-top: 1px solid #ccc; padding-top: 10px; }
  .book tr.vhead td.bold { font-weight: bold; }
  .book .acct { font-weight: 600; }
  .book .narr { color: #333; }
  .book .num { white-space: nowrap; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    <div class="summary-title">Book Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Acct. Code/No.</th><th>Account Title</th><th>Dated From</th><th>Dated To</th>
        <th>Opening Balance</th><th>Total Receipt</th><th>Total Payment</th><th>Closing Balance</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(acctCode)}</td><td>${esc(acctTitle)}</td><td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td>
        <td>${drcr(opening)}</td><td>${fmtNum(totalRec)}</td><td>${fmtNum(totalPay)}</td><td>${drcr(closing)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr>
        <th>Date</th><th>Voucher No.</th><th>Particulars</th>
        <th class="num">${esc(inLabel)}</th><th class="num">${esc(outLabel)}</th><th class="num">Balance</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }
  function printCashBook() { return printBook(true) }
  function printBankBook() { return printBook(false) }

  /** Debit-positive for assets/expenses, credit-positive for the rest. */
  const glSignOf = (a?: typeof accounts[number]) => (a && (a.type === 'liability' || a.type === 'equity' || a.type === 'income') ? -1 : 1)
  type GLE = { accId: string; date: string; type: string; kind: 'receipt' | 'payment' | 'journal'; srcId: string; stakeholderClass: string; memo: string; ref: string; check: string; debit: number; credit: number }
  /**
   * Every General Ledger posting (receipts, payments and journals), one row per
   * account hit. Shared by the on-screen ledger and the printable sheet.
   */
  const buildGlEntries = (): GLE[] => {
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
    const all: GLE[] = []
    for (const r of live.receipts) {
      const bene = `${r.stakeholderClass ? `${cap(r.stakeholderClass)} > ` : ''}${r.receivedFrom || '—'}`
      const rChq = r.method === 'cheque' ? (r.referenceNo || '') : ''
      all.push({ accId: r.depositAccountId, date: r.date, type: 'Multiple Voucher', kind: 'receipt', srcId: r.id, stakeholderClass: bene, memo: r.description || 'Receipt', ref: r.number, check: rChq, debit: r.amount, credit: 0 })
      for (const l of r.lines || []) all.push({ accId: l.accountId, date: r.date, type: 'Multiple Voucher', kind: 'receipt', srcId: r.id, stakeholderClass: bene, memo: l.narration || r.description || 'Receipt', ref: r.number, check: rChq, debit: 0, credit: l.amount })
    }
    for (const p of live.payments) {
      const bene = `${p.stakeholderClass ? `${cap(p.stakeholderClass)} > ` : ''}${p.paidTo || '—'}`
      const pChq = p.method === 'cheque' ? (p.referenceNo || '') : ''
      all.push({ accId: p.paymentAccountId, date: p.date, type: 'Multiple Voucher', kind: 'payment', srcId: p.id, stakeholderClass: bene, memo: p.description || 'Payment', ref: p.number, check: pChq, debit: 0, credit: p.amount })
      for (const l of p.lines || []) all.push({ accId: l.accountId, date: p.date, type: 'Multiple Voucher', kind: 'payment', srcId: p.id, stakeholderClass: bene, memo: l.narration || p.description || 'Payment', ref: p.number, check: pChq, debit: l.amount, credit: 0 })
    }
    for (const j of live.journals) {
      const bene = (`${j.stakeholderClass ? `${cap(j.stakeholderClass)} > ` : ''}${j.stakeholder || ''}`).trim() || (j.description || '—')
      for (const l of j.lines) all.push({ accId: l.accountId, date: j.date, type: 'Adjustment Journal', kind: 'journal', srcId: j.id, stakeholderClass: bene, memo: j.description || '—', ref: j.number, check: '', debit: l.debit, credit: l.credit })
    }
    return all
  }

  /** Ledger Summary class order — matches the printed General Ledger Summary. */
  const LS_CLASS_ORDER = ['INCOME', 'EXPENSES', 'ASSETS', 'LIABILITIES', 'EQUITY']
  type LsRow = {
    id: string; code: string; name: string; classLabel: string; subclass: string
    pl: boolean; opening: number; debits: number; credits: number; net: number; closing: number
  }
  /**
   * General Ledger Summary — one line per account with Opening balance, Total
   * debits, Total credits, Net movement and Closing balance, grouped by class
   * (Income, Expenses, Assets, Liabilities, Equity) and sub-class. Profit &
   * loss accounts carry no opening/closing balance, so those cells stay blank,
   * and the Income/Expenses sections roll up into "Profit (loss) for the
   * period". Shared by the on-screen report and the printable sheet.
   */
  const buildLedgerSummary = (from: string, to: string, acctIds: string[], hideZero = false) => {
    const all = buildGlEntries()
    const set = new Set(acctIds)
    const nil = (n: number) => Math.round(n * 100) === 0
    const rows: LsRow[] = accounts
      .filter((a) => (set.size ? set.has(a.id) : true))
      .map((a) => {
        const def = ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))
        const sign = glSignOf(a)
        const mine = all.filter((e) => e.accId === a.id)
        let opening = a.primaryBalance ?? 0
        if (from) for (const e of mine) if (e.date < from) opening += sign * (e.debit - e.credit)
        const scoped = mine.filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
        const debits = scoped.reduce((n, e) => n + e.debit, 0)
        const credits = scoped.reduce((n, e) => n + e.credit, 0)
        const net = sign * (debits - credits)
        const cls = def?.class ?? a.type
        const pl = cls === 'income' || cls === 'expense'
        return {
          id: a.id,
          code: a.code || '',
          name: a.name,
          classLabel: (def?.classLabel ?? String(a.type || '')).toUpperCase(),
          subclass: def?.subclass ?? '',
          pl,
          opening: pl ? 0 : opening,
          debits,
          credits,
          net,
          closing: pl ? 0 : opening + net,
        }
      })
      // "Exclude zero balances" — keep only accounts with a balance or movement.
      .filter((r) => !hideZero || !(nil(r.opening) && nil(r.debits) && nil(r.credits) && nil(r.net) && nil(r.closing)))
    const byCode = (x: LsRow, y: LsRow) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name)
    const known = new Set(LS_CLASS_ORDER)
    const groups = LS_CLASS_ORDER
      .filter((c) => rows.some((r) => r.classLabel === c))
      .map((c) => {
        const inClass = rows.filter((r) => r.classLabel === c)
        const subs = [...new Set(inClass.map((r) => r.subclass))].map((sc) => ({
          subclass: sc,
          rows: inClass.filter((r) => r.subclass === sc).sort(byCode),
        }))
        return { classLabel: c, rows: inClass, subs }
      })
    const other = rows.filter((r) => !known.has(r.classLabel))
    if (other.length) groups.push({ classLabel: 'OTHER', rows: other, subs: [{ subclass: '', rows: other.sort(byCode) }] })
    const net = (c: string) => rows.filter((r) => r.classLabel === c).reduce((n, r) => n + r.net, 0)
    const income = net('INCOME')
    const expenses = net('EXPENSES')
    return {
      rows,
      groups,
      income,
      expenses,
      profit: income - expenses,
      totalDebits: rows.reduce((n, r) => n + r.debits, 0),
      totalCredits: rows.reduce((n, r) => n + r.credits, 0),
    }
  }

  /**
   * Printable General Ledger Summary — the Cash Book A4 sheet design applied to
   * the summary form in the client's sample: class/sub-class bands, one line
   * per account (Opening balance · Total debits · Total credits · Net movement
   * · Closing balance), section totals and "Profit (loss) for the period".
   */
  const printLedgerSummary = () => {
    const from = ledgerAppFrom
    const to = ledgerAppTo
    const data = buildLedgerSummary(from, to, ledgerAppAccounts, ledgerHideZero)
    const label = (r: LsRow) => (ledgerShowCodes && r.code ? `${r.code} · ${r.name}` : r.name)
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => (Math.round(n * 100) === 0 ? '-' : (n < 0 ? `(${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const cap = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s)

    const periodTitle = from || to
      ? `GENERAL LEDGER SUMMARY FOR THE PERIOD FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`
      : 'GENERAL LEDGER SUMMARY'

    const numCells = (r: LsRow) =>
      `<td class="num">${r.pl ? '' : fmtNum(r.opening)}</td><td class="num">${fmtNum(r.debits)}</td>` +
      `<td class="num">${fmtNum(r.credits)}</td><td class="num">${fmtNum(r.net)}</td>` +
      `<td class="num">${r.pl ? '' : fmtNum(r.closing)}</td>`
    const totalCells = (list: LsRow[], pl: boolean) => {
      const sum = (f: (r: LsRow) => number) => list.reduce((n, r) => n + f(r), 0)
      return `<td class="num">${pl ? '' : fmtNum(sum((r) => r.opening))}</td><td class="num">${fmtNum(sum((r) => r.debits))}</td>` +
        `<td class="num">${fmtNum(sum((r) => r.credits))}</td><td class="num">${fmtNum(sum((r) => r.net))}</td>` +
        `<td class="num">${pl ? '' : fmtNum(sum((r) => r.closing))}</td>`
    }

    const rowsHtml: string[] = []
    for (const g of data.groups) {
      const pl = g.classLabel === 'INCOME' || g.classLabel === 'EXPENSES'
      rowsHtml.push(`<tr class="cls-head"><td colspan="6">${esc(cap(g.classLabel))}</td></tr>`)
      for (const sub of g.subs) {
        if (sub.subclass && sub.subclass !== g.classLabel) rowsHtml.push(`<tr class="sub-head"><td colspan="6">${esc(cap(sub.subclass))}</td></tr>`)
        for (const r of sub.rows) rowsHtml.push(`<tr class="vline"><td class="acct">${esc(label(r))}</td>${numCells(r)}</tr>`)
      }
      rowsHtml.push(`<tr class="cls-total"><td>Total ${esc(cap(g.classLabel))}</td>${totalCells(g.rows, pl)}</tr>`)
      // The sample sheet reports the result straight after the Expenses block.
      if (g.classLabel === 'EXPENSES') {
        rowsHtml.push(
          `<tr class="profit"><td>Profit (loss) for the period</td><td class="num"></td><td class="num"></td>` +
          `<td class="num"></td><td class="num">${fmtNum(data.profit)}</td><td class="num"></td></tr>`,
        )
      }
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:#666">No accounts to report for the selected period.</td></tr>'

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.cls-head td { border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold; background: #f2f2f2; }
  .book tr.sub-head td { font-weight: bold; font-style: italic; padding-left: 16px; }
  .book tr.band td { padding: 14px 0 2px; font-weight: bold; text-transform: uppercase; letter-spacing: .3px; }
  .book tr.colhead td { border-bottom: 1px solid #000; font-weight: bold; padding: 3px 8px 3px 0; }
  .book tr.vline td { padding: 2px 8px 2px 0; }
  .book td.code { width: 70px; white-space: nowrap; }
  .book td.type { text-transform: uppercase; font-size: 12px; }
  .book td.amt { text-align: right; width: 110px; }
  .book tr.band-total td { border-top: 1px solid #000; font-weight: bold; padding: 3px 8px 3px 0; }
  .book tr.vline td.acct { padding-left: 24px; }
  .book tr.cls-total td { border-top: 1px solid #333; font-weight: bold; }
  .book tr.profit td { border-top: 1px solid #333; border-bottom: 2px solid #333; font-weight: bold; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    <div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Dated From</th><th>Dated To</th><th>Accounts</th>
        <th>Total Debits</th><th>Total Credits</th><th>Profit (Loss)</th>
      </tr></thead>
      <tbody><tr>
        <td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td><td>${data.rows.length}</td>
        <td>${fmtNum(data.totalDebits)}</td><td>${fmtNum(data.totalCredits)}</td><td>${fmtNum(data.profit)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr>
        <th>Account</th><th class="num">Opening balance</th><th class="num">Total debits</th>
        <th class="num">Total credits</th><th class="num">Net movement</th><th class="num">Closing balance</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  type SlRow = { date: string; ref: string; cls: string; name: string; party: string; debit: number; credit: number }
  /**
   * Every Sub-Ledger posting for one account (receipt/payment headers, their
   * lines and journal lines), tagged with the stakeholder class and name so
   * the report can group by sub-account. Shared by the on-screen Sub-Ledger
   * and its printable sheet.
   */
  const buildSubLedgerRows = (accId: string): SlRow[] => {
    const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
    const beneOf = (cls: string, name: string) => (`${cls ? `${cap(cls)} > ` : ''}${name || ''}`).trim() || '—'
    const out: SlRow[] = []
    if (!accId) return out
    const add = (date: string, ref: string, cls: string, name: string, debit: number, credit: number) =>
      out.push({ date, ref, cls: cls || '', name: name || '', party: beneOf(cls, name), debit, credit })
    for (const r of live.receipts) {
      if (r.depositAccountId === accId) add(r.date, `RCT ${r.number}`, r.stakeholderClass || '', r.receivedFrom || '', r.amount, 0)
      for (const l of r.lines || []) if (l.accountId === accId) add(r.date, `RCT ${r.number}`, r.stakeholderClass || '', r.receivedFrom || '', 0, l.amount)
    }
    for (const p of live.payments) {
      if (p.paymentAccountId === accId) add(p.date, `PMT ${p.number}`, p.stakeholderClass || '', p.paidTo || '', 0, p.amount)
      for (const l of p.lines || []) if (l.accountId === accId) add(p.date, `PMT ${p.number}`, p.stakeholderClass || '', p.paidTo || '', l.amount, 0)
    }
    for (const j of live.journals) for (const l of j.lines) if (l.accountId === accId) add(j.date, `JRN ${j.number}`, j.stakeholderClass || '', j.stakeholder || j.description || '', l.debit, l.credit)
    return out
  }

  /**
   * Printable Sub-Ledger — the same A4 sheet design as the printable General
   * Ledger. Detail view: one block per account with Balance b/f, the postings
   * (sub-account + voucher, running DR/CR balance), Total for the period and
   * Balance c/d. Summary view: one line per sub-account (opening, movement,
   * closing) with a per-account Total. Prints every selected account.
   */
  const printSubLedger = (view: 'detail' | 'summary') => {
    const from = subLedgerAppFrom
    const to = subLedgerAppTo
    const selAccts = subLedgerAppAccounts
      .map((id) => accounts.find((a) => a.id === id))
      .filter((a): a is typeof accounts[number] => !!a)
    const nameSet = new Set(subLedgerAppNames)
    const keep = (r: SlRow) => (!subLedgerAppClass || r.cls === subLedgerAppClass) && (!nameSet.size || nameSet.has(r.name))

    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const drcr = (n: number) => `${fmtNum(n)} ${n < 0 ? 'CR' : 'DR'}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))

    const periodTitle = (from || to
      ? `SUB-LEDGER FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`
      : 'SUB-LEDGER') + (view === 'summary' ? ' (SUMMARY)' : '')

    const cols = view === 'summary' ? 5 : 6
    let grandDr = 0
    let grandCr = 0
    let entryCount = 0
    const rowsHtml: string[] = []
    for (const a of selAccts) {
      const allRows = buildSubLedgerRows(a.id).filter(keep)
      const opening = from ? allRows.filter((r) => r.date < from).reduce((n, r) => n + r.debit - r.credit, 0) : 0
      const scoped = allRows
        .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
        .sort((x, y) => x.date.localeCompare(y.date) || x.ref.localeCompare(y.ref))
      const totDr = scoped.reduce((n, r) => n + r.debit, 0)
      const totCr = scoped.reduce((n, r) => n + r.credit, 0)
      const closing = opening + totDr - totCr
      grandDr += totDr
      grandCr += totCr
      entryCount += scoped.length

      rowsHtml.push(`<tr class="acct-head"><td colspan="${cols}">${esc(`${a.code ? `${a.code}-` : ''}${a.name}`)}</td></tr>`)
      if (view === 'summary') {
        // One line per stakeholder of the account, opening → movement → closing.
        const map = new Map<string, { open: number; debit: number; credit: number }>()
        const bucket = (party: string) => {
          const e = map.get(party) ?? { open: 0, debit: 0, credit: 0 }
          map.set(party, e)
          return e
        }
        // Every stakeholder that has ever transacted on this account is listed,
        // even when the chosen period shows no movement (printed as zeros).
        for (const r of allRows) bucket(r.party)
        if (from) for (const r of allRows) if (r.date < from) bucket(r.party).open += r.debit - r.credit
        for (const r of scoped) { const e = bucket(r.party); e.debit += r.debit; e.credit += r.credit }
        for (const [party, e] of [...map.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
          rowsHtml.push(
            `<tr class="vline"><td class="acct">${esc(party)}</td><td class="num">${drcr(e.open)}</td>` +
            `<td class="num">${fmtNum(e.debit)}</td><td class="num">${fmtNum(e.credit)}</td>` +
            `<td class="num">${drcr(e.open + e.debit - e.credit)}</td></tr>`,
          )
        }
        rowsHtml.push(
          `<tr class="acct-total"><td>Total</td><td class="num">${drcr(opening)}</td>` +
          `<td class="num">${fmtNum(totDr)}</td><td class="num">${fmtNum(totCr)}</td><td class="num">${drcr(closing)}</td></tr>`,
        )
      } else {
        rowsHtml.push(`<tr class="vline open"><td></td><td></td><td><i>Balance b/f</i></td><td class="num"></td><td class="num"></td><td class="num">${drcr(opening)}</td></tr>`)
        let run = opening
        for (const r of scoped) {
          run += r.debit - r.credit
          rowsHtml.push(
            `<tr class="vline"><td>${dmy(r.date)}</td><td>${esc(r.ref)}</td>` +
            `<td><div class="acct">${esc(r.party)}</div></td>` +
            `<td class="num">${r.debit ? fmtNum(r.debit) : ''}</td><td class="num">${r.credit ? fmtNum(r.credit) : ''}</td>` +
            `<td class="num">${drcr(run)}</td></tr>`,
          )
        }
        rowsHtml.push(
          `<tr class="acct-total"><td></td><td></td><td>Total for the period</td>` +
          `<td class="num">${fmtNum(totDr)}</td><td class="num">${fmtNum(totCr)}</td><td class="num"></td></tr>`,
        )
        rowsHtml.push(`<tr class="acct-total"><td></td><td></td><td><i>Balance c/d</i></td><td class="num"></td><td class="num"></td><td class="num">${drcr(closing)}</td></tr>`)
      }
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:#666">No sub-ledger activity for the selected period.</td></tr>`
    const headCells = view === 'summary'
      ? '<th>Stakeholder</th><th class="num">Opening Balance</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Closing Balance</th>'
      : '<th>Date</th><th>Voucher No.</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th>'
    const grandRow = view === 'summary'
      ? `<tr class="grand"><td>Grand Total</td><td class="num"></td><td class="num">${fmtNum(grandDr)}</td><td class="num">${fmtNum(grandCr)}</td><td class="num"></td></tr>`
      : `<tr class="grand"><td></td><td></td><td>Grand Total</td><td class="num">${fmtNum(grandDr)}</td><td class="num">${fmtNum(grandCr)}</td><td class="num"></td></tr>`
    const clsLabel = subLedgerAppClass
      ? subLedgerAppClass.charAt(0).toUpperCase() + subLedgerAppClass.slice(1)
      : 'All classes'
    const namesLabel = subLedgerAppNames.length ? `${subLedgerAppNames.length} selected` : 'All'

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.acct-head td { border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold; background: #f2f2f2; }
  .book tr.acct-total td { border-top: 1px solid #333; font-weight: bold; }
  .book tr.open td { color: #444; }
  .book .acct { font-weight: 600; }
  .book tr.grand td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    <div class="summary-title">Sub-Ledger Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Dated From</th><th>Dated To</th><th>Accounts</th><th>Stakeholder Class</th>
        <th>Names</th><th>Entries</th><th>Total Debit</th><th>Total Credit</th>
      </tr></thead>
      <tbody><tr>
        <td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td><td>${selAccts.length}</td><td>${esc(clsLabel)}</td>
        <td>${esc(namesLabel)}</td><td>${entryCount}</td><td>${fmtNum(grandDr)}</td><td>${fmtNum(grandCr)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      ${headCells ? `<thead><tr>${headCells}</tr></thead>` : ''}
      <tbody>${bodyRows}${rowsHtml.length ? grandRow : ''}</tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  /**
   * Printable List of Accounts — same A4 sheet design as the printable General
   * Ledger. Covers all three outputs of the report's dropdown: the accounts
   * list (grouped by class and sub-class), the Opening Balance Form and the
   * Fixed Asset Opening Balance Form (Debit / Credit / As of columns with a
   * proving total).
   */
  const printAccountsList = (option: string) => {
    const opening = option === 'opening' || option === 'fixedOpening'
    const clsOf = (a: typeof accounts[number]) =>
      (ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))?.classLabel ?? String(a.type || '')).toUpperCase()
    const list = option === 'fixedOpening'
      ? accounts.filter((a) => Number(a.accountTypeId) === 4)
      // Opening balances cover the balance sheet only: assets, liabilities, equity.
      : option === 'opening'
        ? accounts.filter((a) => clsOf(a).startsWith('ASSET') || clsOf(a).startsWith('LIABILIT') || clsOf(a) === 'EQUITY')
        // The accounts list prints the WHOLE chart of accounts, banks included.
        : accounts

    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const cap = (t: string) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : t)

    // The opening-balance sheets print as the client's input form.
    const periodTitle = (option === 'opening'
      ? 'OPENING BALANCE INPUT FORM'
      : option === 'fixedOpening'
        ? 'FIXED ASSET OPENING BALANCE INPUT FORM'
        : 'LIST OF ACCOUNTS')

    const defOf = (a: typeof accounts[number]) => ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))
    const sorted = list.slice().sort((x, y) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name))

    if (opening) {
      /* ------------------------------------------------------------------
         OPENING BALANCE INPUT FORM — a pixel-faithful copy of the client's
         printed form: centred bold headings, then one fully bordered table
         per section (grey header strip: Code / Account Name / Account Type /
         Amount), blank Amount cells to fill in by hand, and a borderless
         right-aligned "Total" line with an empty amount box.
         ------------------------------------------------------------------ */
      const SUB_LABEL: Record<string, string> = {
        'CURRENT ASSETS': 'CURRENT ASSET',
        'NON-CURRENT ASSETS': 'NON-CURRENT ASSET',
        'CURRENT LIABILITIES': 'CURRENT LIABILITY',
        'NON-CURRENT LIABILITIES': 'NON-CURRENT LIABILITY',
      }
      const bandOf = (a: typeof accounts[number]) => {
        if (option === 'fixedOpening') return 'NON-CURRENT ASSET'
        const sub = (defOf(a)?.subclass || '').toUpperCase()
        if (sub) return SUB_LABEL[sub] ?? sub
        const cls = clsOf(a)
        return cls.startsWith('ASSET') ? 'CURRENT ASSET' : cls.startsWith('LIABILIT') ? 'CURRENT LIABILITY' : cls
      }
      const BAND_ORDER = ['EQUITY', 'NON-CURRENT ASSET', 'CURRENT ASSET', 'CURRENT LIABILITY', 'NON-CURRENT LIABILITY']
      const bands = [...new Set(sorted.map(bandOf))].sort((x, y) => {
        const ix = BAND_ORDER.indexOf(x)
        const iy = BAND_ORDER.indexOf(y)
        return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x.localeCompare(y)
      })

      const sections = bands.map((band) => {
        const inBand = sorted.filter((a) => bandOf(a) === band)
        const body = inBand.map((a) => (
          `<tr><td class="c-code">${esc(a.code || '')}</td><td>${esc(a.name)}</td>` +
          `<td class="c-type">${esc((defOf(a)?.name || String(a.type || '')).toUpperCase())}</td>` +
          '<td class="c-amt"></td></tr>'
        )).join('')
        return `<div class="grp">${esc(band)}</div>
        <table class="ob">
          <thead><tr>
            <th class="c-code">Code</th><th>Account Name</th><th class="c-type">Account Type</th><th class="c-amt">Amount</th>
          </tr></thead>
          <tbody>
            ${body}
            <tr class="tot"><td class="blank"></td><td class="blank"></td><td class="blank lbl">Total</td><td class="c-amt"></td></tr>
          </tbody>
        </table>`
      }).join('')

      const head1 = esc((company?.name || 'Company').toUpperCase())
      const head2 = esc(([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '').toUpperCase())
      const obHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 16mm 14mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2 { text-align: center; margin: 0; font-weight: bold; }
  h1 { font-size: 16.5px; }
  h2 { font-size: 15px; }
  .head { margin-bottom: 26px; }
  .grp { font-weight: bold; font-size: 13px; margin: 0 0 4px; }
  table.ob { width: 100%; border-collapse: collapse; margin-bottom: 26px; }
  table.ob th, table.ob td { border: 1px solid #8a8a8a; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
  table.ob thead th { background: #d9d9d9; font-weight: bold; font-size: 10.5px; text-align: left; }
  table.ob th.c-code, table.ob td.c-code { width: 8%; white-space: nowrap; }
  table.ob th.c-type, table.ob td.c-type { width: 30%; }
  table.ob th.c-amt, table.ob td.c-amt { width: 19%; text-align: right; }
  table.ob tr.tot td.blank { border: 0; }
  table.ob tr.tot td.lbl { text-align: right; font-weight: bold; padding-right: 8px; }
  table.ob tr.tot td.c-amt { height: 30px; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
    tr { page-break-inside: avoid; }
    table.ob thead { display: table-header-group; }
  }
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>${head1}</h1>
      ${head2 ? `<h2>${head2}</h2>` : ''}
      <h2>${esc(periodTitle)}</h2>
    </div>
    ${sections || '<p style="text-align:center;color:#666">No accounts to report.</p>'}
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

      const obWin = window.open('', '_blank')
      if (obWin) { obWin.document.open(); obWin.document.write(obHtml); obWin.document.close() }
      return
    }

    let totDr = 0
    let totCr = 0
    const rowsHtml: string[] = []
    {

      // Grouped by CLASS (Assets, Liabilities, Income, Expenses, Equity) with
      // the account type as a sub-heading inside each class.
      const typeNameOf = (a: typeof accounts[number]) =>
        defOf(a)?.name || (a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : 'Unclassified')
      const classOf = (a: typeof accounts[number]) => (defOf(a)?.classLabel ?? String(a.type || 'UNCLASSIFIED')).toUpperCase()
      const CLASS_LABELS: Record<string, string> = {
        ASSETS: 'Assets', ASSET: 'Assets', LIABILITIES: 'Liabilities', LIABILITY: 'Liabilities',
        INCOME: 'Income', EXPENSES: 'Expenses', EXPENSE: 'Expenses', EQUITY: 'Equity',
      }
      const CLASS_ORDER = ['ASSETS', 'ASSET', 'LIABILITIES', 'LIABILITY', 'INCOME', 'EXPENSES', 'EXPENSE', 'EQUITY']
      const classes = [
        ...CLASS_ORDER.filter((c) => sorted.some((a) => classOf(a) === c)),
        ...[...new Set(sorted.map(classOf))].filter((c) => !CLASS_ORDER.includes(c)),
      ]
      for (const c of classes) {
        const inClass = sorted.filter((a) => classOf(a) === c)
        rowsHtml.push(`<tr class="acct-head"><td colspan="4">${esc(CLASS_LABELS[c] ?? cap(c))} (${inClass.length})</td></tr>`)
        for (const tName of [...new Set(inClass.map(typeNameOf))]) {
          const inType = inClass.filter((a) => typeNameOf(a) === tName)
          const def = ACCOUNT_TYPE_DEFS.find((t) => t.name === tName)
          rowsHtml.push(`<tr class="sub-head"><td colspan="4">${esc(tName)} (${inType.length})</td></tr>`)
          for (const a of inType) {
            rowsHtml.push(
              `<tr class="vline"><td>${esc(a.code || '')}</td><td><div class="acct">${esc(a.name)}</div></td>` +
              `<td>${esc(tName)}</td>` +
              `<td>${esc(def?.normalBalance === 'CREDIT' ? 'Credit' : 'Debit')}</td></tr>`,
            )
          }
        }
      }
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const cols = 4
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:#666">No accounts to report.</td></tr>`
    const headCells = '<th>Code</th><th>Account</th><th>Account Type</th><th>Normal Balance</th>'
    // The accounts-list style sheet carries no totals row.
    const totalRow = ''
    void totDr
    void totCr

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.acct-head td { border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold; background: #f2f2f2; }
  .book tr.sub-head td { font-weight: bold; font-style: italic; padding-left: 16px; }
  .book .acct { font-weight: 600; }
  .book tr.grand td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    ${`<div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Report</th><th>Printed On</th><th>Accounts</th><th>Classes</th><th>Account Types</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(cap(periodTitle))}</td><td>${dmy(new Date().toISOString().slice(0, 10))}</td><td>${sorted.length}</td>
        <td>${new Set(sorted.map((a) => defOf(a)?.classLabel ?? a.type)).size}</td>
        <td>${new Set(sorted.map((a) => defOf(a)?.name ?? a.type)).size}</td>
      </tr></tbody>
    </table>`}

    <table class="book">
      <thead><tr>${headCells}</tr></thead>
      <tbody>${bodyRows}${totalRow}</tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  /**
   * Printable General Ledger — same A4 sheet design as the Cash/Bank Book:
   * company header, period title, a Ledger Summary band, then one block per
   * account (bold account head, Opening Balance, postings with a running
   * DR/CR balance, account totals and Closing Balance). Prints EVERY selected
   * account, not just the page shown on screen.
   */
  const printGeneralLedger = () => {
    const from = glAppFrom
    const to = glAppTo
    const all = buildGlEntries()
    const scoped = all.filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    const set = new Set(glAppAccounts)
    const groupAccts = accounts
      .filter((a) => (set.size ? set.has(a.id) : scoped.some((e) => e.accId === a.id)))
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''))

    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const drcr = (n: number) => `${fmtNum(n)} ${n < 0 ? 'CR' : 'DR'}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))

    const periodTitle = from || to
      ? `GENERAL LEDGER FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`
      : 'GENERAL LEDGER'

    let grandDr = 0
    let grandCr = 0
    const rowsHtml: string[] = []
    for (const a of groupAccts) {
      let beginning = a.primaryBalance ?? 0
      if (from) for (const e of all) if (e.accId === a.id && e.date < from) beginning += glSignOf(a) * (e.debit - e.credit)
      const accEntries = scoped.filter((e) => e.accId === a.id).sort((x, y) => x.date.localeCompare(y.date))
      const totDr = accEntries.reduce((s, e) => s + e.debit, 0)
      const totCr = accEntries.reduce((s, e) => s + e.credit, 0)
      const ending = beginning + glSignOf(a) * (totDr - totCr)
      grandDr += totDr
      grandCr += totCr

      rowsHtml.push(`<tr class="acct-head"><td colspan="6">${esc(`${a.code ? `${a.code}-` : ''}${a.name}`)}</td></tr>`)
      rowsHtml.push(`<tr class="vline open"><td></td><td></td><td colspan="2"><i>Opening Balance</i></td><td class="num"></td><td class="num">${drcr(beginning)}</td></tr>`)
      let run = beginning
      for (const e of accEntries) {
        run += glSignOf(a) * (e.debit - e.credit)
        rowsHtml.push(
          `<tr class="vline"><td>${dmy(e.date)}</td><td>${esc(e.ref)}</td>` +
          `<td><div class="acct">${esc(e.stakeholderClass)}</div><div class="narr">${esc(e.memo)}</div></td>` +
          `<td class="num">${e.debit ? fmtNum(e.debit) : ''}</td><td class="num">${e.credit ? fmtNum(e.credit) : ''}</td>` +
          `<td class="num">${drcr(run)}</td></tr>`,
        )
      }
      rowsHtml.push(
        `<tr class="acct-total"><td></td><td></td><td>Closing Balance</td>` +
        `<td class="num">${fmtNum(totDr)}</td><td class="num">${fmtNum(totCr)}</td><td class="num">${drcr(ending)}</td></tr>`,
      )
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:#666">No ledger activity for the selected period.</td></tr>'

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; }
  .book tr.acct-head td { border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold; background: #f2f2f2; }
  .book tr.acct-total td { border-top: 1px solid #333; font-weight: bold; }
  .book tr.open td { color: #444; }
  .book .acct { font-weight: 600; }
  .book .narr { color: #333; }
  .book .num { white-space: nowrap; }
  .book tr.grand td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    <div class="summary-title">Ledger Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Dated From</th><th>Dated To</th><th>Accounts</th>
        <th>Postings</th><th>Total Debit</th><th>Total Credit</th>
      </tr></thead>
      <tbody><tr>
        <td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td><td>${groupAccts.length}</td>
        <td>${scoped.filter((e) => groupAccts.some((a) => a.id === e.accId)).length}</td>
        <td>${fmtNum(grandDr)}</td><td>${fmtNum(grandCr)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr>
        <th>Date</th><th>Voucher No.</th><th>Description</th>
        <th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th>
      </tr></thead>
      <tbody>${bodyRows}
        <tr class="grand"><td></td><td></td><td>Grand Total</td><td class="num">${fmtNum(grandDr)}</td><td class="num">${fmtNum(grandCr)}</td><td class="num"></td></tr>
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  /**
   * Printable General Journal — same A4 sheet design as the Cash/Bank Book:
   * company header, period title, a Journal Summary band, then the entries
   * grouped by voucher (bold voucher head, one indented line per posting) and
   * a grand total proving Dr = Cr.
   */
  const printGeneralJournal = () => {
    const from = embedded ? gjAppFrom : gjFrom
    const to = embedded ? gjAppTo : gjTo
    const src = embedded ? gjAppSource : gjSource
    const entries = buildGjEntries(from, to, src)
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))

    const periodTitle = from || to
      ? `GENERAL JOURNAL FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`
      : 'GENERAL JOURNAL'
    const srcLabel = src === 'journal' ? 'Journal vouchers only' : src === 'cashbank' ? 'Cash & bank only' : 'All entries'

    let totalDr = 0
    let totalCr = 0
    const rowsHtml: string[] = []
    for (const e of entries) {
      rowsHtml.push(
        `<tr class="vhead"><td>${dmy(e.date)}</td><td>${esc(e.no)}</td><td class="bold">${esc(e.desc || '—')}</td><td></td><td></td></tr>`,
      )
      for (const l of e.lines) {
        const dr = l.debit || 0
        const cr = l.credit || 0
        totalDr += dr
        totalCr += cr
        // Credits are indented under their debits, the classic journal layout.
        const title = esc(accountName(accounts, l.accountId))
        rowsHtml.push(
          `<tr class="vline"><td></td><td></td><td><div class="acct${cr ? ' indent' : ''}">${title}</div></td>` +
          `<td class="num">${dr ? fmtNum(dr) : ''}</td><td class="num">${cr ? fmtNum(cr) : ''}</td></tr>`,
        )
      }
    }
    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#666">No journal entries for the selected period.</td></tr>'

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(periodTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; }
  .book tr.vhead td { border-top: 1px solid #ccc; padding-top: 10px; }
  .book tr.vhead td.bold { font-weight: bold; }
  .book .acct { font-weight: 600; }
  .book .acct.indent { padding-left: 28px; font-weight: 400; }
  .book tr.total td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .book .num { white-space: nowrap; }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .actions { display: none; }
  }
</style></head>
<body>
  <div class="sheet">
    <h1>${line1}</h1>
    ${line2 ? `<h2>${line2}</h2>` : ''}
    <h3>${esc(periodTitle)}</h3>

    <div class="summary-title">Journal Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Dated From</th><th>Dated To</th><th>Source</th>
        <th>Entries</th><th>Total Debit</th><th>Total Credit</th>
      </tr></thead>
      <tbody><tr>
        <td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td><td>${esc(srcLabel)}</td>
        <td>${entries.length}</td><td>${fmtNum(totalDr)}</td><td>${fmtNum(totalCr)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr>
        <th>Date</th><th>Voucher No.</th><th>Description</th>
        <th class="num">Debit</th><th class="num">Credit</th>
      </tr></thead>
      <tbody>${bodyRows}
        <tr class="total"><td></td><td></td><td>Total</td><td class="num">${fmtNum(totalDr)}</td><td class="num">${fmtNum(totalCr)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  /** Cash Book parameters — a full mirror of the Bank Book filter (Method + period inline, then Account + actions). */
  const cashParamsPanel = (
    <div className="mb-6 max-w-6xl space-y-4">
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="w-56"><FRow label="Method">
          <Select value={cbMode} onChange={(e) => setCbMode(e.target.value)} placeholder="Please Select...">
            <option value="month">Month</option>
            <option value="date">Date</option>
          </Select>
        </FRow></div>
        <div className="w-56"><FRow label="Type">
          <Select value={cbType} onChange={(e) => setCbType(e.target.value)} placeholder="Please Select...">
            <option value="">All</option>
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
            <option value="journal">Journal</option>
          </Select>
        </FRow></div>
        {cbMode === 'month' && (
          <>
            <div className="w-56"><FRow label="Year">
              <Select value={cbYear} onChange={(e) => setCbYear(e.target.value)}>
                {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
              </Select>
            </FRow></div>
            <div className="w-56"><FRow label="Month">
              <Select value={cbMonth} onChange={(e) => setCbMonth(e.target.value)} placeholder="Please Select...">
                {MONTHS.map((m, i) => (<option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>))}
              </Select>
            </FRow></div>
          </>
        )}
        {cbMode === 'date' && (
          <>
            <div className="w-56"><FRow label="From Date">
              <DatePicker value={cbFrom} onChange={setCbFrom} max={cbTo || undefined} placeholder="From date" />
            </FRow></div>
            <div className="w-56"><FRow label="To Date">
              <DatePicker value={cbTo} onChange={setCbTo} min={cbFrom || undefined} placeholder="To date" />
            </FRow></div>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <FRow label="Account">
          <Select value={cbAccount} onChange={(e) => setCbAccount(e.target.value)} placeholder="Please Select...">
            {cashOptions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </Select>
        </FRow>
        {(() => {
          // The Cash Book requires a period (Month, or a From/To range) AND an
          // Account before it can be Generated or Printed. The Generate and Print
          // buttons stay disabled until those are chosen.
          const cashReady = !!cbAccount && (cbMode === 'month' ? !!cbMonth : cbMode === 'date' ? (!!cbFrom && !!cbTo) : false)
          return (
            <>
              <button
                type="button"
                disabled={!cashReady}
                onClick={() => { if (!cashReady) return; setCbApplied({ mode: cbMode, year: cbYear, month: cbMonth, from: cbFrom, to: cbTo, account: cbAccount, type: cbType }); setCbGenerated(true) }}
                title={cashReady ? 'Generate the cash book' : 'Select a Month (or From/To dates) and an Account first'}
                className={'inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-semibold text-white transition ' + (cashReady ? 'cursor-pointer bg-emerald-500 hover:brightness-110' : 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600')}
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => { setCbMode(''); setCbYear(curYear); setCbMonth(''); setCbFrom(''); setCbTo(''); setCbAccount(''); setCbType(''); setCbApplied({ mode: '', year: curYear, month: '', from: '', to: '', account: '', type: '' }); setCbGenerated(false) }}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!cashReady}
                onClick={() => { if (!cashReady) return; printCashBook() }}
                title={cashReady ? 'Print the cash book' : 'Select a Month (or From/To dates) and an Account first'}
                className={'inline-flex h-10 min-w-24 items-center justify-center rounded-md px-6 text-sm font-semibold text-white transition ' + (cashReady ? 'cursor-pointer bg-[#2e75b6] hover:brightness-110' : 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600')}
              >
                Print
              </button>
            </>
          )
        })()}
      </div>
      {!(!!cbAccount && (cbMode === 'month' ? !!cbMonth : cbMode === 'date' ? (!!cbFrom && !!cbTo) : false)) && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Select a Month (or a From Date and To Date) and an Account to generate or print the Cash Book.</p>
      )}
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
            ? <T head={['Code', 'Account', curTitle('Outstanding')]} right={[2]} rows={rows} />
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
              {paramsPanel()}
              {rows.length
                ? <T head={['Account', curTitle('Receipts'), curTitle('Payments'), curTitle('Net')]} right={[1, 2, 3]} rows={rows} />
                : <Empty title="No entries for the selected filters" desc="Adjust the year, month, type or bank option and press Refresh." />}
            </div>
          ),
        }
      }
      case 'cashBook': {
        const opening = cbOpening
        const totalIn = cashBookEntries.reduce((s, e) => s + e.inn, 0)
        const totalOut = cashBookEntries.reduce((s, e) => s + e.out, 0)
        const closing = opening + totalIn - totalOut
        const openingRow = ['', '', <span className="font-semibold">Opening Balance</span>, '', '—', '—', <span className="font-semibold">{formatGhs(opening)}</span>]
        const txRows = runBalance(cashBookEntries, opening).map((r) => [dFmt(r.date), <button type="button" onClick={() => setCbView({ kind: r.kind, id: r.id })} className="cursor-pointer font-medium text-[#2e75b6] hover:underline" title="View voucher details">{r.no}</button>, r.party, r.desc || '—', r.inn ? formatGhs(r.inn) : '—', r.out ? formatGhs(r.out) : '—', <span className="font-semibold">{formatGhs(r.bal)}</span>])
        const closingRow = ['', '', <span className="font-semibold">Closing Balance</span>, '', <span className="font-semibold">{formatGhs(totalIn)}</span>, <span className="font-semibold">{formatGhs(totalOut)}</span>, <span className="font-semibold">{formatGhs(closing)}</span>]
        const rows = [openingRow, ...txRows, closingRow]
        return {
          title: 'Cash Book',
          node: (
            <div>
              {cashParamsPanel}
              {!cbGenerated
                ? <Empty title="No data loaded" desc="Set your filters and click Generate to load the cash book." />
                : cashBookEntries.length
                  ? <T head={['Date', 'Voucher', 'Party', 'Description / Payee', curTitle('Cash In (Debit)'), curTitle('Cash Out (Credit)'), curTitle('Balance')]} right={[4, 5, 6]} rows={rows} />
                  : <Empty title="No entries for the selected filters" desc="Adjust the filters and click Generate." />}
            </div>
          ),
        }
      }
      case 'bankBook': {
        const opening = bkOpening
        const totalIn = bankBookEntries.reduce((s, e) => s + e.inn, 0)
        const totalOut = bankBookEntries.reduce((s, e) => s + e.out, 0)
        const closing = opening + totalIn - totalOut
        const openingRow = ['', '', <span className="font-semibold">Opening Balance</span>, '—', '—', <span className="font-semibold">{formatGhs(opening)}</span>]
        const txRows = runBalance(bankBookEntries, opening).map((r) => [dFmt(r.date), r.no, r.party, r.inn ? formatGhs(r.inn) : '—', r.out ? formatGhs(r.out) : '—', <span className="font-semibold">{formatGhs(r.bal)}</span>])
        const closingRow = ['', '', <span className="font-semibold">Closing Balance</span>, <span className="font-semibold">{formatGhs(totalIn)}</span>, <span className="font-semibold">{formatGhs(totalOut)}</span>, <span className="font-semibold">{formatGhs(closing)}</span>]
        const rows = [openingRow, ...txRows, closingRow]
        return {
          title: 'Bank Book',
          node: (
            <div>
              {bankParamsPanel}
              {!bkGenerated
                ? <Empty title="No data loaded" desc="Set your filters and click Generate to load the bank book." />
                : bankBookEntries.length
                  ? <T head={['Date', 'Voucher', 'Party', curTitle('Deposits'), curTitle('Withdrawals'), curTitle('Balance')]} right={[3, 4, 5]} rows={rows} />
                  : <Empty title="No entries for the selected filters" desc="Adjust the filters and click Generate." />}
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
          node: rows.length ? <T head={['Bank Account', 'Statement Date', curTitle('Starting'), curTitle('Statement'), curTitle('Book'), curTitle('Difference'), 'Status']} right={[2, 3, 4, 5]} rows={rows} /> : <Empty title="No reconciliations yet" desc="Run a bank reconciliation to see it here." />,
        }
      }
      case 'contribution': {
        const rows = contributions.map(([who, v], i) => [String(i + 1), <span className="font-semibold">{who}</span>, String(v.count), formatGhs(v.total)])
        return {
          title: 'Contribution Per Head',
          node: rows.length ? <T head={['S/No.', 'Contributor', curTitle('Receipts'), curTitle('Total')]} right={[2, 3]} rows={rows} /> : <Empty title="No contributions yet" desc="Receipts grouped per contributor appear here." />,
        }
      }
      case 'listAccounts': {
        // Opening-balance form rows: the balance sits in Debit or Credit
        // depending on the account's normal balance.
        const obRows = (list: typeof accounts) => list.map((a) => {
          const def = ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))
          const bal = a.primaryBalance ?? 0
          const isDebit = def ? def.normalBalance === 'DEBIT' : (a.type === 'asset' || a.type === 'expense')
          return [a.code, <span className="font-semibold">{a.name}</span>, isDebit ? formatGhs(bal) : '—', isDebit ? '—' : formatGhs(bal), a.balanceAsOf ? dFmt(a.balanceAsOf) : '—']
        })
        const fixedAssets = accounts.filter((a) => Number(a.accountTypeId) === 4)
        /** Opening balances are a balance-sheet exercise: assets, liabilities and equity only. */
        const isBalanceSheetAcct = (a: typeof accounts[number]) => {
          const cls = (ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))?.classLabel
            ?? String(a.type || '')).toUpperCase()
          return cls.startsWith('ASSET') || cls.startsWith('LIABILIT') || cls === 'EQUITY'
        }
        const openingAccounts = accounts.filter(isBalanceSheetAcct)
        const title = listOption === 'opening'
          ? 'Opening Balance Form'
          : listOption === 'fixedOpening'
            ? 'Fixed Asset Opening Balance Form'
            : 'List of Accounts'
        let body: ReactNode
        if (!listOption) {
          body = <Empty title="Select an option" desc="Choose what to view or print from the dropdown above." />
        } else if (listOption === 'opening') {
          {
            // Opening Balance Form grouped as Assets → Liabilities → Equity,
            // each band subtotalled, then a grand total proving Dr = Cr.
            const clsKey = (a: typeof accounts[number]) => {
              const cls = (ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))?.classLabel
                ?? String(a.type || '')).toUpperCase()
              return cls.startsWith('ASSET') ? 'Assets' : cls.startsWith('LIABILIT') ? 'Liabilities' : 'Equity'
            }
            const isDr = (a: typeof accounts[number]) => {
              const def = ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))
              return def ? def.normalBalance === 'DEBIT' : (a.type === 'asset' || a.type === 'expense')
            }
            const obGrouped: ReactNode[][] = []
            let grandDr = 0
            let grandCr = 0
            for (const band of ['Assets', 'Liabilities', 'Equity'] as const) {
              const inBand = openingAccounts
                .filter((a) => clsKey(a) === band)
                .slice()
                .sort((x, y) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name))
              if (!inBand.length) continue
              let bandDr = 0
              let bandCr = 0
              obGrouped.push([<span className="font-bold uppercase tracking-wide">{band} ({inBand.length})</span>, '', '', '', ''])
              for (const a of inBand) {
                const bal = a.primaryBalance ?? 0
                if (isDr(a)) bandDr += bal; else bandCr += bal
                obGrouped.push([
                  <span className="pl-4">{a.code}</span>,
                  <span className="font-semibold">{a.name}</span>,
                  isDr(a) ? formatGhs(bal) : '—',
                  isDr(a) ? '—' : formatGhs(bal),
                  a.balanceAsOf ? dFmt(a.balanceAsOf) : '—',
                ])
              }
              grandDr += bandDr
              grandCr += bandCr
              obGrouped.push([
                <span className="font-bold">Total {band.toLowerCase()}</span>, '',
                <span className="font-bold">{formatGhs(bandDr)}</span>,
                <span className="font-bold">{formatGhs(bandCr)}</span>, '',
              ])
            }
            obGrouped.push([
              <span className="font-bold">Grand Total</span>, '',
              <span className="font-bold">{formatGhs(grandDr)}</span>,
              <span className="font-bold">{formatGhs(grandCr)}</span>, '',
            ])
            body = <T head={['Code', 'Account', curTitle('Debit'), curTitle('Credit'), 'As of']} right={[2, 3]} rows={obGrouped} />
          }
        } else if (listOption === 'fixedOpening') {
          body = fixedAssets.length
            ? <T head={['Code', 'Account', curTitle('Debit'), curTitle('Credit'), 'As of']} right={[2, 3]} rows={obRows(fixedAssets)} />
            : <Empty title="No fixed asset accounts" desc="Accounts under the Fixed Assets type appear here." />
        } else {
          // Accounts list grouped by CLASS (Assets, Liabilities, Income,
          // Expenses, Equity), with the account type as a sub-heading.
          // Every account in the chart, bank accounts included — nothing is
          // hidden by balance or reporting preferences.
          const listed = accounts
            .slice()
            .sort((x, y) => (x.code || '').localeCompare(y.code || '') || x.name.localeCompare(y.name))
          const defFor = (a: typeof accounts[number]) => ACCOUNT_TYPE_DEFS.find((t) => t.id === Number(a.accountTypeId))
          const typeName = (a: typeof accounts[number]) =>
            defFor(a)?.name || (a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : 'Unclassified')
          const classOf = (a: typeof accounts[number]) =>
            (defFor(a)?.classLabel ?? String(a.type || 'UNCLASSIFIED')).toUpperCase()
          const CLASS_LABELS: Record<string, string> = {
            ASSETS: 'Assets', ASSET: 'Assets', LIABILITIES: 'Liabilities', LIABILITY: 'Liabilities',
            INCOME: 'Income', EXPENSES: 'Expenses', EXPENSE: 'Expenses', EQUITY: 'Equity',
          }
          const CLASS_ORDER = ['ASSETS', 'ASSET', 'LIABILITIES', 'LIABILITY', 'INCOME', 'EXPENSES', 'EXPENSE', 'EQUITY']
          const classes = [
            ...CLASS_ORDER.filter((c) => listed.some((a) => classOf(a) === c)),
            ...[...new Set(listed.map(classOf))].filter((c) => !CLASS_ORDER.includes(c)),
          ]
          const listRows: ReactNode[][] = []
          for (const c of classes) {
            const inClass = listed.filter((a) => classOf(a) === c)
            listRows.push([
              <span className="font-bold uppercase tracking-wide">{CLASS_LABELS[c] ?? c} ({inClass.length})</span>,
              '', '',
            ])
            for (const tName of [...new Set(inClass.map(typeName))]) {
              const inType = inClass.filter((a) => typeName(a) === tName)
              listRows.push([<span className="pl-4 font-semibold italic">{tName} ({inType.length})</span>, '', ''])
              for (const a of inType) {
                listRows.push([
                  <span className="pl-8">{a.code}</span>,
                  <span className="font-semibold">{a.name}</span>,
                  defFor(a)?.normalBalance === 'CREDIT' ? 'Credit' : 'Debit',
                ])
              }
            }
          }
          body = listed.length
            ? <T head={['Code', 'Account', 'Normal Balance']} rows={listRows} />
            : <Empty title="No accounts" desc="No accounts match the current financial reporting preferences." />
        }
        return {
          title,
          node: (
            <div>
              {/* Select the Option and Print sit on one line. */}
              <div className="mb-6 flex w-full max-w-2xl flex-nowrap items-stretch gap-3 overflow-x-auto pb-1">
                <div className="flex min-w-0 flex-1 items-stretch">
                  <span className="flex w-40 shrink-0 items-center rounded-l-md border border-r-0 border-line bg-black/[0.02] px-3 text-sm font-bold dark:bg-white/[0.04]">Select the Option</span>
                  <div className="min-w-0 flex-1">
                    <Select value={listOption} onChange={(e) => setListOption(e.target.value)} placeholder="Please Select...">
                      <option value="">Please Select...</option>
                      <option value="list">Print Accounts List</option>
                      <option value="opening">Print Opening Balance Form</option>
                      <option value="fixedOpening">Print Fixed Asset Opening Balance Form</option>
                    </Select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!listOption}
                  title={listOption ? 'Print this list' : 'Choose an option first'}
                  onClick={() => { if (listOption) printAccountsList(listOption) }}
                  className="inline-flex h-10 min-w-24 shrink-0 cursor-pointer items-center justify-center self-center rounded-md bg-[#2e75b6] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Print
                </button>
              </div>
              {body}
            </div>
          ),
        }
      }
      case 'ledger': {
        const selAccts = ledgerAppAccounts
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is typeof accounts[number] => !!a)
        // Summary form (see the client's General Ledger Summary sample): one
        // line per account with opening balance, period movement and closing
        // balance, grouped by class and sub-class.
        const ls = buildLedgerSummary(ledgerAppFrom, ledgerAppTo, ledgerAppAccounts, ledgerHideZero)
        const cap = (s2: string) => (s2 ? s2.charAt(0) + s2.slice(1).toLowerCase() : s2)
        const amt = (n: number) => (Math.round(n * 100) === 0 ? '—' : formatGhs(n))
        const bold = (n: ReactNode) => <span className="font-bold">{n}</span>
        const sumOf = (list: typeof ls.rows, f: (r: typeof ls.rows[number]) => number) => list.reduce((n, r) => n + f(r), 0)
        const lsRows: ReactNode[][] = []
        for (const g of ls.groups) {
          const pl = g.classLabel === 'INCOME' || g.classLabel === 'EXPENSES'
          lsRows.push([<span className="font-bold uppercase tracking-wide">{cap(g.classLabel)}</span>, '', '', '', '', ''])
          for (const sub of g.subs) {
            if (sub.subclass && sub.subclass !== g.classLabel) {
              lsRows.push([<span className="pl-3 font-semibold italic">{cap(sub.subclass)}</span>, '', '', '', '', ''])
            }
            for (const r of sub.rows) {
              lsRows.push([
                <span className="pl-6">{ledgerShowCodes && r.code ? `${r.code} · ${r.name}` : r.name}</span>,
                r.pl ? '' : amt(r.opening), amt(r.debits), amt(r.credits), amt(r.net), r.pl ? '' : amt(r.closing),
              ])
            }
          }
          lsRows.push([
            bold(`Total ${cap(g.classLabel)}`),
            pl ? '' : bold(amt(sumOf(g.rows, (r) => r.opening))),
            bold(amt(sumOf(g.rows, (r) => r.debits))),
            bold(amt(sumOf(g.rows, (r) => r.credits))),
            bold(amt(sumOf(g.rows, (r) => r.net))),
            pl ? '' : bold(amt(sumOf(g.rows, (r) => r.closing))),
          ])
          if (g.classLabel === 'EXPENSES') {
            lsRows.push([bold('Profit (loss) for the period'), '', '', '', bold(amt(ls.profit)), ''])
          }
        }
        return {
          title: `Ledger Summary${selAccts.length === 1 ? ` — ${selAccts[0].name}` : selAccts.length > 1 ? ` — ${selAccts.length} accounts` : ''}`,
          node: (
            <div>
              <div className="mb-6 max-w-4xl space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Period">
                    <Select
                      value={ledgerPeriod}
                      onChange={(e) => { const v = e.target.value; setLedgerPeriod(v); const r = periodRange(v); if (r) { setLedgerFrom(r.from); setLedgerTo(r.to) } }}
                      placeholder="Select period"
                    >
                      <option value="">Select period</option>
                      {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                    </Select>
                  </Field>
                  <Field label="Dated From">
                    <DatePicker value={ledgerFrom} onChange={(v) => { setLedgerFrom(v); setLedgerPeriod('') }} max={ledgerTo || undefined} placeholder="Dated from" />
                  </Field>
                  <Field label="Dated To">
                    <DatePicker value={ledgerTo} onChange={(v) => { setLedgerTo(v); setLedgerPeriod('') }} min={ledgerFrom || undefined} placeholder="Dated to" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-[#2e75b6]"
                      checked={ledgerShowCodes}
                      onChange={(e) => setLedgerShowCodes(e.target.checked)}
                    />
                    Show account codes
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-[#2e75b6]"
                      checked={ledgerHideZero}
                      onChange={(e) => setLedgerHideZero(e.target.checked)}
                    />
                    Exclude zero balances
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <Field label="Account Name">
                      <MultiSelect
                        options={accounts.map((a) => ({ value: a.id, label: a.code ? `${a.code} · ${a.name}` : a.name }))}
                        values={ledgerAccounts}
                        onChange={setLedgerAccounts}
                        placeholder="Select accounts…"
                        aria-label="Account Name"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    disabled={!(ledgerFrom && ledgerTo)}
                    title={ledgerFrom && ledgerTo ? 'Generate the ledger summary' : 'Choose Dated From and Dated To first'}
                    onClick={() => { if (!(ledgerFrom && ledgerTo)) return; setLedgerAppAccounts(ledgerAccounts); setLedgerAppFrom(ledgerFrom); setLedgerAppTo(ledgerTo); setLedgerGenerated(true) }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLedgerPeriod(''); setLedgerAccounts([]); setLedgerFrom(''); setLedgerTo(''); setLedgerAppAccounts([]); setLedgerAppFrom(''); setLedgerAppTo(''); setLedgerGenerated(false); setLedgerShowCodes(true); setLedgerHideZero(true) }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (ledgerGenerated && ledgerAppFrom && ledgerAppTo) printLedgerSummary() }}
                    disabled={!(ledgerGenerated && ledgerAppFrom && ledgerAppTo)}
                    title={ledgerGenerated && ledgerAppFrom && ledgerAppTo ? 'Print the ledger summary' : 'Generate the summary first'}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Print
                  </button>
                </div>
              </div>
              {ledgerGenerated && ledgerAppFrom && ledgerAppTo ? (
                lsRows.length
                  ? <T
                      head={['Account', curTitle('Opening balance'), curTitle('Total debits'), curTitle('Total credits'), curTitle('Net movement'), curTitle('Closing balance')]}
                      right={[1, 2, 3, 4, 5]}
                      rows={lsRows}
                    />
                  : <Empty title="No accounts to report" desc="Adjust the date range, or pick different accounts." />
              ) : (
                <Empty title="Set a date range to generate the summary" desc="Choose Dated From and Dated To (or pick a Period), optionally pick accounts — leave empty for every account — then click Generate." />
              )}
            </div>
          ),
        }
      }
      case 'subLedger': {
        const selAccts = subLedgerAppAccounts
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is typeof accounts[number] => !!a)
        const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
        // Collect all entries touching a given account (shared with the printable sheet).
        const collect = buildSubLedgerRows

        // Account Name options: only accounts that actually carry transactions
        // (a receipt/payment header or line, or a journal line) WITHIN the
        // selected Period / Dated From–To. With no period set, the whole history
        // counts.
        const acctIdsWithTxn = (from: string, to: string) => {
          const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)
          const ids = new Set<string>()
          for (const r of live.receipts) if (inRange(r.date)) { ids.add(r.depositAccountId); for (const l of r.lines || []) ids.add(l.accountId) }
          for (const p of live.payments) if (inRange(p.date)) { ids.add(p.paymentAccountId); for (const l of p.lines || []) ids.add(l.accountId) }
          for (const j of live.journals) if (inRange(j.date)) for (const l of j.lines) ids.add(l.accountId)
          return ids
        }
        const postedAcctIds = acctIdsWithTxn(subLedgerFrom, subLedgerTo)
        const accountOptions = accounts.filter((a) => postedAcctIds.has(a.id))
        /** Changing the period re-scopes the account list, so drop any picked
            account that no longer has activity and reset the dependent filters. */
        const repruneForDates = (from: string, to: string) => {
          const ok = acctIdsWithTxn(from, to)
          setSubLedgerAccounts((prev) => {
            const kept = prev.filter((id) => ok.has(id))
            if (kept.length !== prev.length) { setSubLedgerClass(''); setSubLedgerNames([]) }
            return kept
          })
        }

        // Stakeholder Class / Name options are driven by the ACCOUNT selection:
        // only classes (and names) that actually have transactions in the chosen
        // account(s) — within the selected period — are offered. With no account
        // picked yet there is nothing to narrow by, so both lists stay empty.
        const pendingEntries = subLedgerAccounts
          .flatMap((id) => collect(id))
          .filter((e) => (!subLedgerFrom || e.date >= subLedgerFrom) && (!subLedgerTo || e.date <= subLedgerTo))
        const classOptions = Array.from(new Set(pendingEntries.map((e) => e.cls)))
          .filter(Boolean).sort((a, b) => a.localeCompare(b))
        // Name options: names seen in those accounts, narrowed to the pending class when chosen.
        const nameOptions = Array.from(new Set(
          pendingEntries.filter((e) => !subLedgerClass || e.cls === subLedgerClass).map((e) => e.name),
        )).filter((n) => n && n !== '—').sort((a, b) => a.localeCompare(b))

        // Report data comes from the APPLIED selection (committed on Generate).
        const appNameSet = new Set(subLedgerAppNames)
        /** Standard ledger presentation: balance = Σdebit − Σcredit, shown as an
            absolute amount tagged DR (debit balance) or CR (credit balance).
            No per-type sign flipping — the DR/CR tag carries that meaning. */
        const drcr = (n: number) => `${formatGhs(Math.abs(n))} ${n < 0 ? 'CR' : 'DR'}`
        const matchesFilters = (r: { cls: string; name: string }) =>
          (!subLedgerAppClass || r.cls === subLedgerAppClass) && (!appNameSet.size || appNameSet.has(r.name))
        // Build a per-account section, each with its own running balance and summary.
        const sections = selAccts.map((a) => {
          const allRows = collect(a.id).filter(matchesFilters)
          // Opening balance brought forward: everything posted BEFORE the period.
          const opening = subLedgerAppFrom
            ? allRows.filter((r) => r.date < subLedgerAppFrom).reduce((s, r) => s + r.debit - r.credit, 0)
            : 0
          const scoped = allRows
            .filter((r) => (!subLedgerAppFrom || r.date >= subLedgerAppFrom) && (!subLedgerAppTo || r.date <= subLedgerAppTo))
            .sort((x, y) => x.date.localeCompare(y.date) || x.ref.localeCompare(y.ref))

          const totDebit = scoped.reduce((s, r) => s + r.debit, 0)
          const totCredit = scoped.reduce((s, r) => s + r.credit, 0)
          const closing = opening + totDebit - totCredit

          // Balance b/f → transactions (running balance) → totals → balance c/d.
          let bal = opening
          const detailRows: ReactNode[][] = [
            ['', '', <span className="font-semibold italic">Balance b/f</span>, '—', '—', <span className="font-semibold">{drcr(opening)}</span>],
            ...scoped.map((r) => {
              bal += r.debit - r.credit
              return [dFmt(r.date), r.ref, r.party, r.debit ? formatGhs(r.debit) : '—', r.credit ? formatGhs(r.credit) : '—', <span className="font-semibold">{drcr(bal)}</span>]
            }),
            [
              '', '',
              <span className="font-bold">Total for the period</span>,
              <span className="font-bold">{formatGhs(totDebit)}</span>,
              <span className="font-bold">{formatGhs(totCredit)}</span>,
              '',
            ],
            ['', '', <span className="font-bold italic">Balance c/d</span>, '—', '—', <span className="font-bold">{drcr(closing)}</span>],
          ]

          // Summary per sub-account (party): opening, movement, closing.
          const sumMap = new Map<string, { open: number; debit: number; credit: number }>()
          const bucket = (party: string) => {
            const e = sumMap.get(party) ?? { open: 0, debit: 0, credit: 0 }
            sumMap.set(party, e)
            return e
          }
          // Cover every stakeholder seen on the account, even with no movement.
          for (const r of allRows) bucket(r.party)
          if (subLedgerAppFrom) for (const r of allRows) if (r.date < subLedgerAppFrom) bucket(r.party).open += r.debit - r.credit
          for (const r of scoped) { const e = bucket(r.party); e.debit += r.debit; e.credit += r.credit }
          const summaryRows: ReactNode[][] = [...sumMap.entries()]
            .sort((x, y) => x[0].localeCompare(y[0]))
            .map(([party, e]) => [
              <span className="font-semibold">{party}</span>,
              drcr(e.open),
              formatGhs(e.debit),
              formatGhs(e.credit),
              <span className="font-semibold">{drcr(e.open + e.debit - e.credit)}</span>,
            ])
          if (summaryRows.length) summaryRows.push([
            <span className="font-bold">Total</span>,
            <span className="font-bold">{drcr(opening)}</span>,
            <span className="font-bold">{formatGhs(totDebit)}</span>,
            <span className="font-bold">{formatGhs(totCredit)}</span>,
            <span className="font-bold">{drcr(closing)}</span>,
          ])
          return { accId: a.id, name: a.code ? `${a.code} · ${a.name}` : a.name, detailRows, summaryRows, hasRows: scoped.length > 0 }
        })

        return {
          title: `Sub-Ledger${selAccts.length === 1 ? ` — ${selAccts[0].name}` : selAccts.length > 1 ? ` — ${selAccts.length} accounts` : ''}${subLedgerView === 'summary' ? ' (Summary)' : ''}`,
          node: (
            <div>
              <div className="mb-6 max-w-4xl space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Period">
                    <Select
                      value={subLedgerPeriod}
                      onChange={(e) => { const v = e.target.value; setSubLedgerPeriod(v); const r = periodRange(v); if (r) { setSubLedgerFrom(r.from); setSubLedgerTo(r.to); repruneForDates(r.from, r.to) } else repruneForDates('', '') }}
                      placeholder="Select period"
                    >
                      <option value="">Select period</option>
                      {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                    </Select>
                  </Field>
                  <Field label="Dated From">
                    <DatePicker value={subLedgerFrom} onChange={(v) => { setSubLedgerFrom(v); setSubLedgerPeriod(''); repruneForDates(v, subLedgerTo) }} max={subLedgerTo || undefined} placeholder="Dated from" />
                  </Field>
                  <Field label="Dated To">
                    <DatePicker value={subLedgerTo} onChange={(v) => { setSubLedgerTo(v); setSubLedgerPeriod(''); repruneForDates(subLedgerFrom, v) }} min={subLedgerFrom || undefined} placeholder="Dated to" />
                  </Field>
                </div>
                {/* Account Name comes first: it drives which Stakeholder Classes
                    (and Names) are offered below. */}
                <div className="grid gap-4">
                  <Field label="Account Name">
                    <MultiSelect
                      options={accountOptions.map((a) => ({ value: a.id, label: a.code ? `${a.code} · ${a.name}` : a.name }))}
                      values={subLedgerAccounts}
                      onChange={(v) => { setSubLedgerAccounts(v); setSubLedgerClass(''); setSubLedgerNames([]) }}
                      placeholder="Select accounts…"
                      aria-label="Account Name"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Stakeholder Class">
                    <Select value={subLedgerClass} onChange={(e) => { setSubLedgerClass(e.target.value); setSubLedgerNames([]) }} placeholder={subLedgerAccounts.length ? 'Please Select...' : 'Select an account first'} disabled={!subLedgerAccounts.length}>
                      <option value="">All classes</option>
                      {classOptions.map((c) => (<option key={c} value={c}>{cap(c)}</option>))}
                    </Select>
                  </Field>
                  {/* Name only appears once a Stakeholder Class is picked — the
                      names shown are the ones in that class for the chosen account(s). */}
                  {!!subLedgerClass && (
                    <Field label="Name">
                      <MultiSelect
                        options={nameOptions.map((n) => ({ value: n, label: n }))}
                        values={subLedgerNames}
                        onChange={setSubLedgerNames}
                        placeholder="All names"
                        aria-label="Name"
                      />
                    </Field>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <button
                    type="button"
                    disabled={!subLedgerAccounts.length}
                    onClick={() => { setSubLedgerAppAccounts(subLedgerAccounts); setSubLedgerAppFrom(subLedgerFrom); setSubLedgerAppTo(subLedgerTo); setSubLedgerAppClass(subLedgerClass); setSubLedgerAppNames(subLedgerNames) }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubLedgerPeriod(''); setSubLedgerAccounts([]); setSubLedgerFrom(''); setSubLedgerTo(''); setSubLedgerClass(''); setSubLedgerNames([]); setSubLedgerAppAccounts([]); setSubLedgerAppFrom(''); setSubLedgerAppTo(''); setSubLedgerAppClass(''); setSubLedgerAppNames([]); setSubLedgerView('detail') }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => printSubLedger('detail')}
                    disabled={!subLedgerAppAccounts.length}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Print Sub-Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => printSubLedger('summary')}
                    disabled={!subLedgerAppAccounts.length}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#1f4e79] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Print Sub-Ledger Summary
                  </button>
                </div>
              </div>
              {subLedgerAppAccounts.length ? (
                <div className="space-y-6">
                  {sections.map((s) => (
                    <div key={s.accId} className="space-y-2">
                      <h4 className="text-sm font-bold text-ink dark:text-white">{s.name}{subLedgerView === 'summary' ? ' (Summary)' : ''}</h4>
                      {subLedgerView === 'summary'
                        ? s.summaryRows.length ? <T head={['Stakeholder', curTitle('Opening'), curTitle('Debit'), curTitle('Credit'), curTitle('Closing')]} right={[1, 2, 3, 4]} rows={s.summaryRows} /> : <Empty title="No entries for the selected filters" desc="Adjust the date range, class or name." />
                        : s.hasRows ? <T head={['Date', 'Voucher', 'Particulars', curTitle('Debit'), curTitle('Credit'), curTitle('Balance')]} right={[3, 4, 5]} rows={s.detailRows} /> : <Empty title="No entries for the selected filters" desc="Adjust the date range, class or name." />}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="Select accounts to generate the sub-ledger" desc="Pick one or more accounts above (optionally set a date range, class or name), then click Generate." />
              )}
            </div>
          ),
        }
      }
      case 'generalLedger': {
        const signOf = glSignOf
        const all = buildGlEntries()
        const scoped = all.filter((e) => (!glAppFrom || e.date >= glAppFrom) && (!glAppTo || e.date <= glAppTo))
        const glAppSet = new Set(glAppAccounts)
        const selectedAccts = accounts.filter((a) => glAppSet.has(a.id))

        // Accounts to group by: the selected ones, else every account with activity — in code order.
        const groupAccts = accounts
          .filter((a) => (glAppSet.size ? glAppSet.has(a.id) : scoped.some((e) => e.accId === a.id)))
          .sort((a, b) => (a.code || '').localeCompare(b.code || ''))

        const perPage = 10
        const totalPages = Math.max(1, Math.ceil(groupAccts.length / perPage))
        const page = Math.min(Math.max(1, glPage), totalPages)
        const pageAccts = groupAccts.slice((page - 1) * perPage, page * perPage)

        const num = (n: number) => formatGhsExact(n)
        const bodyRows: ReactNode[] = []
        for (const a of pageAccts) {
          const collapsed = !!glCollapsed[a.id]
          let beginning = a.primaryBalance ?? 0
          if (glAppFrom) for (const e of all) if (e.accId === a.id && e.date < glAppFrom) beginning += signOf(a) * (e.debit - e.credit)
          const accEntries = scoped.filter((e) => e.accId === a.id).sort((x, y) => x.date.localeCompare(y.date))
          const totDr = accEntries.reduce((s, e) => s + e.debit, 0)
          const totCr = accEntries.reduce((s, e) => s + e.credit, 0)
          const ending = beginning + signOf(a) * (totDr - totCr)
          bodyRows.push(
            <tr key={`h-${a.id}`} className="cursor-pointer bg-zinc-100 font-bold dark:bg-white/[0.06]" onClick={() => setGlCollapsed((m) => ({ ...m, [a.id]: !m[a.id] }))}>
              <td className="px-3 py-1.5" colSpan={6}><span className="mr-2 inline-block w-3 text-mist">{collapsed ? '▸' : '▾'}</span>{a.code}-{a.name}</td>
              <td className="px-3 py-1.5" /><td className="px-3 py-1.5" /><td className="px-3 py-1.5" />
            </tr>,
          )
          if (!collapsed) {
            bodyRows.push(
              <tr key={`b-${a.id}`} className="text-mist">
                <td className="px-3 py-1.5 italic" colSpan={6}>Opening Balance</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(0)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(0)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(beginning)}</td>
              </tr>,
            )
            let run = beginning
            for (let i = 0; i < accEntries.length; i++) {
              const e = accEntries[i]
              run += signOf(a) * (e.debit - e.credit)
              bodyRows.push(
                <tr key={`${a.id}-${i}`} className="border-t border-line/60">
                  <td className="px-3 py-1.5 whitespace-nowrap">{dFmt(e.date)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {/* Opens the source voucher in the shared voucher viewer. */}
                    <button
                      type="button"
                      onClick={() => setCbView({ kind: e.kind, id: e.srcId })}
                      title={`View ${e.kind} voucher ${e.ref}`}
                      className="cursor-pointer font-medium text-[#2e75b6] hover:underline"
                    >
                      {e.type}
                    </button>
                  </td>
                  <td className="px-3 py-1.5">{e.stakeholderClass}</td>
                  <td className="px-3 py-1.5">{e.memo}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setCbView({ kind: e.kind, id: e.srcId })}
                      title={`View ${e.kind} voucher ${e.ref}`}
                      className="cursor-pointer font-medium text-[#2e75b6] hover:underline"
                    >
                      {e.ref}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{e.check}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(e.debit)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(e.credit)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(run)}</td>
                </tr>,
              )
            }
            bodyRows.push(
              <tr key={`e-${a.id}`} className="border-t border-line bg-zinc-50 font-semibold dark:bg-white/[0.03]">
                <td className="px-3 py-1.5" colSpan={6}>Closing Balance</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(totDr)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(totCr)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{num(ending)}</td>
              </tr>,
            )
          }
        }

        return {
          title: `General Ledger${selectedAccts.length === 1 ? ` — ${selectedAccts[0].name}` : selectedAccts.length > 1 ? ` — ${selectedAccts.length} accounts` : ''}`,
          node: (
            <div>
              <div className="mb-6 max-w-4xl space-y-4 print:hidden">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Period">
                    <Select
                      value={glPeriod}
                      onChange={(e) => { const v = e.target.value; setGlPeriod(v); const r = periodRange(v); if (r) { setGlFrom(r.from); setGlTo(r.to) } }}
                      placeholder="Select period"
                    >
                      <option value="">Select period</option>
                      {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                    </Select>
                  </Field>
                  <Field label="Dated From">
                    <DatePicker value={glFrom} onChange={(v) => { setGlFrom(v); setGlPeriod('') }} max={glTo || undefined} placeholder="Dated from" />
                  </Field>
                  <Field label="Dated To">
                    <DatePicker value={glTo} onChange={(v) => { setGlTo(v); setGlPeriod('') }} min={glFrom || undefined} placeholder="Dated to" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <Field label="Account Name">
                      <MultiSelect
                        options={accounts.map((a) => ({ value: a.id, label: a.code ? `${a.code} · ${a.name}` : a.name }))}
                        values={glAccounts}
                        onChange={setGlAccounts}
                        placeholder="All accounts"
                        aria-label="Account Name"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    disabled={!glFrom || !glTo}
                    onClick={() => { setGlAppFrom(glFrom); setGlAppTo(glTo); setGlAppAccounts(glAccounts); setGlPage(1) }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGlPeriod(''); setGlFrom(''); setGlTo(''); setGlAccounts([]); setGlAppFrom(''); setGlAppTo(''); setGlAppAccounts([]); setGlPage(1) }}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={!(glAppFrom && glAppTo)}
                    onClick={() => { if (!(glAppFrom && glAppTo)) return; printGeneralLedger() }}
                    title={glAppFrom && glAppTo ? 'Print the general ledger' : 'Generate the ledger first'}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Print
                  </button>
                  {exportRows.length > 0 && <ExportButtons filename="statements-generalLedger" rows={exportRows} compact onPdf={printGeneralLedger} />}
                </div>
              </div>
              {!(glAppFrom && glAppTo) ? (
                <Empty title="Set a date range to generate the ledger" desc="Choose Dated From and Dated To, then click Generate to populate the General Ledger." />
              ) : groupAccts.length ? (
                <>
                  <div className="overflow-x-auto rounded-lg border border-line shadow-sm">
                    <table className="w-full min-w-[1100px] text-[11px]">
                      <thead>
                        <tr className="bg-[#1e293b] text-left text-[10px] font-bold uppercase tracking-wide text-white">
                          <th className="px-3 py-2">Account/Date</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Stakeholders Class</th>
                          <th className="px-3 py-2">Description/Memo</th>
                          <th className="px-3 py-2">Ref. No</th>
                          <th className="px-3 py-2">Cheque#</th>
                          <th className="px-3 py-2 text-right">{curTitle('Debit')}</th>
                          <th className="px-3 py-2 text-right">{curTitle('Credit')}</th>
                          <th className="px-3 py-2 text-right">{curTitle('Balance')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-transparent">{bodyRows}</tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-end gap-1.5 text-xs print:hidden">
                      <button type="button" disabled={page <= 1} onClick={() => setGlPage(page - 1)} className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-line disabled:cursor-not-allowed disabled:opacity-40">‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" onClick={() => setGlPage(n)} className={`inline-flex size-7 cursor-pointer items-center justify-center rounded border ${n === page ? 'border-[#2e75b6] bg-[#2e75b6] text-white' : 'border-line'}`}>{n}</button>
                      ))}
                      <button type="button" disabled={page >= totalPages} onClick={() => setGlPage(page + 1)} className="inline-flex size-7 cursor-pointer items-center justify-center rounded border border-line disabled:cursor-not-allowed disabled:opacity-40">›</button>
                      <span className="ml-1 rounded border border-line px-2 py-1 text-mist">10 / page</span>
                    </div>
                  )}
                </>
              ) : (
                <Empty title="No ledger activity for the selected dates" desc="Adjust the date range or post vouchers." />
              )}
            </div>
          ),
        }
      }
      case 'generalJournal': {
        const rows: ReactNode[][] = []
        // All Reports (embedded) commits dates via Generate; the Report Viewer,
        // which has no Generate button, keeps filtering live as before.
        const gjF = embedded ? gjAppFrom : gjFrom
        const gjT = embedded ? gjAppTo : gjTo
        const gjSrc = embedded ? gjAppSource : gjSource
        const entries = buildGjEntries(gjF, gjT, gjSrc)
        for (const e of entries) {
          e.lines.forEach((l, i) => {
            rows.push([
              i === 0 ? dFmt(e.date) : '',
              i === 0 ? e.no : '',
              i === 0 ? <span title={e.desc}>{e.desc || '—'}</span> : '',
              accountName(accounts, l.accountId),
              l.debit ? formatGhs(l.debit) : '',
              l.credit ? formatGhs(l.credit) : '',
            ])
          })
        }
        return {
          title: 'General Journal',
          node: (
            <div>
              <div className={`mb-6 space-y-4 ${embedded ? '' : 'max-w-2xl'}`}>
                <div className={embedded ? 'flex flex-wrap items-end gap-4' : 'grid gap-4 sm:grid-cols-3'}>
                  <div className={embedded ? 'min-w-[180px] flex-1' : ''}>
                    <Field label="Period">
                      <Select
                        value={gjPeriod}
                        onChange={(e) => { const v = e.target.value; setGjPeriod(v); const r = periodRange(v); if (r) { setGjFrom(r.from); setGjTo(r.to) } }}
                        placeholder="Select period"
                      >
                        <option value="">Select period</option>
                        {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                      </Select>
                    </Field>
                  </div>
                  <div className={embedded ? 'min-w-[180px] flex-1' : ''}>
                    <Field label="Dated From">
                      <DatePicker value={gjFrom} onChange={(v) => { setGjFrom(v); setGjPeriod('') }} max={gjTo || undefined} placeholder="start date" />
                    </Field>
                  </div>
                  <div className={embedded ? 'min-w-[180px] flex-1' : ''}>
                    <Field label="Dated To">
                      <DatePicker value={gjTo} onChange={(v) => { setGjTo(v); setGjPeriod('') }} min={gjFrom || undefined} placeholder="end date" />
                    </Field>
                  </div>
                  <div className={embedded ? 'min-w-[180px] flex-1' : ''}>
                    <Field label="Source">
                      <Select value={gjSource} onChange={(e) => setGjSource(e.target.value)} placeholder="All entries">
                        <option value="">All entries</option>
                        <option value="journal">Journal vouchers only</option>
                        <option value="cashbank">Cash &amp; bank only</option>
                      </Select>
                    </Field>
                  </div>
                  {embedded && (
                    <div className="flex items-center gap-2 print:hidden">
                      {/* Generate / Clear mirror the General Ledger: the table is
                          populated from the APPLIED dates, committed on Generate. */}
                      <button
                        type="button"
                        disabled={!gjFrom || !gjTo}
                        onClick={() => { setGjAppFrom(gjFrom); setGjAppTo(gjTo); setGjAppSource(gjSource) }}
                        title={!gjFrom || !gjTo ? 'Choose Dated From and Dated To first' : 'Generate the general journal'}
                        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => { setGjPeriod(''); setGjFrom(''); setGjTo(''); setGjSource(''); setGjAppFrom(''); setGjAppTo(''); setGjAppSource('') }}
                        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={printGeneralJournal}
                        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Print
                      </button>
                      {exportRows.length > 0 && <ExportButtons filename="statements-generalJournal" rows={exportRows} compact onPdf={printGeneralJournal} />}
                    </div>
                  )}
                </div>
                {!embedded && (
                  <button
                    type="button"
                    onClick={printGeneralJournal}
                    className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-[#1f4e79] px-6 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Print General Journal
                  </button>
                )}
              </div>
              {embedded && !(gjAppFrom && gjAppTo)
                ? <Empty title="Set a date range to generate the journal" desc="Choose Dated From and Dated To, then click Generate to populate the General Journal." />
                : rows.length
                  ? <T head={['Date', 'Voucher', 'Description', 'Account', curTitle('Debit'), curTitle('Credit')]} right={[4, 5]} rows={rows} />
                  : <Empty title="No journal entries for the selected dates" desc="Adjust the date range, or post journal vouchers." />}
            </div>
          ),
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
      {/* All Reports already prints the report name above the card, so the
          embedded List of Accounts drops its own heading. */}
      {!(embedded && report === 'listAccounts') && (
        <h2 className="mb-4 flex items-center gap-2.5 border-b border-line pb-3 text-2xl font-semibold text-[#2e75b6] dark:text-sky-300">
          {report === 'checkBalance' ? <LayoutGrid className="size-6 shrink-0" /> : <BookMarked className="size-6 shrink-0" />}
          {current.title}
        </h2>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-2 empty:mb-0">
        {report !== 'ledger' && report !== 'generalLedger' && report !== 'subLedger' && report !== 'listAccounts' && !(embedded && report === 'generalJournal') && !(embedded && report === 'checkBalance') && !(embedded && report === 'bankBook') && !(embedded && report === 'cashBook') && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-bold text-white transition hover:brightness-110"
          >
            Print
          </button>
        )}
        {/* List of Accounts drives its own Print from the option panel, so the
            duplicate Print + export buttons are hidden for it. */}
        {report !== 'generalLedger' && report !== 'listAccounts' && !(embedded && report === 'generalJournal') && !(embedded && report === 'bankBook') && !(embedded && report === 'cashBook') && exportRows.length > 0 && <ExportButtons filename={`statements-${report}`} rows={exportRows} compact onPdf={report === 'ledger' ? printLedgerSummary : report === 'subLedger' ? () => printSubLedger(subLedgerView) : undefined} />}
      </div>
      <div ref={bodyRef}>{current.node}</div>
      {(() => {
        if (!cbView) return null
        const closed = !!app.accountingSettings.closeTheBooks
        // Journal entries reach the Cash Book when a line debits/credits a cash
        // account. Show a debit/credit view and edit via the Journal Entry form.
        if (cbView.kind === 'journal') {
          const jv = live.journals.find((j) => j.id === cbView.id)
          const jTotalDr = jv ? jv.lines.reduce((s, l) => s + (l.debit || 0), 0) : 0
          const jTotalCr = jv ? jv.lines.reduce((s, l) => s + (l.credit || 0), 0) : 0
          return (
            <Modal open onClose={() => setCbView(null)} title={jv ? `Journal Entry — ${jv.number}` : 'Voucher'} wide>
              {!jv ? (
                <p className="text-sm text-mist">Journal entry not found — it may have been deleted.</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                    {([
                      ['Voucher No.', jv.number],
                      ['Date', dFmt(jv.date)],
                      ['Stakeholder', jv.stakeholder || '—'],
                      ['Currency', jv.currency || 'GHS'],
                      ['Status', jv.status],
                    ] as [string, string][]).map(([k, val]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-mist">{k}</span>
                        <span className="text-right text-xs font-semibold capitalize">{val}</span>
                      </div>
                    ))}
                  </div>
                  {jv.description && <p className="text-xs text-mist"><span className="font-semibold">Description: </span>{jv.description}</p>}
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-black/[0.03] text-left dark:bg-white/[0.04]">
                          <th className="px-3 py-2 font-semibold">Account</th>
                          <th className="px-3 py-2 text-right font-semibold">{curTitle('Debit')}</th>
                          <th className="px-3 py-2 text-right font-semibold">{curTitle('Credit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jv.lines.map((l, i) => (
                          <tr key={i} className={'border-t border-line' + (cashAcctIds.has(l.accountId) ? ' bg-emerald-500/[0.06]' : '')}>
                            <td className="px-3 py-2">{accountName(accounts, l.accountId)}{cashAcctIds.has(l.accountId) && <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">cash</span>}</td>
                            <td className="px-3 py-2 text-right font-medium">{l.debit ? formatGhs(l.debit) : '—'}</td>
                            <td className="px-3 py-2 text-right font-medium">{l.credit ? formatGhs(l.credit) : '—'}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-line bg-black/[0.03] dark:bg-white/[0.04]">
                          <td className="px-3 py-2 font-semibold">Total</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatGhs(jTotalDr)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatGhs(jTotalCr)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    {closed && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Accounting period is closed — editing is disabled.</span>}
                    <button
                      type="button"
                      disabled={closed}
                      onClick={() => { navigate(`/admin/accounting/journal-voucher?edit=${jv.id}`); setCbView(null) }}
                      className={'inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold text-white transition ' + (closed ? 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600' : 'cursor-pointer bg-emerald-500 hover:brightness-110')}
                      title={closed ? 'The accounting period is closed' : 'Open this journal entry for editing'}
                    >
                      Edit Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => setCbView(null)}
                      className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </Modal>
          )
        }
        const isR = cbView.kind === 'receipt'
        const v = (isR ? live.receipts.find((r) => r.id === cbView.id) : live.payments.find((p) => p.id === cbView.id)) as ReceiptVoucher | PaymentVoucher | undefined
        const party = v ? (isR ? (v as ReceiptVoucher).receivedFrom : (v as PaymentVoucher).paidTo) : ''
        const moneyAcct = v ? (isR ? (v as ReceiptVoucher).depositAccountId : (v as PaymentVoucher).paymentAccountId) : ''
        const lines = v?.lines ?? []
        const total = lines.reduce((s, l) => s + (l.amount || 0), 0) || v?.amount || 0
        return (
          <Modal open onClose={() => setCbView(null)} title={v ? `${isR ? 'Receipt' : 'Payment'} Voucher — ${v.number}` : 'Voucher'} wide>
            {!v ? (
              <p className="text-sm text-mist">Voucher not found — it may have been deleted.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {([
                    ['Voucher No.', v.number],
                    ['Date', dFmt(v.date)],
                    [isR ? 'Received from' : 'Paid to', party || '—'],
                    [isR ? 'Deposit account' : 'Payment account', accountName(accounts, moneyAcct)],
                    ['Method', v.method || '—'],
                    ['Reference', v.referenceNo || '—'],
                    ['Currency', v.currency || 'GHS'],
                    ['Status', v.status],
                  ] as [string, string][]).map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-mist">{k}</span>
                      <span className="text-right text-xs font-semibold capitalize">{val}</span>
                    </div>
                  ))}
                </div>
                {v.description && <p className="text-xs text-mist"><span className="font-semibold">Description: </span>{v.description}</p>}
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-black/[0.03] text-left dark:bg-white/[0.04]">
                        <th className="px-3 py-2 font-semibold">Account</th>
                        <th className="px-3 py-2 font-semibold">Narration</th>
                        <th className="px-3 py-2 text-right font-semibold">{curTitle('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="px-3 py-2">{accountName(accounts, l.accountId)}</td>
                          <td className="px-3 py-2 text-mist">{l.narration || '—'}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatGhs(l.amount || 0)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-line bg-black/[0.03] dark:bg-white/[0.04]">
                        <td className="px-3 py-2 font-semibold" colSpan={2}>Total</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatGhs(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                  {closed && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Accounting period is closed — editing is disabled.</span>}
                  <button
                    type="button"
                    disabled={closed}
                    onClick={() => { navigate(`/admin/accounting/${isR ? 'receipt' : 'payment'}-voucher?edit=${v.id}`); setCbView(null) }}
                    className={'inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold text-white transition ' + (closed ? 'cursor-not-allowed bg-zinc-300 dark:bg-zinc-600' : 'cursor-pointer bg-emerald-500 hover:brightness-110')}
                    title={closed ? 'The accounting period is closed' : 'Open this voucher for editing'}
                  >
                    Edit Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbView(null)}
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:bg-zinc-50 dark:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </Modal>
        )
      })()}
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
