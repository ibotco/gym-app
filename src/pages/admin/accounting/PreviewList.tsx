import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Printer } from 'lucide-react'
import { PageHeader, Select, Field, Empty, DatePicker, Badge } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { finTerms } from '../../../lib/orgTerms'
import { keepAccountRowAt, pruneZeroRows, resolveFinPrefs } from '../../../lib/financialReporting'
import { formatGhs, formatGhsExact } from '../../../lib/utils'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { tableToRows } from '../../../lib/tableExport'
import type { ExportRow } from '../../../lib/export'
import { accountName } from '../../../lib/accounting'

type Entry = { id: string; label: string; desc: string }

const STATEMENTS_LEFT: Entry[] = [
  { id: 'checkBalance', label: 'Check Balance', desc: 'For checking balance of accounts.' },
  { id: 'receivables', label: 'Other Receivables Balance(s)', desc: 'Outstanding balances owed to the organisation.' },
  { id: 'analysis', label: 'Receipt/Payment Analysis Book', desc: 'Analyses receipts and payments per account.' },
  { id: 'cashBook', label: 'Cash Book', desc: 'Cash receipts and payments with running balance.' },
  { id: 'bankBook', label: 'Bank Book', desc: 'Bank deposits and withdrawals with running balance.' },
  { id: 'reconciliation', label: 'Bank Reconciliation', desc: 'Compares bank statements with book balances.' },
]

const STATEMENTS_RIGHT: Entry[] = [
  { id: 'contribution', label: 'Contribution Per Head', desc: 'Totals contributions received per contributor.' },
  { id: 'listAccounts', label: 'List of Accounts', desc: 'The full chart of accounts.' },
  { id: 'ledger', label: 'Ledger', desc: 'Detailed entries and balance for one account.' },
  { id: 'subLedger', label: 'Sub-Ledger', desc: 'Account entries broken down by party.' },
  { id: 'generalLedger', label: 'General Ledger', desc: 'Debit, credit and balance totals per account.' },
  { id: 'generalJournal', label: 'General Journal', desc: 'Chronological journal entries with their lines.' },
]

const FINANCIAL_LEFT: Entry[] = [
  { id: 'sfp', label: 'Statement of Financial Position', desc: 'Assets, liabilities and equity at a date.' },
  { id: 'bssum', label: 'Balance Sheet Summary', desc: 'A summary of what you own (assets), what you owe (liabilities), and what you invested (equity).' },
  { id: 'csfp', label: 'Comparative Statement of Financial Position', desc: 'Compares the position across two periods.' },
  { id: 'ie', label: 'Income and Expenditure Account', desc: 'Income against expenditure for the period.' },
  { id: 'iecomp', label: 'Profit and Loss Comparison', desc: 'Your income, expenses, and net income (profit or loss) compared to last year.' },
  { id: 'ieb', label: 'Comparative Income and Expenditure Acct. With Budgets', desc: 'Actual income and expenditure against budgets.' },
  { id: 'ien', label: 'Comparative Income and Expenditure Account With Notes', desc: 'Income and expenditure with explanatory notes.' },
]

const FINANCIAL_RIGHT: Entry[] = [
  { id: 'cfs', label: 'Cash Flow Statement', desc: 'Cash and bank inflows and outflows.' },
  { id: 'tb', label: 'Trial Balance', desc: 'Debit and credit totals proving the books balance.' },
  { id: 'pl12m', label: 'Monthly Profit and Loss', desc: 'Your income, expenses, and net income (profit or loss). Statistics by month.' },
  { id: 'plpct', label: 'Profit and Loss as % of total income', desc: 'Your expenses as a percentage of your total income.' },
  { id: 'reconSummary', label: 'Reconciliation Summary', desc: 'Reconciliation Summary Report' },
  { id: 'reconDetail', label: 'Reconciliation Detail', desc: 'Reconciliation Detail Report' },
  { id: 'la', label: 'Liquidity Analysis', desc: 'Ability to meet short-term obligations.' },
  { id: 'fnotes', label: 'Notes to the Financial Statement', desc: 'Supporting notes and disclosures.' },
  { id: 'fbud', label: 'Income and Expenditure Budget', desc: 'Budgeted income and expenditure.' },
]

const BUDGET: Entry[] = [
  { id: 'budgetOverview', label: 'Budget overview', desc: 'This report summarises your budgeted account balances.' },
  { id: 'plBudgetVsActual', label: 'Profit and Loss Budget vs Actual', desc: 'This report shows how well you are meeting your budget. For each type of account, the report compares your budgeted amounts to your actual amounts.' },
  { id: 'plBudgetPerf', label: 'Profit and loss budget performance', desc: 'This report compares actual amounts to budgeted amounts for the month, the fiscal year to date, and the annual budget.' },
]

