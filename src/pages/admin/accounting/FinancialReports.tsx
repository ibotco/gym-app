import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookMarked, ChevronLeft } from 'lucide-react'
import { Empty, SearchField, DatePicker, Select, Badge } from '../../../components/ui'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { tableToRows } from '../../../lib/tableExport'
import type { ExportRow } from '../../../lib/export'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { finTerms } from '../../../lib/orgTerms'
import { formatGhs } from '../../../lib/utils'
import { accountName, budgetTotal } from '../../../lib/accounting'
import { keepAccountRow, resolveFinPrefs } from '../../../lib/financialReporting'

export type FinId = 'sfp' | 'bssum' | 'csfp' | 'ie' | 'iecomp' | 'ieb' | 'ien' | 'cfs' | 'la' | 'notes' | 'bud' | 'tb' | 'pl12m' | 'plpct' | 'reconSummary' | 'reconDetail' | 'budgetOverview' | 'plBudgetVsActual' | 'plBudgetPerf'

export const FIN_REPORTS: { id: FinId; num: number; label: string; desc: string }[] = [
  { id: 'sfp', num: 1, label: 'Statement of Financial Position', desc: 'Assets, liabilities and equity at a date.' },
  { id: 'bssum', num: 2, label: 'Balance Sheet Summary', desc: 'A summary of what you own (assets), what you owe (liabilities), and what you invested (equity).' },
  { id: 'csfp', num: 3, label: 'Comparative Statement of Financial Position', desc: 'Compares the position across two periods.' },
  { id: 'ie', num: 4, label: 'Income and Expenditure Account', desc: 'Income against expenditure for the period.' },
  { id: 'iecomp', num: 5, label: 'Profit and Loss Comparison', desc: 'Your income, expenses, and net income (profit or loss) compared to last year.' },
  { id: 'ieb', num: 6, label: 'Comparative Income and Expenditure Acct. With Budgets', desc: 'Actual income and expenditure against budgets.' },
  { id: 'ien', num: 7, label: 'Comparative Income and Expenditure Account With Notes', desc: 'Income and expenditure with explanatory notes.' },
  { id: 'cfs', num: 8, label: 'Cash Flow Statement', desc: 'Cash and bank inflows and outflows.' },
  { id: 'tb', num: 9, label: 'Trial Balance', desc: 'Debit and credit totals proving the books balance.' },
  { id: 'la', num: 10, label: 'Liquidity Analysis', desc: 'Ability to meet short-term obligations.' },
  { id: 'notes', num: 11, label: 'Notes to the Financial Statement', desc: 'Supporting notes and disclosures.' },
  { id: 'bud', num: 12, label: 'Income and Expenditure Budget', desc: 'Budgeted income and expenditure.' },
  { id: 'pl12m', num: 13, label: 'Monthly Profit and Loss', desc: 'Your income, expenses, and net income (profit or loss). Statistics by month.' },
  { id: 'plpct', num: 14, label: 'Profit and Loss as % of total income', desc: 'Your expenses as a percentage of your total income.' },
  { id: 'reconSummary', num: 15, label: 'Reconciliation Summary', desc: 'Reconciliation Summary Report' },
  { id: 'reconDetail', num: 16, label: 'Reconciliation Detail', desc: 'Reconciliation Detail Report' },
  { id: 'budgetOverview', num: 17, label: 'Budget overview', desc: 'This report summarises your budgeted account balances.' },
  { id: 'plBudgetVsActual', num: 18, label: 'Profit and Loss Budget vs Actual', desc: 'This report shows how well you are meeting your budget. For each type of account, the report compares your budgeted amounts to your actual amounts.' },
  { id: 'plBudgetPerf', num: 19, label: 'Profit and loss budget performance', desc: 'This report compares actual amounts with budgeted amounts for the month, the fiscal year to date, and the annual budget.' },
]

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

/** Report catalogue with organization-type terminology applied. */
export function finReportItems(terms: ReturnType<typeof finTerms>) {
  return FIN_REPORTS.map((r) => {
    switch (r.id) {
      case 'sfp': return { ...r, label: terms.balanceSheet }
      case 'bssum': return { ...r, label: terms.balanceSheetSummary }
      case 'csfp': return { ...r, label: terms.balanceSheetComparison }
      case 'ie': return { ...r, label: terms.profitLoss }
      case 'iecomp': return { ...r, label: terms.profitLossComparison }
      case 'ieb': return { ...r, label: `Comparative ${terms.ieShort} Acct. With Budgets` }
      case 'ien': return { ...r, label: `Comparative ${terms.ieShort} Account With Notes` }
      default: return r
    }
  })
}