/** Same display format as the sale date (MM/DD/YYYY). */
const dFmt = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
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

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex w-full cursor-pointer items-center justify-between border-b border-line bg-[#c2cbd8] px-5 py-3 text-left text-base font-bold text-zinc-800 transition hover:bg-[#b6c1d2] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      >
        {title}
        <ChevronDown className={`size-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={`${id}-body`}
        className="grid bg-[#f4f6fa] transition-[grid-template-rows] duration-300 dark:bg-transparent"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

function LinkRow({ e, onPick }: { e: Entry; onPick: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(e.id)} className="group block cursor-pointer text-left">
      <span className="text-[15px] font-semibold text-[#1a56b0] group-hover:underline dark:text-sky-300">{e.label}</span>
      <span className="block text-xs text-zinc-600 dark:text-mist">{e.desc}</span>
    </button>
  )
}

const TB_PRINT_CSS = `
  #tb-print-sheet { display: none; }
  @media print {
    #root { display: none !important; }
    #tb-print-sheet { display: block; }
  }
  #tb-print-sheet { background: #fff; color: #16181d; padding: 40px 48px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
  #tb-print-sheet .tb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 40px; }
  #tb-print-sheet .tb-co { font-size: 26px; font-weight: 800; }
  #tb-print-sheet .tb-line { margin-top: 8px; font-size: 12px; color: #333; }
  #tb-print-sheet .tb-title { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; text-align: right; }
  #tb-print-sheet .tb-period { margin-top: 8px; font-size: 12px; color: #444; text-align: right; }
  #tb-print-sheet table { width: 100%; border-collapse: collapse; font-size: 12px; }
  #tb-print-sheet th { text-align: left; font-weight: 700; padding: 8px 6px; border-bottom: 2px solid #16181d; }
  #tb-print-sheet th.tb-num { text-align: right; }
  #tb-print-sheet td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
  #tb-print-sheet td.tb-num { text-align: right; }
  #tb-print-sheet tbody tr:nth-child(even) td { background: #f6f7f9; }
  #tb-print-sheet tr.tb-total td { border-top: 2px solid #16181d; border-bottom: none; font-weight: 800; background: #fff; }
  #tb-print-sheet .tb-foot { margin-top: 32px; border-top: 1px solid #d1d5db; padding-top: 14px; text-align: center; color: #6b7280; font-size: 12px; }
`

type SheetRow = { id: string; label: string; depth: number; kind: 'parent' | 'leaf' | 'total'; amount?: number }

/** Builds the Perfex-style balance-sheet treegrid nodes; amounts come from the supplied balance function. */
function buildSheetNodes(
  accounts: { id: string; name: string; parentId?: string; type: string }[],
  balFn: (id: string) => number,
  itemId: string,
  summary = false,
): SheetRow[] {
  const childrenOf = (id: string) => accounts.filter((x) => x.parentId === id)
  const subtree = (id: string): number => balFn(id) + childrenOf(id).reduce((s, c) => s + subtree(c.id), 0)
  const nodes: SheetRow[] = []
  const addAccount = (acc: { id: string; name: string }, depth: number) => {
    const kids = childrenOf(acc.id)
    if (kids.length) {
      nodes.push({ id: `acc-${acc.id}`, label: acc.name, depth, kind: 'parent' })
      kids.forEach((k) => addAccount(k, depth + 1))
      nodes.push({ id: `tot-${acc.id}`, label: `Total ${acc.name}`, depth, kind: 'total', amount: subtree(acc.id) })
    } else {
      nodes.push({ id: `acc-${acc.id}`, label: acc.name, depth, kind: 'leaf', amount: subtree(acc.id) })
    }
  }
  const netIncome = accounts.filter((x) => x.type === 'income' || x.type === 'expense').reduce((s, x) => s + balFn(x.id), 0)
  if (itemId) {
    const acc = accounts.find((x) => x.id === itemId)
    if (acc) {
      addAccount(acc, 0)
      if (!childrenOf(acc.id).length) nodes.push({ id: `tot-${acc.id}-x`, label: `Total ${acc.name}`, depth: 0, kind: 'total', amount: subtree(acc.id) })
    }
  } else {
    // Standard statement groups, Perfex-style — real accounts classified in.
    const leafOf = (type: string) => accounts.filter((x) => x.type === type && childrenOf(x.id).length === 0)
    const isReceivable = (n: string) => /receiv/i.test(n)
    const isLongTermAsset = (n: string) => /depreci|property|plant|equipment|long[- ]?term|goodwill|intangib|deferred|held for sale|investment/i.test(n)
    const isPayable = (n: string) => /accounts payable|\(a\/p\)/i.test(n)
    const isNonCurrentLiab = (n: string) => /long[- ]?term|non[- ]?current|holiday|held for sale/i.test(n)
    const sumOf = (list: { id: string }[]) => list.reduce((s, a) => s + balFn(a.id), 0)
    const leafRow = (a: { id: string; name: string }, depth: number): SheetRow => ({ id: `acc-${a.id}`, label: a.name, depth, kind: 'leaf', amount: balFn(a.id) })

    const arLeaves = leafOf('asset').filter((a) => isReceivable(a.name))
    const ltLeaves = leafOf('asset').filter((a) => !isReceivable(a.name) && isLongTermAsset(a.name))
    const caLeaves = leafOf('asset').filter((a) => !isReceivable(a.name) && !isLongTermAsset(a.name))
    const apLeaves = leafOf('liability').filter((a) => isPayable(a.name))
    const ncLeaves = leafOf('liability').filter((a) => !isPayable(a.name) && isNonCurrentLiab(a.name))
    const clLeaves = leafOf('liability').filter((a) => !isPayable(a.name) && !isNonCurrentLiab(a.name))
    const eqLeaves = leafOf('equity')

    nodes.push({ id: 'sec-assets', label: 'Assets', depth: 0, kind: 'parent' })
    nodes.push({ id: 'grp-ca', label: 'Current assets', depth: 1, kind: 'parent' })
    if (summary) {
      arLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    } else if (arLeaves.length) {
      nodes.push({ id: 'grp-ar', label: 'Accounts Receivable (A/R)', depth: 2, kind: 'parent' })
      arLeaves.forEach((a) => nodes.push(leafRow(a, 3)))
      nodes.push({ id: 'tot-ar', label: 'Total Accounts receivable', depth: 2, kind: 'total', amount: sumOf(arLeaves) })
    }
    caLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    nodes.push({ id: 'tot-ca', label: 'Total Current Assets', depth: 1, kind: 'total', amount: sumOf(arLeaves) + sumOf(caLeaves) })
    nodes.push({ id: 'grp-lt', label: 'Long-term assets', depth: 1, kind: 'parent' })
    ltLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    nodes.push({ id: 'tot-lt', label: 'Total long-term assets', depth: 1, kind: 'total', amount: sumOf(ltLeaves) })
    const ta = sumOf(arLeaves) + sumOf(caLeaves) + sumOf(ltLeaves)
    nodes.push({ id: 'tot-assets', label: 'Total Assets', depth: 0, kind: 'total', amount: ta })

    nodes.push({ id: 'sec-liab', label: "Liabilities and shareholder's equity", depth: 0, kind: 'parent' })
    nodes.push({ id: 'grp-cl', label: 'Current liabilities', depth: 1, kind: 'parent' })
    if (summary) {
      apLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    } else if (apLeaves.length) {
      nodes.push({ id: 'grp-ap', label: 'Accounts Payable', depth: 2, kind: 'parent' })
      apLeaves.forEach((a) => nodes.push(leafRow(a, 3)))
      nodes.push({ id: 'tot-ap', label: 'Total Accounts payable', depth: 2, kind: 'total', amount: sumOf(apLeaves) })
    }
    clLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    nodes.push({ id: 'tot-cl', label: 'Total current liabilities', depth: 1, kind: 'total', amount: sumOf(apLeaves) + sumOf(clLeaves) })
    nodes.push({ id: 'grp-nc', label: 'Non-current liabilities', depth: 1, kind: 'parent' })
    ncLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    nodes.push({ id: 'tot-nc', label: 'Total non-current liabilities', depth: 1, kind: 'total', amount: sumOf(ncLeaves) })
    nodes.push({ id: 'sec-eq', label: "Shareholders' equity", depth: 1, kind: 'parent' })
    if (!summary) nodes.push({ id: 'net-income', label: 'Net Income', depth: 2, kind: 'leaf', amount: netIncome })
    eqLeaves.forEach((a) => nodes.push(leafRow(a, 2)))
    if (summary) nodes.push({ id: 'other-eq', label: "Other shareholder's equity", depth: 2, kind: 'leaf', amount: netIncome })
    const te = sumOf(eqLeaves) + netIncome
    nodes.push({ id: 'tot-eq', label: "Total shareholders' equity", depth: 1, kind: 'total', amount: te })
    const tl = sumOf(apLeaves) + sumOf(clLeaves) + sumOf(ncLeaves)
    nodes.push({ id: 'tot-le', label: 'Total liabilities and equity', depth: 0, kind: 'total', amount: tl + te })
  }
  return nodes
}

/** Builds the Perfex-style profit-and-loss treegrid nodes; amounts come from the supplied balance function. */
function buildPLNodes(
  accounts: { id: string; name: string; parentId?: string; type: string }[],
  balFn: (id: string) => number,
): SheetRow[] {
  const leafOf = (type: string) => accounts.filter((x) => x.type === type && !accounts.some((p) => p.parentId === x.id))
  const isCos = (n: string) => /(–|-)\s*cos$/i.test(n.trim()) || /cost of sales/i.test(n)
  const isOtherIncome = (n: string) => /dividend income|interest income|disposal|other operating|unrealised/i.test(n)
  const isOtherExpense = (n: string) => /reconciliation discrepanc/i.test(n)
  const incLeaves = leafOf('income').filter((a) => !isOtherIncome(a.name))
  const oincLeaves = leafOf('income').filter((a) => isOtherIncome(a.name))
  const cosLeaves = leafOf('expense').filter((a) => isCos(a.name))
  const oexpLeaves = leafOf('expense').filter((a) => !isCos(a.name) && isOtherExpense(a.name))
  const expLeaves = leafOf('expense').filter((a) => !isCos(a.name) && !isOtherExpense(a.name))
  const sumB = (list: { id: string }[]) => list.reduce((s, a) => s + balFn(a.id), 0)
  const incRow = (a: { id: string; name: string }): SheetRow => ({ id: `acc-${a.id}`, label: a.name, depth: 1, kind: 'leaf', amount: balFn(a.id) })
  const expRow = (a: { id: string; name: string }): SheetRow => ({ id: `acc-${a.id}`, label: a.name, depth: 1, kind: 'leaf', amount: -balFn(a.id) })

  const nodes: SheetRow[] = []
  nodes.push({ id: 'sec-inc', label: 'Income', depth: 0, kind: 'parent' })
  incLeaves.forEach((a) => nodes.push(incRow(a)))
  nodes.push({ id: 'tot-inc', label: 'Total income', depth: 0, kind: 'total', amount: sumB(incLeaves) })
  nodes.push({ id: 'sec-cos', label: 'Cost of sales', depth: 0, kind: 'parent' })
  cosLeaves.forEach((a) => nodes.push(expRow(a)))
  nodes.push({ id: 'tot-cos', label: 'Total Cost Of Sales', depth: 0, kind: 'total', amount: -sumB(cosLeaves) })
  nodes.push({ id: 'sec-ni', label: 'Net Income', depth: 0, kind: 'parent' })
  nodes.push({ id: 'tot-ni', label: 'Total net income', depth: 0, kind: 'total', amount: 0 })
  nodes.push({ id: 'sec-oin', label: 'Other income', depth: 0, kind: 'parent' })
  oincLeaves.forEach((a) => nodes.push(incRow(a)))
  nodes.push({ id: 'tot-oin', label: 'Total Other Income/(Loss)', depth: 0, kind: 'total', amount: sumB(oincLeaves) })
  nodes.push({ id: 'sec-exp', label: 'Expenses', depth: 0, kind: 'parent' })
  expLeaves.forEach((a) => nodes.push(expRow(a)))
  nodes.push({ id: 'tot-exp', label: 'Total expenses', depth: 0, kind: 'total', amount: -sumB(expLeaves) })
  nodes.push({ id: 'sec-oexp', label: 'Other Expenses', depth: 0, kind: 'parent' })
  oexpLeaves.forEach((a) => nodes.push(expRow(a)))
  nodes.push({ id: 'tot-oexp', label: 'Total Other Expense', depth: 0, kind: 'total', amount: -sumB(oexpLeaves) })
  nodes.push({ id: 'net-earnings', label: 'NET EARNINGS', depth: 0, kind: 'total', amount: sumB(leafOf('income')) + sumB(leafOf('expense')) })
  return nodes
}

/** Renders treegrid rows (expanders, 24px/level indents, bold ruled totals); amount cells supplied per report. */
function treeBody<N extends SheetRow>(
  nodes: N[],
  collapsed: Record<string, boolean>,
  toggle: (id: string) => void,
  amountCells: (n: N) => ReactNode,
  emptyCells: ReactNode,
): ReactNode[] {
  const stack: { depth: number; off: boolean }[] = []
  const body: ReactNode[] = []
  for (const n of nodes) {
    while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop()
    const off = stack.some((s) => s.off)
    stack.push({ depth: n.depth, off: off || (n.kind === 'parent' && !!collapsed[n.id]) })
    if (off) continue
    const pad = { marginLeft: 24 + n.depth * 24 }
    if (n.kind === 'parent') {
      body.push(
        <tr key={n.id}>
          <td className="py-1.5">
            <div style={pad} className="flex items-center">
              <button
                type="button"
                aria-label={collapsed[n.id] ? `Expand ${n.label}` : `Collapse ${n.label}`}
                onClick={() => toggle(n.id)}
                className="mr-1.5 w-3 shrink-0 cursor-pointer text-xs leading-none text-zinc-600"
              >
                {collapsed[n.id] ? '▶' : '▼'}
              </button>
              <span>{n.label}</span>
            </div>
          </td>
          {emptyCells}
        </tr>,
      )
    } else {
      const total = n.kind === 'total'
      body.push(
        <tr key={n.id} className={total ? 'border-t border-zinc-700' : undefined}>
          <td className="py-1.5">
            <div style={pad} className="flex items-center">
              <span className="mr-1.5 inline-block w-3" />
              <span className={total ? 'font-bold' : 'font-semibold'}>{n.label}</span>
            </div>
          </td>
          {amountCells(n)}
        </tr>,
      )
    }
  }
  return body
}

type Act = Map<string, { debit: number; credit: number }>

export function PreviewListPage() {
  const app = useApp()
  const { accounts, receipts, paymentVouchers, journals, banks, reconciliations, budgets } = app
  const { user } = useAuth()
  /** Reporting terminology follows the active company's organization type. */
  const terms = finTerms(app.companies.find((c) => c.id === userCompanyId(user, app.branches))?.orgType)
  /** Financial Reporting Preferences, read live so the zero-balance toggle applies without reload. */
  const frPrefs = resolveFinPrefs(app.accountingSettings)

  const rename = (e: Entry): Entry => {
    switch (e.id) {
      case 'sfp': return { ...e, label: terms.balanceSheet }
      case 'bssum': return { ...e, label: terms.balanceSheetSummary }
      case 'csfp': return { ...e, label: terms.balanceSheetComparison }
      case 'ie': return { ...e, label: terms.profitLoss }
      case 'iecomp': return { ...e, label: terms.profitLossComparison }
      case 'ieb': return { ...e, label: `Comparative ${terms.ieShort} Acct. With Budgets` }
      case 'ien': return { ...e, label: `Comparative ${terms.ieShort} Account With Notes` }
      default: return e
    }
  }
  const finLeft = FINANCIAL_LEFT.map(rename)
  const finRight = FINANCIAL_RIGHT.map(rename)

  const [sel, setSel] = useState<string | null>(null)
  /** Accordion: exactly one catalog section open at a time, like Bootstrap's accordion. */
  const [openSection, setOpenSection] = useState<string | null>('statements')
  const [checkAcct, setCheckAcct] = useState('')
  const [ledgerAcct, setLedgerAcct] = useState('')

  const live = useMemo(() => ({
    receipts: receipts.filter((r) => r.status !== 'void'),
    payments: paymentVouchers.filter((p) => p.status !== 'void'),
    journals: journals.filter((j) => j.status !== 'void'),
  }), [receipts, paymentVouchers, journals])

  const now = new Date()
  const year = now.getFullYear()
  const todayIso = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yearStart = `${year}-01-01`
  const monthStart = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  /** Balance Sheet (Perfex-style) filter state — pending vs applied on Filter. */
  const [bsf, setBsf] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '' })
  const [bsa, setBsa] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '' })
  /** Balance Sheet Comparison filter state — pending vs applied on Filter. */
  const [csf, setCsf] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '' })
  const [csa, setCsa] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '' })
  /** Profit & Loss filter state — pending vs applied on Filter. */
  const [plf, setPlf] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  const [pla, setPla] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  /** Profit & Loss Comparison filter state — pending vs applied on Filter. */
  const [pcf, setPcf] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  const [pca, setPca] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  /** Comparative P&L with Budgets filter state — pending vs applied on Filter. */
  const [bif, setBif] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  const [bia, setBia] = useState({ from: yearStart, to: todayIso, method: 'accrual' })
  /** Collapsed treegrid parent nodes in the balance sheet. */
  const [bsCollapsed, setBsCollapsed] = useState<Record<string, boolean>>({})

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

  const all = useMemo(() => buildMap(() => true), [live])
  const lastYear = useMemo(() => buildMap((d) => d < yearStart), [live, yearStart])
  const ytd = useMemo(() => buildMap((d) => d >= yearStart && d <= todayIso), [live, yearStart, todayIso])
  const month = useMemo(() => buildMap((d) => d >= monthStart && d <= todayIso), [live, monthStart, todayIso])

  const bal = (map: Act, id: string) => {
    const a = accounts.find((x) => x.id === id)
    const e = map.get(id)
    const net = (e?.debit ?? 0) - (e?.credit ?? 0)
    if (a && (a.type === 'liability' || a.type === 'equity' || a.type === 'income')) return -net
    return net
  }

  const budgetFor = (accountId: string, yr: number) =>
    budgets.filter((b) => b.accountId === accountId && b.year === yr).reduce((s, b) => s + (b.months || []).reduce((x, m) => x + (Number(m) || 0), 0), 0)

  const ledgerRows = (withParty: boolean): ReactNode[][] => {
    const es: { date: string; ref: string; party: string; debit: number; credit: number }[] = []
    for (const r of live.receipts) {
      if (r.depositAccountId === ledgerAcct) es.push({ date: r.date, ref: `RCT ${r.number}`, party: (r.lines || []).map((l) => accountName(accounts, l.accountId)).join(', '), debit: r.amount, credit: 0 })
      for (const l of r.lines || []) if (l.accountId === ledgerAcct) es.push({ date: r.date, ref: `RCT ${r.number}`, party: r.receivedFrom, debit: 0, credit: l.amount })
    }
    for (const p of live.payments) {
      if (p.paymentAccountId === ledgerAcct) es.push({ date: p.date, ref: `PMT ${p.number}`, party: (p.lines || []).map((l) => accountName(accounts, l.accountId)).join(', '), debit: 0, credit: p.amount })
      for (const l of p.lines || []) if (l.accountId === ledgerAcct) es.push({ date: p.date, ref: `PMT ${p.number}`, party: p.paidTo, debit: l.amount, credit: 0 })
    }
    for (const j of live.journals) for (const l of j.lines) if (l.accountId === ledgerAcct) es.push({ date: j.date, ref: `JRN ${j.number}`, party: j.description, debit: l.debit, credit: l.credit })
    es.sort((a, b) => a.date.localeCompare(b.date))
    let run = 0
    return es.map((e) => {
      run += e.debit - e.credit
      return [dFmt(e.date), e.ref, ...(withParty ? [e.party || '—'] : []), e.debit ? formatGhs(e.debit) : '', e.credit ? formatGhs(e.credit) : '', formatGhs(run)]
    })
  }

  const current = sel ? [...STATEMENTS_LEFT, ...STATEMENTS_RIGHT, ...finLeft, ...finRight, ...BUDGET].find((e) => e.id === sel) ?? null : null
  const pick = (id: string) => setSel(id)

  const render = (): ReactNode => {
    switch (sel) {
      case 'checkBalance': {
        const rows = accounts
          .filter((a) => !checkAcct || a.id === checkAcct)
          .map((a) => [a.code, <span className="font-semibold">{a.name}</span>, <span className="font-semibold">{formatGhs(Math.abs(bal(all, a.id)))}{bal(all, a.id) < 0 ? ' CR' : ' DR'}</span>])
        return (
          <div>
            <div className="mb-3 max-w-sm">
              <Field label="Account">
                <Select value={checkAcct} onChange={(e) => setCheckAcct(e.target.value)} placeholder="All accounts">
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                </Select>
              </Field>
            </div>
            <T head={['Code', 'Account', 'Balance']} right={[2]} rows={rows} />
          </div>
        )
      }
      case 'receivables': {
        const list = accounts.filter((a) => a.type === 'asset' && bal(all, a.id) > 0)
        const rows: ReactNode[][] = list.map((a) => [<span className="font-semibold">{a.name}</span>, formatGhs(bal(all, a.id))])
        if (rows.length) rows.push([<b>Total</b>, <b>{formatGhs(list.reduce((s, a) => s + bal(all, a.id), 0))}</b>])
        return rows.length ? <T head={['Account', 'Balance']} right={[1]} rows={rows} /> : <Empty title="No receivables" desc="Outstanding balances owed to the organisation appear here." />
      }
      case 'analysis': {
        const rows = accounts
          .map((a) => {
            const rec = live.receipts.reduce((s, r) => s + (r.lines || []).filter((l) => l.accountId === a.id).reduce((x, l) => x + l.amount, 0), 0)
            const pay = live.payments.reduce((s, p) => s + (p.lines || []).filter((l) => l.accountId === a.id).reduce((x, l) => x + l.amount, 0), 0)
            return { a, rec, pay }
          })
          .filter((x) => x.rec > 0 || x.pay > 0)
          .map((x) => [<span className="font-semibold">{x.a.name}</span>, formatGhs(x.rec), formatGhs(x.pay), formatGhs(x.rec - x.pay)])
        return rows.length ? <T head={['Account', 'Receipts', 'Payments', 'Net']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No activity yet" desc="Receipts and payments analysed per account appear here." />
      }
      case 'cashBook':
      case 'bankBook': {
        const cash = sel === 'cashBook'
        type E = { date: string; ref: string; part: string; inn: number; out: number }
        const es: E[] = []
        for (const r of live.receipts) if ((r.method === 'cash') === cash) es.push({ date: r.date, ref: `RCT ${r.number}`, part: r.receivedFrom, inn: r.amount, out: 0 })
        for (const p of live.payments) if ((p.method === 'cash') === cash) es.push({ date: p.date, ref: `PMT ${p.number}`, part: p.paidTo, inn: 0, out: p.amount })
        es.sort((a, b) => a.date.localeCompare(b.date))
        let run = 0
        const rows = es.map((e) => {
          run += e.inn - e.out
          return [dFmt(e.date), e.ref, e.part, e.inn ? formatGhs(e.inn) : '', e.out ? formatGhs(e.out) : '', formatGhs(run)]
        })
        return rows.length
          ? <T head={['Date', 'Voucher', 'Particulars', cash ? 'Receipts' : 'Deposits', cash ? 'Payments' : 'Withdrawals', 'Balance']} right={[3, 4, 5]} rows={rows} />
          : <Empty title={cash ? 'No cash transactions' : 'No bank transactions'} desc={cash ? 'Cash receipts and payments with a running balance appear here.' : 'Bank deposits and withdrawals with a running balance appear here.'} />
      }
      case 'reconciliation': {
        const rows = reconciliations.map((rc) => [dFmt(rc.statementDate), banks.find((b) => b.id === rc.bankAccountId)?.name ?? '—', formatGhs(rc.bookBalance), formatGhs(rc.statementBalance), formatGhs(rc.difference), rc.status])
        return rows.length ? <T head={['Statement date', 'Bank account', 'Book balance', 'Statement balance', 'Difference', 'Status']} right={[2, 3, 4]} rows={rows} /> : <Empty title="No reconciliations" desc="Bank reconciliation results comparing book and statement balances appear here." />
      }
      case 'contribution': {
        const map = new Map<string, { count: number; total: number }>()
        for (const r of live.receipts) {
          const who = r.receivedFrom || '—'
          const v = map.get(who) ?? { count: 0, total: 0 }
          v.count += 1
          v.total += r.amount
          map.set(who, v)
        }
        const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total).map(([who, v], i) => [String(i + 1), <span className="font-semibold">{who}</span>, String(v.count), formatGhs(v.total)])
        return rows.length ? <T head={['S/No.', 'Contributor', 'Receipts', 'Total']} right={[2, 3]} rows={rows} /> : <Empty title="No contributions yet" desc="Receipts grouped per contributor appear here." />
      }
      case 'listAccounts':
        return <T head={['Code', 'Account', 'Type']} rows={accounts.filter((a) => keepAccountRowAt(frPrefs, 0.005, bal(all, a.id))).map((a) => [a.code, <span className="font-semibold">{a.name}</span>, a.type])} />
      case 'ledger':
      case 'subLedger': {
        const withParty = sel === 'subLedger'
        const rows = ledgerRows(withParty)
        return (
          <div>
            <div className="mb-3 max-w-sm">
              <Field label="Account">
                <Select value={ledgerAcct} onChange={(e) => setLedgerAcct(e.target.value)} placeholder="Please Select...">
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                </Select>
              </Field>
            </div>
            {ledgerAcct
              ? rows.length ? <T head={['Date', 'Voucher', ...(withParty ? ['Party'] : []), 'Debit', 'Credit', 'Balance']} right={withParty ? [3, 4, 5] : [2, 3, 4]} rows={rows} /> : <Empty title="No entries for this account" desc="Posted vouchers touching the account appear here." />
              : <Empty title="Select an account" desc="Pick an account above to open its ledger." />}
          </div>
        )
      }
      case 'generalLedger': {
        const rows = accounts.filter((a) => keepAccountRowAt(frPrefs, 0.5, bal(all, a.id))).map((a) => {
          const e = all.get(a.id)
          return [a.code, <span className="font-semibold">{a.name}</span>, formatGhs(e?.debit ?? 0), formatGhs(e?.credit ?? 0), <span className="font-semibold">{formatGhs(Math.abs(bal(all, a.id)))}{bal(all, a.id) < 0 ? ' CR' : ' DR'}</span>]
        })
        return rows.length ? <T head={['Code', 'Account', 'Total Debit', 'Total Credit', 'Balance']} right={[2, 3, 4]} rows={rows} /> : <Empty title="No ledger activity yet" desc="Post vouchers to see account totals here." />
      }
      case 'generalJournal': {
        const rows: ReactNode[][] = []
        for (const j of [...live.journals].sort((a, b) => a.date.localeCompare(b.date))) {
          j.lines.forEach((l, i) => {
            rows.push([i === 0 ? dFmt(j.date) : '', i === 0 ? `JRN ${j.number}` : '', i === 0 ? (j.description || '—') : '', accountName(accounts, l.accountId), l.debit ? formatGhs(l.debit) : '', l.credit ? formatGhs(l.credit) : ''])
          })
        }
        return rows.length ? <T head={['Date', 'Voucher', 'Description', 'Account', 'Debit', 'Credit']} right={[4, 5]} rows={rows} /> : <Empty title="No journal entries" desc="Posted journal vouchers appear here chronologically." />
      }
      case 'sfp':
      case 'bssum': {
        const summary = sel === 'bssum'
        const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches))
        const inR = (d: string) => (bsa.type === 'range' ? d >= bsa.from && d <= bsa.to : d <= bsa.to)
        const map = buildMap(inR, bsa.method)
        const ghs = (n: number) => `GHS${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const nodes = pruneZeroRows(frPrefs, 0.005, buildSheetNodes(accounts, (id) => bal(map, id), bsa.item, summary))

        const stack: { depth: number; off: boolean }[] = []
        const body: ReactNode[] = []
        for (const n of nodes) {
          while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop()
          const off = stack.some((s) => s.off)
          stack.push({ depth: n.depth, off: off || (n.kind === 'parent' && !!bsCollapsed[n.id]) })
          if (off) continue
          const pad = { marginLeft: 24 + n.depth * 24 }
          if (n.kind === 'parent') {
            body.push(
              <tr key={n.id}>
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <button
                      type="button"
                      aria-label={bsCollapsed[n.id] ? `Expand ${n.label}` : `Collapse ${n.label}`}
                      onClick={() => setBsCollapsed((m) => ({ ...m, [n.id]: !m[n.id] }))}
                      className="mr-1.5 w-3 shrink-0 cursor-pointer text-xs leading-none text-zinc-600"
                    >
                      {bsCollapsed[n.id] ? '▶' : '▼'}
                    </button>
                    <span>{n.label}</span>
                  </div>
                </td>
                <td />
              </tr>,
            )
          } else if (n.kind === 'leaf') {
            body.push(
              <tr key={n.id}>
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <span className="mr-1.5 inline-block w-3" />
                    <span className="font-semibold">{n.label}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right font-semibold">{ghs(n.amount ?? 0)}</td>
              </tr>,
            )
          } else {
            body.push(
              <tr key={n.id} className="border-t border-zinc-700">
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <span className="mr-1.5 inline-block w-3" />
                    <span className="font-bold">{n.label}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right font-bold">{ghs(n.amount ?? 0)}</td>
              </tr>,
            )
          }
        }

        const asOfLabel = bsa.to ? `${bsa.to.slice(5, 7)}-${bsa.to.slice(8, 10)}-${bsa.to.slice(0, 4)}` : ''
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Date filter type">
                  <Select value={bsf.type} onChange={(e) => setBsf({ ...bsf, type: e.target.value })}>
                    <option value="to">To date</option>
                    <option value="range">From date to date</option>
                  </Select>
                </Field>
                {bsf.type === 'range' && (
                  <Field label="* From date"><DatePicker value={bsf.from} onChange={(v) => setBsf({ ...bsf, from: v })} /></Field>
                )}
                <Field label="* To date"><DatePicker value={bsf.to} onChange={(v) => setBsf({ ...bsf, to: v })} /></Field>
                <Field label="Accounting method">
                  <Select value={bsf.method} onChange={(e) => setBsf({ ...bsf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
                <Field label="Item">
                  <Select value={bsf.item} onChange={(e) => setBsf({ ...bsf, item: e.target.value })} placeholder="None selected">
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setBsa({ ...bsf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <div className="mx-auto max-w-3xl rounded-md border border-line bg-white p-8 text-zinc-900 shadow-sm dark:bg-white dark:text-zinc-900">
              <h3 className="text-center text-lg font-semibold text-zinc-900">{company?.name ?? 'Company'}</h3>
              <h4 className="mt-1 text-center text-sm font-semibold text-zinc-900">{summary ? terms.balanceSheetSummary : terms.balanceSheet}</h4>
              <p className="mt-1 text-center text-xs text-zinc-700">as of {asOfLabel}</p>
              <table className="mt-6 w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-zinc-800">
                    <th className="py-1 text-left font-bold" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>Accounts</th>
                    <th className="py-1 text-right font-bold" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>Total</th>
                  </tr>
                </thead>
                <tbody>{body}</tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'csfp': {
        const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches))
        const inR = (d: string) => (csa.type === 'range' ? d >= csa.from && d <= csa.to : d <= csa.to)
        const curMap = buildMap(inR, csa.method)
        const curYear = Number((csa.to || todayIso).slice(0, 4))
        const prevMap = buildMap((d) => d < `${curYear - 1}-01-01`, csa.method)
        const ghs = (n: number) => `GHS${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const curNodes = buildSheetNodes(accounts, (id) => bal(curMap, id), csa.item)
        const prevNodes = buildSheetNodes(accounts, (id) => bal(prevMap, id), csa.item)
        const nodes = pruneZeroRows(frPrefs, 0.005, curNodes.map((n, i) => ({ ...n, amount2: prevNodes[i]?.amount })), (r) => [r.amount, r.amount2])

        const stack: { depth: number; off: boolean }[] = []
        const body: ReactNode[] = []
        for (const n of nodes) {
          while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop()
          const off = stack.some((s) => s.off)
          stack.push({ depth: n.depth, off: off || (n.kind === 'parent' && !!bsCollapsed[n.id]) })
          if (off) continue
          const pad = { marginLeft: 24 + n.depth * 24 }
          if (n.kind === 'parent') {
            body.push(
              <tr key={n.id}>
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <button
                      type="button"
                      aria-label={bsCollapsed[n.id] ? `Expand ${n.label}` : `Collapse ${n.label}`}
                      onClick={() => setBsCollapsed((m) => ({ ...m, [n.id]: !m[n.id] }))}
                      className="mr-1.5 w-3 shrink-0 cursor-pointer text-xs leading-none text-zinc-600"
                    >
                      {bsCollapsed[n.id] ? '▶' : '▼'}
                    </button>
                    <span>{n.label}</span>
                  </div>
                </td>
                <td />
                <td />
              </tr>,
            )
          } else if (n.kind === 'leaf') {
            body.push(
              <tr key={n.id}>
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <span className="mr-1.5 inline-block w-3" />
                    <span className="font-semibold">{n.label}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right font-semibold">{ghs(n.amount ?? 0)}</td>
                <td className="py-1.5 text-right font-semibold">{ghs(n.amount2 ?? 0)}</td>
              </tr>,
            )
          } else {
            body.push(
              <tr key={n.id} className="border-t border-zinc-700">
                <td className="py-1.5">
                  <div style={pad} className="flex items-center">
                    <span className="mr-1.5 inline-block w-3" />
                    <span className="font-bold">{n.label}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right font-bold">{ghs(n.amount ?? 0)}</td>
                <td className="py-1.5 text-right font-bold">{ghs(n.amount2 ?? 0)}</td>
              </tr>,
            )
          }
        }

        const asOfLabel = csa.to ? `${csa.to.slice(5, 7)}-${csa.to.slice(8, 10)}-${csa.to.slice(0, 4)}` : ''
        const thStyle = { backgroundColor: '#ffffff', color: '#18181b' }
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Date filter type">
                  <Select value={csf.type} onChange={(e) => setCsf({ ...csf, type: e.target.value })}>
                    <option value="to">To date</option>
                    <option value="range">From date to date</option>
                  </Select>
                </Field>
                {csf.type === 'range' && (
                  <Field label="* From date"><DatePicker value={csf.from} onChange={(v) => setCsf({ ...csf, from: v })} /></Field>
                )}
                <Field label="* To date"><DatePicker value={csf.to} onChange={(v) => setCsf({ ...csf, to: v })} /></Field>
                <Field label="Accounting method">
                  <Select value={csf.method} onChange={(e) => setCsf({ ...csf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
                <Field label="Item">
                  <Select value={csf.item} onChange={(e) => setCsf({ ...csf, item: e.target.value })} placeholder="None selected">
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setCsa({ ...csf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <div className="mx-auto max-w-3xl rounded-md border border-line bg-white p-8 text-zinc-900 shadow-sm dark:bg-white dark:text-zinc-900">
              <h3 className="text-center text-lg font-semibold text-zinc-900">{company?.name ?? 'Company'}</h3>
              <h4 className="mt-1 text-center text-sm font-semibold text-zinc-900">{terms.balanceSheetComparison}</h4>
              <p className="mt-1 text-center text-xs text-zinc-700">as of {asOfLabel}</p>
              <table className="mt-6 w-full text-xs">
                <thead>
                  <tr className="border-t-2 border-zinc-800">
                    <th rowSpan={2} className="border-r border-zinc-800 py-1 text-left font-bold" style={thStyle}>Accounts</th>
                    <th colSpan={2} className="border-b border-zinc-800 py-1 text-center font-bold" style={thStyle}>Total</th>
                  </tr>
                  <tr className="border-b-2 border-zinc-800">
                    <th className="border-r border-zinc-800 py-1 text-center font-bold" style={thStyle}>{curYear}</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>{curYear - 1}</th>
                  </tr>
                </thead>
                <tbody>{body}</tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'ie': {
        const inR = (d: string) => d >= pla.from && d <= pla.to
        const map = buildMap(inR, pla.method)
        const ghs = (n: number) => `GHS${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const nodes = pruneZeroRows(frPrefs, 0.005, buildPLNodes(accounts, (id) => bal(map, id)))

        const body = treeBody(
          nodes,
          bsCollapsed,
          (id) => setBsCollapsed((m) => ({ ...m, [id]: !m[id] })),
          (n) => (n.kind === 'total'
            ? <td className="py-1.5 text-right font-bold">{ghs(n.amount ?? 0)}</td>
            : <td className="py-1.5 text-right font-semibold">{ghs(n.amount ?? 0)}</td>),
          <td />,
        )

        const mdy = (iso: string) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`
        const thStyle = { backgroundColor: '#ffffff', color: '#18181b' }
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="* From date"><DatePicker value={plf.from} onChange={(v) => setPlf({ ...plf, from: v })} /></Field>
                <Field label="* To date"><DatePicker value={plf.to} onChange={(v) => setPlf({ ...plf, to: v })} /></Field>
                <Field label="Accounting method">
                  <Select value={plf.method} onChange={(e) => setPlf({ ...plf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setPla({ ...plf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <div className="mx-auto max-w-3xl rounded-md border border-line bg-white p-8 text-zinc-900 shadow-sm dark:bg-white dark:text-zinc-900">
              <h4 className="text-center text-sm font-semibold text-zinc-900">{terms.profitLossTitle}</h4>
              <p className="mt-1 text-center text-xs text-zinc-700">{mdy(pla.from)} - {mdy(pla.to)}</p>
              <table className="mt-6 w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-zinc-800">
                    <th className="py-1 text-left font-bold" style={thStyle}>Accounts</th>
                    <th className="py-1 text-right font-bold" style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>{body}</tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'iecomp': {
        const inR = (d: string) => d >= pca.from && d <= pca.to
        const curMap = buildMap(inR, pca.method)
        const curYear = Number((pca.to || todayIso).slice(0, 4))
        const prevMap = buildMap((d) => d >= `${curYear - 1}-01-01` && d <= `${curYear - 1}-12-31`, pca.method)
        const ghs = (n: number) => `GHS${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const curNodes = buildPLNodes(accounts, (id) => bal(curMap, id))
        const prevNodes = buildPLNodes(accounts, (id) => bal(prevMap, id))
        const nodes = pruneZeroRows(frPrefs, 0.005, curNodes.map((n, i) => ({ ...n, amount2: prevNodes[i]?.amount })), (r) => [r.amount, r.amount2])

        const body = treeBody(
          nodes,
          bsCollapsed,
          (id) => setBsCollapsed((m) => ({ ...m, [id]: !m[id] })),
          (n) => (n.kind === 'total'
            ? <><td className="py-1.5 text-right font-bold">{ghs(n.amount ?? 0)}</td><td className="py-1.5 text-right font-bold">{ghs(n.amount2 ?? 0)}</td></>
            : <><td className="py-1.5 text-right font-semibold">{ghs(n.amount ?? 0)}</td><td className="py-1.5 text-right font-semibold">{ghs(n.amount2 ?? 0)}</td></>),
          <><td /><td /></>,
        )

        const mdy = (iso: string) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`
        const thStyle = { backgroundColor: '#ffffff', color: '#18181b' }
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="* From date"><DatePicker value={pcf.from} onChange={(v) => setPcf({ ...pcf, from: v })} /></Field>
                <Field label="* To date"><DatePicker value={pcf.to} onChange={(v) => setPcf({ ...pcf, to: v })} /></Field>
                <Field label="Accounting method">
                  <Select value={pcf.method} onChange={(e) => setPcf({ ...pcf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setPca({ ...pcf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <div className="mx-auto max-w-3xl rounded-md border border-line bg-white p-8 text-zinc-900 shadow-sm dark:bg-white dark:text-zinc-900">
              <h4 className="text-center text-sm font-semibold text-zinc-900">{terms.profitLossComparison}</h4>
              <p className="mt-1 text-center text-xs text-zinc-700">{mdy(pca.from)} - {mdy(pca.to)}</p>
              <table className="mt-6 w-full text-xs">
                <thead>
                  <tr className="border-t-2 border-zinc-800">
                    <th rowSpan={2} className="border-r border-zinc-800 py-1 text-left font-bold" style={thStyle}>Accounts</th>
                    <th colSpan={2} className="border-b border-zinc-800 py-1 text-center font-bold" style={thStyle}>Total</th>
                  </tr>
                  <tr className="border-b-2 border-zinc-800">
                    <th className="border-r border-zinc-800 py-1 text-center font-bold" style={thStyle}>{curYear}</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>{curYear - 1}</th>
                  </tr>
                </thead>
                <tbody>{body}</tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'ien': {
        const withNotes = true
        const rows: ReactNode[][] = []
        const section = (title: string, type: string) => {
          const list = accounts.filter((a) => a.type === type && keepAccountRowAt(frPrefs, 0.5, bal(all, a.id)))
          if (frPrefs.includeZeroBalanceAccounts || list.length > 0) rows.push([<b>{title}</b>, '', ...(withNotes ? [''] : [])])
          list.forEach((a) => rows.push([a.name, formatGhs(Math.abs(bal(all, a.id))), ...(withNotes ? [a.description || a.detailType || '—'] : [])]))
          return list.reduce((s, a) => s + Math.abs(bal(all, a.id)), 0)
        }
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const ti = section(terms.incomeSection, 'income')
        if (showRow(ti)) rows.push([<b>Total {terms.incomeSection.toLowerCase()}</b>, <b>{formatGhs(ti)}</b>, ...(withNotes ? [''] : [])])
        const te = section(terms.expenseSection, 'expense')
        if (showRow(te)) rows.push([<b>Total {terms.expenseSection.toLowerCase()}</b>, <b>{formatGhs(te)}</b>, ...(withNotes ? [''] : [])])
        if (showRow(ti - te)) rows.push([<b>{terms.surplusLabel}</b>, <b>{formatGhs(ti - te)}</b>, ...(withNotes ? [''] : [])])
        return <T head={withNotes ? ['Account', 'Amount', 'Notes'] : ['Account', 'Amount']} right={[1]} rows={rows} />
      }
      case 'ieb': {
        const inR = (d: string) => d >= bia.from && d <= bia.to
        const map = buildMap(inR, bia.method)
        const bYear = Number((bia.to || todayIso).slice(0, 4))
        const fromM = Math.min(Math.max(Number(bia.from.slice(5, 7)) || 1, 1), 12)
        const toM = Math.min(Math.max(Number(bia.to.slice(5, 7)) || 12, 1), 12)
        /** Budget for the selected period (monthly budget slices within From–To). */
        const periodBudget = (id: string) => {
          const b = budgets.find((x) => x.accountId === id && x.year === bYear)
          if (!b) return 0
          return (b.months || []).slice(fromM - 1, toM).reduce((s, m) => s + (Number(m) || 0), 0)
        }
        const typeOf = new Map(accounts.map((a) => [a.id, a.type]))
        const budFn = (id: string) => (typeOf.get(id) === 'expense' ? -periodBudget(id) : periodBudget(id))
        const ghs = (n: number) => `GHS${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const actNodes = buildPLNodes(accounts, (id) => bal(map, id))
        const budNodes = buildPLNodes(accounts, budFn)
        const nodes = actNodes.map((n, i) => {
          const actual = n.amount ?? 0
          const budget = budNodes[i]?.amount ?? 0
          const variance = actual - budget
          return { ...n, budget, variance, pct: budget !== 0 ? `${((variance / Math.abs(budget)) * 100).toFixed(2)}%` : '—' }
        })
        const prunedIeb = pruneZeroRows(frPrefs, 0.005, nodes, (r) => [r.amount, r.budget])

        const body = treeBody(
          prunedIeb,
          bsCollapsed,
          (id) => setBsCollapsed((m) => ({ ...m, [id]: !m[id] })),
          (n) => {
            const cls = `py-1.5 text-right ${n.kind === 'total' ? 'font-bold' : 'font-semibold'}`
            return (
              <>
                <td className={cls}>{ghs(n.budget ?? 0)}</td>
                <td className={cls}>{ghs(n.amount ?? 0)}</td>
                <td className={cls}>{ghs(n.variance ?? 0)}</td>
                <td className={cls}>{n.pct ?? '—'}</td>
              </>
            )
          },
          <><td /><td /><td /><td /></>,
        )

        const mdy = (iso: string) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`
        const thStyle = { backgroundColor: '#ffffff', color: '#18181b' }
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="* From date"><DatePicker value={bif.from} onChange={(v) => setBif({ ...bif, from: v })} /></Field>
                <Field label="* To date"><DatePicker value={bif.to} onChange={(v) => setBif({ ...bif, to: v })} /></Field>
                <Field label="Accounting method">
                  <Select value={bif.method} onChange={(e) => setBif({ ...bif, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setBia({ ...bif })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <div className="mx-auto max-w-4xl rounded-md border border-line bg-white p-8 text-zinc-900 shadow-sm dark:bg-white dark:text-zinc-900">
              <h4 className="text-center text-sm font-semibold text-zinc-900">{`Comparative ${terms.ieShort} Acct. With Budgets`}</h4>
              <p className="mt-1 text-center text-xs text-zinc-700">{mdy(bia.from)} - {mdy(bia.to)}</p>
              <table className="mt-6 w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-zinc-800">
                    <th className="py-1 text-left font-bold" style={thStyle}>Accounts</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>{bYear}<br />BUDGET<br />GH₵</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>{bYear}<br />ACTUALS<br />GH₵</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>VARIANCE<br />GH₵</th>
                    <th className="py-1 text-center font-bold" style={thStyle}>%<br />CHANGE</th>
                  </tr>
                </thead>
                <tbody>{body}</tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'cfs': {
        const cashIn = live.receipts.filter((r) => r.method === 'cash').reduce((s, r) => s + r.amount, 0)
        const cashOut = live.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
        const bankIn = live.receipts.filter((r) => r.method !== 'cash').reduce((s, r) => s + r.amount, 0)
        const bankOut = live.payments.filter((p) => p.method !== 'cash').reduce((s, p) => s + p.amount, 0)
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
        return <T head={['Item', 'Amount']} right={[1]} rows={rows} />
      }
      case 'tb': {
        const rows = accounts.filter((a) => keepAccountRowAt(frPrefs, 0.5, bal(all, a.id))).map((a) => {
          const e = all.get(a.id)
          const net = (e?.debit ?? 0) - (e?.credit ?? 0)
          return [a.code, <span className="font-semibold">{a.name}</span>, net > 0 ? formatGhs(net) : '—', net < 0 ? formatGhs(-net) : '—']
        })
        let td = 0
        let tc = 0
        for (const a of accounts) {
          const e = all.get(a.id)
          if (!e) continue
          const net = e.debit - e.credit
          if (net > 0) td += net
          else tc += -net
        }
        rows.push([<b>Total</b>, '', <b>{formatGhs(td)}</b>, <b>{formatGhs(tc)}</b>])
        return <T head={['Code', 'Account', 'Debit', 'Credit']} right={[2, 3]} rows={rows} />
      }
      case 'pl12m': {
        const stats: { label: string; inc: number; exp: number }[] = []
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          const map = buildMap((dte) => dte >= `${mKey}-01` && dte <= `${mKey}-${String(lastDay).padStart(2, '0')}`)
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
        const tInc = stats.reduce((s2, m) => s2 + m.inc, 0)
        const tExp = stats.reduce((s2, m) => s2 + m.exp, 0)
        rows.push([<b>Total</b>, <b>{formatGhs(tInc)}</b>, <b>{formatGhs(tExp)}</b>, <b>{formatGhs(tInc - tExp)}</b>])
        return <T head={['Month', 'Income', 'Expenses', 'Net Income']} right={[1, 2, 3]} rows={rows} />
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
            formatGhs(list.reduce((t, r) => t + (r.clearedDeposits ?? 0), 0)),
            formatGhs(list.reduce((t, r) => t + (r.clearedWithdrawals ?? 0), 0)),
            dFmt(last.statementDate),
            <span className={Math.abs(last.difference) >= 0.5 ? 'font-semibold text-rose-600' : ''}>{formatGhs(last.difference)}</span>,
          ]
        })
        return rows.length ? (
          <T head={['Bank account', 'Reconciliations', 'Reconciled', 'Open', 'Cleared deposits', 'Cleared withdrawals', 'Last statement', 'Difference']} right={[1, 2, 3, 4, 5, 7]} rows={rows} />
        ) : (
          <Empty title="No reconciliations" desc="Run a bank reconciliation to see the summary." />
        )
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
        return rows.length ? (
          <T head={['Statement date', 'Bank account', 'Period', 'Starting balance', 'Cleared deposits', 'Cleared withdrawals', 'Book balance', 'Statement balance', 'Difference', 'Status']} right={[3, 4, 5, 6, 7, 8]} rows={rows} />
        ) : (
          <Empty title="No reconciliations" desc="Run a bank reconciliation to see the detail." />
        )
      }
      case 'plpct': {
        const totalInc = accounts.filter((a) => a.type === 'income').reduce((s, a) => s + bal(ytd, a.id), 0)
        const totalExp = accounts.filter((a) => a.type === 'expense').reduce((s, a) => s + bal(ytd, a.id), 0)
        const incAccounts = accounts.filter((a) => a.type === 'income' && keepAccountRowAt(frPrefs, 0.5, bal(ytd, a.id)))
        const expAccounts = accounts.filter((a) => a.type === 'expense' && keepAccountRowAt(frPrefs, 0.5, bal(ytd, a.id)))
        if (!incAccounts.length && !expAccounts.length) {
          return <Empty title="No income or expense activity" desc="Post receipts, payments or journals to see this report." />
        }
        const pct = (v: number) => (totalInc !== 0 ? `${((v / totalInc) * 100).toFixed(1)}%` : '—')
        const rows: ReactNode[][] = [[<b>INCOME</b>, '', '']]
        incAccounts.forEach((a) => rows.push([<span className="font-semibold">{a.name}</span>, formatGhs(bal(ytd, a.id)), pct(bal(ytd, a.id))]))
        rows.push([<b>Total Income</b>, <b>{formatGhs(totalInc)}</b>, <b>{pct(totalInc)}</b>])
        rows.push([<b>EXPENSES</b>, '', ''])
        expAccounts.forEach((a) => rows.push([<span className="font-semibold">{a.name}</span>, formatGhs(bal(ytd, a.id)), pct(bal(ytd, a.id))]))
        rows.push([<b>Total Expenses</b>, <b>{formatGhs(totalExp)}</b>, <b>{pct(totalExp)}</b>])
        const net = totalInc - totalExp
        rows.push([<b>Net Income (Profit or Loss)</b>, <b>{formatGhs(net)}</b>, <b>{pct(net)}</b>])
        return <T head={['Account', 'Amount', '% of Total Income']} right={[1, 2]} rows={rows} />
      }
      case 'la': {
        const ca = accounts.filter((a) => a.type === 'asset' && all.has(a.id)).reduce((s, a) => s + bal(all, a.id), 0)
        const cl = accounts.filter((a) => a.type === 'liability' && all.has(a.id)).reduce((s, a) => s + bal(all, a.id), 0)
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const rows: ReactNode[][] = []
        if (showRow(ca)) rows.push(['Current assets (total assets)', formatGhs(ca)])
        if (showRow(cl)) rows.push(['Current liabilities (total liabilities)', formatGhs(cl)])
        if (showRow(ca - cl)) rows.push([<b>Working capital</b>, <b>{formatGhs(ca - cl)}</b>])
        if (frPrefs.includeZeroBalanceAccounts || cl > 0) rows.push([<b>Current ratio</b>, <b>{`${(ca / cl).toFixed(2)} : 1`}</b>])
        return <T head={['Measure', 'Value']} right={[1]} rows={rows} />
      }
      case 'fnotes': {
        const rows = accounts
          .filter((a) => (a.description || a.noteNo || a.detailType || a.bank) && keepAccountRowAt(frPrefs, 0.5, bal(all, a.id)))
          .map((a) => [
            <span className="font-semibold">{a.name}</span>,
            [a.detailType, a.description, a.bank ? `${a.bank}${a.accountNumber ? ` ${a.accountNumber}` : ''}` : '', a.noteNo ? `Ref ${a.noteNo}` : ''].filter(Boolean).join(' — '),
          ])
        return rows.length ? <T head={['Account', 'Note']} rows={rows} /> : <Empty title="No notes available" desc="Account descriptions and references appear here." />
      }
      case 'fbud': {
        const rows = budgets.filter((b) => b.year === year).map((b) => {
          const budget = budgetFor(b.accountId, year)
          const actual = Math.abs(bal(all, b.accountId))
          return [accountName(accounts, b.accountId), formatGhs(budget), formatGhs(actual), formatGhs(budget - actual)]
        })
        return rows.length ? <T head={['Account', 'Budget', 'Actual', 'Remaining']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budgets for this year" desc="Create budgets under Accounting → Budget to see them here." />
      }
      case 'budgetOverview': {
        const rows = budgets.filter((b) => b.year === year).map((b) => [accountName(accounts, b.accountId), String(b.year), formatGhs(budgetFor(b.accountId, year))])
        return rows.length ? <T head={['Account', 'Year', 'Budgeted balance']} right={[2]} rows={rows} /> : <Empty title="No budgets" desc="Create budgets under Accounting → Budget to see them here." />
      }
      case 'plBudgetVsActual': {
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (ytd.has(a.id) || budgetFor(a.id, year) > 0))
          .map((a) => {
            const actual = bal(ytd, a.id)
            const budget = a.type === 'expense' ? -budgetFor(a.id, year) : budgetFor(a.id, year)
            return [<span className="font-semibold">{a.name}</span>, formatGhs(budget), formatGhs(actual), formatGhs(actual - budget)]
          })
        return rows.length ? <T head={['Account', 'Budget', 'Actual', 'Variance']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budget data" desc="Create budgets to compare against actuals." />
      }
      case 'plBudgetPerf': {
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (month.has(a.id) || ytd.has(a.id) || budgetFor(a.id, year) > 0))
          .map((a) => [<span className="font-semibold">{a.name}</span>, formatGhs(bal(month, a.id)), formatGhs(bal(ytd, a.id)), formatGhs(budgetFor(a.id, year))])
        return rows.length ? <T head={['Account', 'This month', 'Year to date', 'Annual budget']} right={[1, 2, 3]} rows={rows} /> : <Empty title="No budget data" desc="Create budgets to compare against actuals." />
      }
      default:
        return null
    }
  }

  const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches))
  /** The selected report's preview, shared by the screen and the print sheet. */
  const previewNode = current ? render() : null
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [exportRows, setExportRows] = useState<ExportRow[]>([])
  useEffect(() => {
    setExportRows(tableToRows(bodyRef.current))
  }, [current?.id])
  const tbPrint =
    sel === 'tb'
      ? (() => {
          const rows = accounts
            .filter((a) => keepAccountRowAt(frPrefs, 0.5, bal(all, a.id)))
            .map((a) => {
              const e = all.get(a.id)
              const net = (e?.debit ?? 0) - (e?.credit ?? 0)
              return { code: a.code, name: a.name, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 }
            })
          let td = 0
          let tc = 0
          for (const a of accounts) {
            const e = all.get(a.id)
            if (!e) continue
            const net = e.debit - e.credit
            if (net > 0) td += net
            else tc += -net
          }
          return { rows, td, tc }
        })()
      : null

  return (
    <div>
      <PageHeader title="All Reports" desc="Browse the accounting report catalog — clicking a report opens its preview; use “Back to report list” to return." />
      {tbPrint &&
        createPortal(
          <>
            <style>{TB_PRINT_CSS}</style>
            <div id="tb-print-sheet">
              <div className="tb-head">
                <div>
                  <div className="tb-co">{company?.name ?? 'Company'}</div>
                  {company?.address && <div className="tb-line">{company.address}</div>}
                  {company?.stateRegion && <div className="tb-line">{company.stateRegion}</div>}
                  {company?.country && <div className="tb-line">{company.country}</div>}
                  {company?.phone && <div className="tb-line">Phone: {company.phone}</div>}
                  {company?.email && <div className="tb-line">Email: {company.email}</div>}
                </div>
                <div>
                  <div className="tb-title">TRIAL BALANCE</div>
                  <div className="tb-period">Period: {yearStart} - {todayIso}</div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th className="tb-num">Debit</th>
                    <th className="tb-num">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {tbPrint.rows.map((r) => (
                    <tr key={r.code}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td className="tb-num">{r.debit > 0 ? formatGhsExact(r.debit) : '–'}</td>
                      <td className="tb-num">{r.credit > 0 ? formatGhsExact(r.credit) : '–'}</td>
                    </tr>
                  ))}
                  <tr className="tb-total">
                    <td>TOTAL</td>
                    <td />
                    <td className="tb-num">{formatGhsExact(tbPrint.td)}</td>
                    <td className="tb-num">{formatGhsExact(tbPrint.tc)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="tb-foot">Generated on {todayIso}</div>
            </div>
          </>,
          document.body,
        )}
      {current ? (
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
            <div>
              <button type="button" onClick={() => setSel(null)} className="mb-1 block cursor-pointer text-xs text-[#1a56b0] hover:underline dark:text-sky-300">Back to report list</button>
              <h2 className="text-lg font-bold text-[#2e75b6] dark:text-sky-300">{current.label}</h2>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {current.id === 'tb' ? (
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print Trial Balance"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-mist transition hover:text-inherit"
                >
                  <Printer className="size-4" /> Print
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label={`Print ${current.label}`}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-mist transition hover:text-inherit"
                >
                  <Printer className="size-4" /> Print
                </button>
              )}
              {exportRows.length > 0 && <ExportButtons filename={`report-${current.id}`} rows={exportRows} compact />}
            </div>
          </div>
          <div ref={bodyRef}>{previewNode}</div>
          {current.id !== 'tb' && (
            <ReportPrintSheet title={current.label} subtitle={`Period: ${yearStart} - ${todayIso}`}>
              {previewNode}
            </ReportPrintSheet>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Section id="statements" title="Statements/Ledgers" open={openSection === 'statements'} onToggle={() => setOpenSection(openSection === 'statements' ? null : 'statements')}>
            <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
              <div className="space-y-5">{STATEMENTS_LEFT.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
              <div className="space-y-5">{STATEMENTS_RIGHT.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
            </div>
          </Section>
          <Section id="financial" title="Financial Reports" open={openSection === 'financial'} onToggle={() => setOpenSection(openSection === 'financial' ? null : 'financial')}>
            <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
              <div className="space-y-5">{finLeft.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
              <div className="space-y-5">{finRight.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
            </div>
          </Section>
          <Section id="budget" title="Budget" open={openSection === 'budget'} onToggle={() => setOpenSection(openSection === 'budget' ? null : 'budget')}>
            <div className="space-y-5">{BUDGET.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
          </Section>
        </div>
      )}
    </div>
  )
}