type Act = Map<string, { debit: number; credit: number }>

export function FinancialReportsPage({
  forcedReport = null,
  bodyOnly = false,
}: {
  /** Preselect this report on mount. */
  forcedReport?: FinId | null
  /** Render only the report body, for composition inside Accounts Reports. */
  bodyOnly?: boolean
} = {}) {
  const app = useApp()
  const { accounts, receipts, paymentVouchers, journals, budgets, banks, reconciliations } = app
  const { user } = useAuth()
  /** Reporting terminology follows the active company's organization type. */
  const terms = finTerms(app.companies.find((c) => c.id === userCompanyId(user, app.branches))?.orgType)

  /** Report names adapt to the organization type (same structure, different terminology). */
  const items = finReportItems(terms)

  const [report, setReport] = useState<FinId | null>(forcedReport ?? null)
  /** Expand the report list so every row shows at once. */
  const [showAll, setShowAll] = useState(false)
  const [q, setQ] = useState('')
  const [fromD, setFromD] = useState('')
  const [toD, setToD] = useState('')
  /** Accounting method for the position statements (Balance Sheet family). */
  const [method, setMethod] = useState('accrual')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [exportRows, setExportRows] = useState<ExportRow[]>([])
  useEffect(() => {
    setExportRows(tableToRows(bodyRef.current))
  }, [report, fromD, toD, method])

  const live = useMemo(() => ({
    receipts: receipts.filter((r) => r.status !== 'void'),
    payments: paymentVouchers.filter((p) => p.status !== 'void'),
    journals: journals.filter((j) => j.status !== 'void'),
  }), [receipts, paymentVouchers, journals])

  const buildMap = (inR: (d: string) => boolean, method = 'accrual'): Act => {
    const map: Act = new Map()
    const add = (id: string, d: number, c: number) => {
      const e = map.get(id) ?? { debit: 0, credit: 0 }
      e.debit += d
      e.credit += c
      map.set(id, e)
    }
    for (const r of live.receipts) if (inR(r.date)) {
      add(r.depositAccountId, r.amount, 0)
      for (const l of r.lines || []) add(l.accountId, 0, l.amount)
    }
    for (const p of live.payments) if (inR(p.date)) {
      add(p.paymentAccountId, 0, p.amount)
      for (const l of p.lines || []) add(l.accountId, l.amount, 0)
    }
    // Cash basis reports only real money movements (receipts & payments);
    // accrual basis additionally includes non-cash journal entries.
    if (method !== 'cash') for (const j of live.journals) if (inR(j.date)) for (const l of j.lines) add(l.accountId, l.debit, l.credit)
    return map
  }

  /** Activity within From–To (income & expenditure statements). */
  const period = useMemo(() => buildMap((d) => (!fromD || d >= fromD) && (!toD || d <= toD)), [live, fromD, toD])
  /** Balances stated as at the To date (position statements). */
  const asAt = useMemo(() => buildMap((d) => !toD || d <= toD), [live, toD])
  /** Activity before From — the comparison column. */
  const prior = useMemo(() => buildMap((d) => !!fromD && d < fromD), [live, fromD])

  const bal = (map: Act, id: string) => {
    const a = accounts.find((x) => x.id === id)
    const e = map.get(id)
    const net = (e?.debit ?? 0) - (e?.credit ?? 0)
    if (a && (a.type === 'liability' || a.type === 'equity' || a.type === 'income')) return -net
    return net
  }

  const sumType = (map: Act, types: string[]) =>
    accounts.filter((a) => types.includes(a.type) && map.has(a.id)).reduce((s, a) => s + bal(map, a.id), 0)

  /** Financial statement display options (Accounting → Settings → Financial Reporting Preferences). */
  const frPrefs = resolveFinPrefs(app.accountingSettings)
  /** Account display name — code-prefixed for audit tracing when the option is on. */
  const acctLabel = (a: { code: string; name: string }) =>
    frPrefs.showAccountCodes && a.code ? `${a.code} · ${a.name}` : a.name
  /** With zero-balance inclusion off, only accounts carrying a balance or transactions are shown. */
  const keepAcct = (...values: number[]) => keepAccountRow(frPrefs, ...values)

  const t = q.trim().toLowerCase()
  const visible = t ? items.filter((r) => r.label.toLowerCase().includes(t)) : items

  const budgetFor = (accountId: string, year: number) =>
    budgets.filter((b) => b.accountId === accountId && b.year === year).reduce((s, b) => s + budgetTotal(b), 0)

  const dFmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  }

  const render = (): { title: string; node: ReactNode } => {
    switch (report) {
      case 'sfp': {
        const asAt = buildMap((d) => !toD || d <= toD, method)
        const prev = buildMap((d) => !!fromD && d < fromD, method)
        const showPrev = frPrefs.enableComparativePeriods
        const prevCells = (cur: number, pv: number): ReactNode[] =>
          showPrev ? [formatGhs(pv), formatGhs(cur - pv)] : []
        const rows: ReactNode[][] = []
        const section = (title: string, type: string) => {
          const list = accounts.filter((a) => a.type === type && keepAcct(bal(asAt, a.id)))
          // Hide the whole group when every account in it was filtered out.
          if (frPrefs.includeZeroBalanceAccounts || list.length > 0) {
            rows.push([<b>{title}</b>, '', ...(showPrev ? ['', ''] : [])])
            if (frPrefs.expandAccountGroups) {
              list.forEach((a) => rows.push([acctLabel(a), formatGhs(bal(asAt, a.id)), ...prevCells(bal(asAt, a.id), bal(prev, a.id))]))
            }
          }
          return list.reduce((s, a) => s + bal(asAt, a.id), 0)
        }
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const ta = section('ASSETS', 'asset')
        if (showRow(ta)) rows.push([<b>Total Assets</b>, <b>{formatGhs(ta)}</b>, ...prevCells(ta, sumType(prev, ['asset']))])
        const tl = section('LIABILITIES', 'liability')
        if (showRow(tl)) rows.push([<b>Total Liabilities</b>, <b>{formatGhs(tl)}</b>, ...prevCells(tl, sumType(prev, ['liability']))])
        const te = section(terms.equitySection, 'equity')
        const surplus = sumType(asAt, ['income', 'expense'])
        if (showRow(surplus)) rows.push([terms.surplusLabel, formatGhs(surplus), ...prevCells(surplus, sumType(prev, ['income', 'expense']))])
        if (showRow(te + surplus)) rows.push([<b>{terms.equityTotal}</b>, <b>{formatGhs(te + surplus)}</b>, ...prevCells(te + surplus, sumType(prev, ['equity', 'income', 'expense']))])
        return {
          title: `1. ${terms.balanceSheet}`,
          node: <T head={['Account', 'Amount', ...(showPrev ? ['Previous', 'Variance'] : [])]} right={showPrev ? [1, 2, 3] : [1]} rows={rows} />,
        }
      }
      case 'bssum': {
        const asAt = buildMap((d) => !toD || d <= toD, method)
        const prev = buildMap((d) => !!fromD && d < fromD, method)
        const showPrev = frPrefs.enableComparativePeriods
        const prevCells = (cur: number, pv: number): ReactNode[] =>
          showPrev ? [formatGhs(pv), formatGhs(cur - pv)] : []
        const rows: ReactNode[][] = []
        const section = (title: string, type: string) => {
          const list = accounts.filter((a) => a.type === type && keepAcct(bal(asAt, a.id)))
          // Hide the whole group when every account in it was filtered out.
          if (frPrefs.includeZeroBalanceAccounts || list.length > 0) {
            rows.push([<b>{title}</b>, '', ...(showPrev ? ['', ''] : [])])
            if (frPrefs.expandAccountGroups) {
              list.forEach((a) => rows.push([acctLabel(a), formatGhs(bal(asAt, a.id)), ...prevCells(bal(asAt, a.id), bal(prev, a.id))]))
            }
          }
          return list.reduce((s, a) => s + bal(asAt, a.id), 0)
        }
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const ta = section('ASSETS', 'asset')
        if (showRow(ta)) rows.push([<b>Total Assets</b>, <b>{formatGhs(ta)}</b>, ...prevCells(ta, sumType(prev, ['asset']))])
        const tl = section('LIABILITIES', 'liability')
        if (showRow(tl)) rows.push([<b>Total Liabilities</b>, <b>{formatGhs(tl)}</b>, ...prevCells(tl, sumType(prev, ['liability']))])
        const te = section(terms.equitySection, 'equity')
        const surplus = sumType(asAt, ['income', 'expense'])
        if (showRow(surplus)) rows.push([terms.orgType === 'for-profit' ? "Other shareholder's equity" : 'Other net assets/funds', formatGhs(surplus), ...prevCells(surplus, sumType(prev, ['income', 'expense']))])
        if (showRow(te + surplus)) rows.push([<b>{terms.equityTotal}</b>, <b>{formatGhs(te + surplus)}</b>, ...prevCells(te + surplus, sumType(prev, ['equity', 'income', 'expense']))])
        return {
          title: `2. ${terms.balanceSheetSummary}`,
          node: <T head={['Account', 'Amount', ...(showPrev ? ['Previous', 'Variance'] : [])]} right={showPrev ? [1, 2, 3] : [1]} rows={rows} />,
        }
      }
      case 'csfp': {
        const asAt = buildMap((d) => !toD || d <= toD, method)
        const prior = buildMap((d) => !!fromD && d < fromD, method)
        const rows = accounts
          .filter((a) => keepAcct(bal(asAt, a.id), bal(prior, a.id)))
          .map((a) => {
            const cur = bal(asAt, a.id)
            const prevV = bal(prior, a.id)
            return [<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(cur), formatGhs(prevV), <span className={cur - prevV < 0 ? 'text-ember' : ''}>{formatGhs(cur - prevV)}</span>]
          })
        return { title: `3. ${terms.balanceSheetComparison}`, node: <T head={['Account', 'Current', 'Previous', 'Variance']} right={[1, 2, 3]} rows={rows} /> }
      }
      case 'ie':
      case 'ien': {
        const withNotes = report === 'ien' && frPrefs.showReportNotes
        const showPrev = frPrefs.enableComparativePeriods
        const prevMap = buildMap((d) => !!fromD && d < fromD)
        const prevCells = (cur: number, pv: number): ReactNode[] =>
          showPrev ? [formatGhs(Math.abs(pv)), formatGhs(Math.abs(cur) - Math.abs(pv))] : []
        const rows: ReactNode[][] = []
        const section = (title: string, type: string) => {
          const list = accounts.filter((a) => a.type === type && keepAcct(bal(period, a.id)))
          // Hide the whole group when every account in it was filtered out.
          if (frPrefs.includeZeroBalanceAccounts || list.length > 0) {
            rows.push([<b>{title}</b>, '', ...(showPrev ? ['', ''] : []), ...(withNotes ? [''] : [])])
            if (frPrefs.expandAccountGroups) {
              list.forEach((a) =>
                rows.push([
                  acctLabel(a),
                  formatGhs(Math.abs(bal(period, a.id))),
                  ...prevCells(bal(period, a.id), bal(prevMap, a.id)),
                  ...(withNotes ? [a.description || a.detailType || '—'] : []),
                ]))
            }
          }
          return list.reduce((s, a) => s + Math.abs(bal(period, a.id)), 0)
        }
        const prevSum = (type: string) => accounts.filter((a) => a.type === type).reduce((s, a) => s + Math.abs(bal(prevMap, a.id)), 0)
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const ti = section(terms.incomeSection, 'income')
        if (showRow(ti)) rows.push([<b>Total {terms.incomeSection.toLowerCase()}</b>, <b>{formatGhs(ti)}</b>, ...prevCells(ti, prevSum('income')), ...(withNotes ? [''] : [])])
        const te = section(terms.expenseSection, 'expense')
        if (showRow(te)) rows.push([<b>Total {terms.expenseSection.toLowerCase()}</b>, <b>{formatGhs(te)}</b>, ...prevCells(te, prevSum('expense')), ...(withNotes ? [''] : [])])
        if (showRow(ti - te)) rows.push([<b>{terms.surplusLabel}</b>, <b>{formatGhs(ti - te)}</b>, ...prevCells(ti - te, prevSum('income') - prevSum('expense')), ...(withNotes ? [''] : [])])
        return {
          title: withNotes ? `7. Comparative ${terms.ieShort} Account With Notes` : `4. ${terms.profitLoss}`,
          node: (
            <T
              head={['Account', 'Amount', ...(showPrev ? ['Previous', 'Variance'] : []), ...(withNotes ? ['Notes'] : [])]}
              right={showPrev ? [1, 2, 3] : [1]}
              rows={rows}
            />
          ),
        }
      }
      case 'iecomp': {
        const cur = buildMap((d) => (!fromD || d >= fromD) && (!toD || d <= toD), method)
        const year = Number((toD || new Date().toISOString().slice(0, 10)).slice(0, 4))
        const prev = buildMap((d) => d >= `${year - 1}-01-01` && d <= `${year - 1}-12-31`, method)
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (cur.has(a.id) || prev.has(a.id)) && keepAcct(bal(cur, a.id), bal(prev, a.id)))
          .map((a) => [<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(bal(cur, a.id)), formatGhs(bal(prev, a.id))])
        return { title: `5. ${terms.profitLossComparison}`, node: <T head={['Account', 'Current', 'Previous']} right={[1, 2]} rows={rows} /> }
      }
      case 'ieb': {
        const year = Number((toD || new Date().toISOString().slice(0, 10)).slice(0, 4))
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (period.has(a.id) || budgetFor(a.id, year) > 0) && keepAcct(bal(period, a.id), budgetFor(a.id, year)))
          .map((a) => {
            const actual = bal(period, a.id)
            const budget = a.type === 'expense' ? -budgetFor(a.id, year) : budgetFor(a.id, year)
            return [<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(actual), formatGhs(budget), formatGhs(actual - budget)]
          })
        return { title: `6. Comparative ${terms.ieShort} Acct. With Budgets`, node: <T head={['Account', 'Actual', 'Budget', 'Variance']} right={[1, 2, 3]} rows={rows} /> }
      }
      case 'cfs': {
        const inR = (d: string) => (!fromD || d >= fromD) && (!toD || d <= toD)
        const cashIn = live.receipts.filter((r) => r.method === 'cash' && inR(r.date)).reduce((s, r) => s + r.amount, 0)
        const cashOut = live.payments.filter((p) => p.method === 'cash' && inR(p.date)).reduce((s, p) => s + p.amount, 0)
        const bankIn = live.receipts.filter((r) => r.method !== 'cash' && inR(r.date)).reduce((s, r) => s + r.amount, 0)
        const bankOut = live.payments.filter((p) => p.method !== 'cash' && inR(p.date)).reduce((s, p) => s + p.amount, 0)
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const cashNet = cashIn - cashOut
        const bankNet = bankIn - bankOut
        const rows: ReactNode[][] = []
        if (frPrefs.includeZeroBalanceAccounts || cashIn !== 0 || cashOut !== 0) {
          rows.push([<b>CASH FLOWS</b>, ''])
          if (showRow(cashIn)) rows.push(['Cash receipts', formatGhs(cashIn)])
          if (showRow(cashOut)) rows.push(['Cash payments', formatGhs(-cashOut)])
          if (showRow(cashNet)) rows.push([<b>Net cash flow</b>, <b>{formatGhs(cashNet)}</b>])
        }
        if (frPrefs.includeZeroBalanceAccounts || bankIn !== 0 || bankOut !== 0) {
          rows.push([<b>BANK FLOWS</b>, ''])
          if (showRow(bankIn)) rows.push(['Bank receipts', formatGhs(bankIn)])
          if (showRow(bankOut)) rows.push(['Bank payments', formatGhs(-bankOut)])
          if (showRow(bankNet)) rows.push([<b>Net bank flow</b>, <b>{formatGhs(bankNet)}</b>])
        }
        if (showRow(cashNet + bankNet)) rows.push([<b>Net increase/(decrease) in cash & bank</b>, <b>{formatGhs(cashNet + bankNet)}</b>])
        return { title: '8. Cash Flow Statement', node: <T head={['Item', 'Amount']} right={[1]} rows={rows} /> }
      }
      case 'la': {
        const ca = sumType(asAt, ['asset'])
        const cl = sumType(asAt, ['liability'])
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const rows: ReactNode[][] = []
        if (showRow(ca)) rows.push(['Current assets (total assets)', formatGhs(ca)])
        if (showRow(cl)) rows.push(['Current liabilities (total liabilities)', formatGhs(cl)])
        if (showRow(ca - cl)) rows.push([<b>Working capital</b>, <b>{formatGhs(ca - cl)}</b>])
        if (frPrefs.includeZeroBalanceAccounts || cl > 0) rows.push([<b>Current ratio</b>, <b>{`${(ca / cl).toFixed(2)} : 1`}</b>])
        return { title: '10. Liquidity Analysis', node: <T head={['Measure', 'Value']} right={[1]} rows={rows} /> }
      }
      case 'notes': {
        const rows = accounts
          .filter((a) => (a.description || a.noteNo || a.detailType || a.bank) && keepAcct(bal(asAt, a.id)))
          .map((a) => [
            <span className="font-semibold">{acctLabel(a)}</span>,
            [a.detailType, a.description, a.bank ? `${a.bank}${a.accountNumber ? ` ${a.accountNumber}` : ''}` : '', a.noteNo ? `Ref ${a.noteNo}` : ''].filter(Boolean).join(' — '),
          ])
        return {
          title: '11. Notes to the Financial Statement',
          node: rows.length ? <T head={['Account', 'Note']} rows={rows} /> : <Empty title="No notes available" desc="Account descriptions and references appear here." />,
        }
      }
      case 'bud': {
        const year = Number((toD || new Date().toISOString().slice(0, 10)).slice(0, 4))
        const rows = budgets
          .filter((b) => b.year === year)
          .map((b) => {
            const budget = budgetTotal(b)
            const actual = bal(period, b.accountId)
            return [accountName(accounts, b.accountId), formatGhs(budget), formatGhs(Math.abs(actual)), formatGhs(budget - Math.abs(actual))]
          })
        return {
          title: '12. Income and Expenditure Budget',
          node: rows.length ? <T head={['Account', 'Budget', 'Actual', 'Remaining']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budgets for this year" desc="Create budgets under Accounting → Budget to see them here." />,
        }
      }
      case 'tb': {
        const rows = accounts
          .filter((a) => {
            const e = period.get(a.id)
            return keepAcct((e?.debit ?? 0) - (e?.credit ?? 0))
          })
          .map((a) => {
            const e = period.get(a.id)
            const net = (e?.debit ?? 0) - (e?.credit ?? 0)
            return [frPrefs.showAccountCodes ? a.code : '', <span className="font-semibold">{a.name}</span>, net > 0 ? formatGhs(net) : '—', net < 0 ? formatGhs(-net) : '—']
          })
        let td = 0
        let tc = 0
        for (const a of accounts) {
          const e = period.get(a.id)
          if (!e) continue
          const net = e.debit - e.credit
          if (net > 0) td += net
          else tc += -net
        }
        rows.push([<b>Total</b>, '', <b>{formatGhs(td)}</b>, <b>{formatGhs(tc)}</b>])
        return {
          title: '9. Trial Balance',
          node: rows.length > 1
            ? <T head={['Code', 'Account', 'Debit', 'Credit']} right={[2, 3]} rows={rows} />
            : <Empty title="No balances yet" desc="The trial balance lists debit and credit totals per account." />,
        }
      }
      case 'pl12m': {
        const stats: { label: string; inc: number; exp: number }[] = []
        const now = new Date()
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          const map = buildMap((dt) => dt >= `${mKey}-01` && dt <= `${mKey}-${String(lastDay).padStart(2, '0')}`, method)
          let inc = 0
          let exp = 0
          for (const a of accounts) {
            if (a.type === 'income') inc += bal(map, a.id)
            else if (a.type === 'expense') exp += bal(map, a.id)
          }
          stats.push({ label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), inc, exp })
        }
        const rows: ReactNode[][] = stats.map((mo) => {
          const net = mo.inc - mo.exp
          return [
            <span className="font-semibold">{mo.label}</span>,
            formatGhs(mo.inc),
            formatGhs(mo.exp),
            <span className={`font-semibold ${net < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatGhs(net)}</span>,
          ]
        })
        const tInc = stats.reduce((x, m) => x + m.inc, 0)
        const tExp = stats.reduce((x, m) => x + m.exp, 0)
        rows.push([<b>Total</b>, <b>{formatGhs(tInc)}</b>, <b>{formatGhs(tExp)}</b>, <b>{formatGhs(tInc - tExp)}</b>])
        return { title: 'Monthly Profit and Loss', node: <T head={['Month', 'Income', 'Expenses', 'Net Income']} right={[1, 2, 3]} rows={rows} /> }
      }
      case 'plpct': {
        const totalInc = sumType(period, ['income'])
        const totalExp = sumType(period, ['expense'])
        const incAccounts = accounts.filter((a) => a.type === 'income' && keepAcct(bal(period, a.id)))
        const expAccounts = accounts.filter((a) => a.type === 'expense' && keepAcct(bal(period, a.id)))
        if (!incAccounts.length && !expAccounts.length) {
          return { title: 'Profit and Loss as % of total income', node: <Empty title="No income or expense activity" desc="Post receipts, payments or journals to see this report." /> }
        }
        const pct = (v: number) => (totalInc !== 0 ? `${((v / totalInc) * 100).toFixed(1)}%` : '—')
        const rows: ReactNode[][] = [[<b>INCOME</b>, '', '']]
        incAccounts.forEach((a) => rows.push([<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(bal(period, a.id)), pct(bal(period, a.id))]))
        rows.push([<b>Total Income</b>, <b>{formatGhs(totalInc)}</b>, <b>{pct(totalInc)}</b>])
        rows.push([<b>EXPENSES</b>, '', ''])
        expAccounts.forEach((a) => rows.push([<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(bal(period, a.id)), pct(bal(period, a.id))]))
        rows.push([<b>Total Expenses</b>, <b>{formatGhs(totalExp)}</b>, <b>{pct(totalExp)}</b>])
        const net = totalInc - totalExp
        rows.push([<b>Net Income (Profit or Loss)</b>, <b>{formatGhs(net)}</b>, <b>{pct(net)}</b>])
        return { title: 'Profit and Loss as % of total income', node: <T head={['Account', 'Amount', '% of Total Income']} right={[1, 2]} rows={rows} /> }
      }
      case 'reconSummary': {
        const byBank = new Map<string, typeof reconciliations>()
        for (const rc of reconciliations) {
          const l = byBank.get(rc.bankAccountId) ?? []
          l.push(rc)
          byBank.set(rc.bankAccountId, l)
        }
        const rows = [...byBank.entries()].map(([bankId, list]) => {
          const last = [...list].sort((a, b) => a.statementDate.localeCompare(b.statementDate))[list.length - 1]
          const rec = list.filter((r) => r.status === 'reconciled').length
          return [
            <span className="font-semibold">{banks.find((b) => b.id === bankId)?.name ?? '—'}</span>,
            String(list.length),
            String(rec),
            String(list.length - rec),
            formatGhs(list.reduce((x, r) => x + (r.clearedDeposits ?? 0), 0)),
            formatGhs(list.reduce((x, r) => x + (r.clearedWithdrawals ?? 0), 0)),
            dFmt(last.statementDate),
            <span className={Math.abs(last.difference) >= 0.5 ? 'font-semibold text-rose-600' : ''}>{formatGhs(last.difference)}</span>,
          ]
        })
        return {
          title: 'Reconciliation Summary',
          node: rows.length ? (
            <T head={['Bank account', 'Reconciliations', 'Reconciled', 'Open', 'Cleared deposits', 'Cleared withdrawals', 'Last statement', 'Difference']} right={[1, 2, 3, 4, 5, 7]} rows={rows} />
          ) : (
            <Empty title="No reconciliations" desc="Run a bank reconciliation to see the summary." />
          ),
        }
      }
      case 'reconDetail': {
        const rows = [...reconciliations]
          .sort((a, b) => a.statementDate.localeCompare(b.statementDate))
          .map((rc) => [
            dFmt(rc.statementDate),
            banks.find((b) => b.id === rc.bankAccountId)?.name ?? '—',
            rc.periodStart ? `${dFmt(rc.periodStart)} – ${dFmt(rc.statementDate)}` : dFmt(rc.statementDate),
            formatGhs(rc.startingBalance ?? 0),
            formatGhs(rc.clearedDeposits ?? 0),
            formatGhs(rc.clearedWithdrawals ?? 0),
            formatGhs(rc.bookBalance),
            formatGhs(rc.statementBalance),
            <span className={Math.abs(rc.difference) >= 0.5 ? 'font-semibold text-rose-600' : ''}>{formatGhs(rc.difference)}</span>,
            rc.status === 'reconciled' ? <Badge tone="lime">Reconciled</Badge> : <Badge tone="amber">Open</Badge>,
          ])
        return {
          title: 'Reconciliation Detail',
          node: rows.length ? (
            <T head={['Statement date', 'Bank account', 'Period', 'Starting balance', 'Cleared deposits', 'Cleared withdrawals', 'Book balance', 'Statement balance', 'Difference', 'Status']} right={[3, 4, 5, 6, 7, 8]} rows={rows} />
          ) : (
            <Empty title="No reconciliations" desc="Run a bank reconciliation to see the detail." />
          ),
        }
      }
      case 'budgetOverview': {
        const yr = new Date().getFullYear()
        const rows = budgets
          .filter((b) => b.year === yr)
          .map((b) => {
            const a = accounts.find((x) => x.id === b.accountId)
            return [a ? <span className="font-semibold">{acctLabel(a)}</span> : b.accountId, String(b.year), formatGhs(budgetFor(b.accountId, yr))]
          })
        return {
          title: 'Budget overview',
          node: rows.length ? <T head={['Account', 'Year', 'Budgeted balance']} right={[2]} rows={rows} /> : <Empty title="No budgets" desc="Create budgets under Accounting → Budget to see them here." />,
        }
      }
      case 'plBudgetVsActual': {
        const yr = new Date().getFullYear()
        const ytd = buildMap((d) => d >= `${yr}-01-01`, method)
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (ytd.has(a.id) || budgetFor(a.id, yr) > 0))
          .map((a) => {
            const actual = bal(ytd, a.id)
            const budget = a.type === 'expense' ? -budgetFor(a.id, yr) : budgetFor(a.id, yr)
            return [<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(budget), formatGhs(actual), formatGhs(actual - budget)]
          })
        return {
          title: 'Profit and Loss Budget vs Actual',
          node: rows.length ? <T head={['Account', 'Budget', 'Actual', 'Variance']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budget data" desc="Create budgets to compare against actuals." />,
        }
      }
      case 'plBudgetPerf': {
        const now = new Date()
        const yr = now.getFullYear()
        const mKey = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const month = buildMap((d) => d >= `${mKey}-01`, method)
        const ytd = buildMap((d) => d >= `${yr}-01-01`, method)
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (month.has(a.id) || ytd.has(a.id) || budgetFor(a.id, yr) > 0))
          .map((a) => [<span className="font-semibold">{acctLabel(a)}</span>, formatGhs(bal(month, a.id)), formatGhs(bal(ytd, a.id)), formatGhs(budgetFor(a.id, yr))])
        return {
          title: 'Profit and loss budget performance',
          node: rows.length ? <T head={['Account', 'This month', 'Year to date', 'Annual budget']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budget data" desc="Create budgets to compare against actuals." />,
        }
      }
      default:
        return { title: '', node: null }
    }
  }

  const current = report ? render() : null
  const active = items.find((r) => r.id === report)

  const body = current && (
    <>
      <ReportPrintSheet
        title={`${active?.num}. ${active?.label}`}
        subtitle={fromD || toD ? `Period: ${fromD || 'start'} – ${toD || 'today'}` : undefined}
      >
        {current.node}
      </ReportPrintSheet>
      <h2 className="mb-4 flex items-center gap-2.5 border-b border-line pb-3 text-2xl font-semibold text-[#2e75b6] dark:text-sky-300">
        <BookMarked className="size-6 shrink-0" />
        {active?.num}. {active?.label}
      </h2>
      <div className="mb-4 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-sm font-bold">From:</span>
          <DatePicker value={fromD} onChange={setFromD} placeholder="start date" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-bold">To:</span>
          <DatePicker value={toD} onChange={setToD} placeholder="end date" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-bold">Accounting method:</span>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </Select>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-bold text-white transition hover:brightness-110"
        >
          Print
        </button>
        {exportRows.length > 0 && <ExportButtons filename={`financial-${report}`} rows={exportRows} compact />}
      </div>
      <div ref={bodyRef}>{current.node}</div>
      {frPrefs.showReportNotes && (
        <div className="mt-4 rounded-lg border border-line bg-zinc-50 p-4 text-xs leading-relaxed text-mist dark:bg-white/[0.025]">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Report notes</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>These financial statements were prepared on the {app.accountingSettings?.accountingMethod === 'cash' ? 'cash' : 'accrual'} basis of accounting.</li>
            <li>{fromD || toD ? `Figures reflect the selected period${fromD ? ` from ${fromD}` : ''}${toD ? ` to ${toD}` : ''}.` : 'Figures reflect all recorded activity to date.'}</li>
            {frPrefs.enableComparativePeriods && <li>Comparative amounts show activity recorded before the selected period start.</li>}
            <li>All amounts are stated in {app.accountingSettings?.defaultCurrency || 'GHS'}.</li>
            <li>See “Notes to the Financial Statement” for account-level disclosures and references.</li>
          </ol>
        </div>
      )}
    </>
  )

  /** Composed inside Accounts Reports — right-pane content only. */
  if (bodyOnly) return <div>{body}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Financial Reports</h1>
        <p className="mt-1 text-sm text-mist">
          {`Accounting reports — pick one on the left, set the period and print. ${FIN_REPORTS.length} reports in total.`}
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
              const isActive = report === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReport(r.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    'flex h-[58px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 px-4 text-left transition ' +
                    (isActive ? 'bg-[#2e75b6] text-white' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]')
                  }
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <BookMarked className={`size-4 shrink-0 ${isActive ? 'text-white' : 'text-mist'}`} />
                    {r.label}
                  </span>
                  <span className={`pl-[26px] text-[10px] leading-tight ${isActive ? 'text-white/80' : 'text-mist'}`}>{r.desc}</span>
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
