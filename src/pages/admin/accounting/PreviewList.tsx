import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Calendar, Printer } from 'lucide-react'
import { Select, Field, Empty, DatePicker, Badge, SearchField } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { finTerms } from '../../../lib/orgTerms'
import { keepAccountRowAt, pruneZeroRows, resolveFinPrefs } from '../../../lib/financialReporting'
import { formatGhs, formatGhsExact, curTitle } from '../../../lib/utils'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { tableToRows } from '../../../lib/tableExport'
import type { ExportRow } from '../../../lib/export'
import { accountName, loadAccountNotes } from '../../../lib/accounting'
import { loadAccountingPolicies, policiesForYear, POLICY_NOTE_NUMBER } from '../../../lib/accountingPolicies'
import { bankEntries, windowEntries, entryDirection, computeStartingBalance } from '../../../lib/reconciliation'
import { AccountingReportsPage, PERIOD_OPTIONS, periodRange } from './AccountingReports'

type Entry = { id: string; label: string; desc: string }

type BadgeTone = 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange'

/** Colour-coded reference tag inferred from a transaction description/source. */
function journalRef(desc: string): { label: string; tone: BadgeTone } {
  const d = (desc || '').toLowerCase()
  if (d.includes('purchase invoice')) return { label: 'Purchase Invoice', tone: 'amber' }
  if (d.includes('cogs') || (d.includes('sales invoice') && d.includes('cost'))) return { label: 'Sales Invoice COGS', tone: 'orange' }
  if (d.includes('sales invoice')) return { label: 'Sales Invoice', tone: 'lime' }
  if (d.includes('stock transfer')) return { label: 'Stock Transfer', tone: 'lime' }
  if (d.includes('bank transfer') || d.includes('transfer')) return { label: 'Bank Transfer', tone: 'amber' }
  if (d.includes('depreciation')) return { label: 'Depreciation', tone: 'violet' }
  if (d.includes('disposal')) return { label: 'Asset Disposal', tone: 'rose' }
  if (d.includes('write-off') || d.includes('write off')) return { label: 'Asset Write-off', tone: 'rose' }
  return { label: 'Journal', tone: 'sky' }
}

const STATEMENTS_LEFT: Entry[] = [
  { id: 'checkBalance', label: 'Check Balance', desc: 'For checking balance of accounts.' },
  { id: 'cashBook', label: 'Cash Book', desc: 'Cash receipts and payments with running balance.' },
  { id: 'bankBook', label: 'Bank Book', desc: 'Bank deposits and withdrawals with running balance.' },
  { id: 'reconciliation', label: 'Bank Reconciliation', desc: 'Compares bank statements with book balances.' },
  { id: 'journalEntry', label: 'Journal Entry', desc: 'Posted journal entries with their totals and status.' },
]

const STATEMENTS_RIGHT: Entry[] = [
  { id: 'listAccounts', label: 'List of Accounts', desc: 'The full chart of accounts.' },
  { id: 'generalLedger', label: 'General Ledger', desc: 'Debit, credit and balance totals per account.' },
  { id: 'ledger', label: 'Ledger Summary', desc: 'Detailed entries and balance for one account.' },
  { id: 'subLedger', label: 'Sub-Ledger', desc: 'Account entries broken down by party.' },
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
  // Cash Flow Statement and Trial Balance follow the comparative P&L with notes.
  { id: 'cfs', label: 'Cash Flow Statement', desc: 'Cash and bank inflows and outflows.' },
  { id: 'tb', label: 'Trial Balance', desc: 'Debit and credit totals proving the books balance.' },
]

const FINANCIAL_RIGHT: Entry[] = [
  { id: 'pl12m', label: 'Monthly Profit and Loss', desc: 'Your income, expenses, and net income (profit or loss). Statistics by month.' },
  { id: 'plpct', label: 'Profit and Loss as % of total income', desc: 'Your expenses as a percentage of your total income.' },
  { id: 'reconSummary', label: 'Reconciliation Summary', desc: 'Reconciliation Summary Report' },
  { id: 'reconDetail', label: 'Reconciliation Detail', desc: 'Reconciliation Detail Report' },
  { id: 'la', label: 'Liquidity Analysis', desc: 'Ability to meet short-term obligations.' },
  { id: 'fnotes', label: 'Notes to the Financial Statement', desc: 'Supporting notes and disclosures.' },
  { id: 'fbud', label: 'Income and Expenditure Budget', desc: 'Budgeted income and expenditure.' },
]

/** Analysis books — report bodies that exist in the app but were never listed
    in the catalog, grouped here so they are reachable like every other report. */
const ANALYSIS: Entry[] = [
  { id: 'analysis', label: 'Receipt/Payment Analysis Book', desc: 'Receipts and payments analysed per account, with the net movement.' },
  { id: 'contribution', label: 'Contribution Per Head', desc: 'Receipts grouped per contributor, with the count and total given.' },
]

/** Sales-tax reports (QuickBooks "Sales tax" group). */
const SALES_TAX: Entry[] = [
  { id: 'taxDetail', label: 'Tax Detail Report', desc: 'This report lists the transactions that are included in each box on the tax return. The report is based on accrual accounting unless you changed your tax reporting preference to cash basis.' },
  { id: 'taxSummary', label: 'Tax Summary Report', desc: 'This report shows you the summary information for each box of the tax return. The report is based on accrual accounting unless you changed your tax reporting preference to cash basis.' },
  { id: 'taxLiability', label: 'Tax Liability Report', desc: "How much sales tax you've collected and how much you owe to tax agencies." },
]

/** Receivables ageing ("Who owes you"). */
const WHO_OWES_YOU: Entry[] = [
  { id: 'arAgingSummary', label: 'A/R Aging Summary', desc: 'Unpaid balances for each customer, grouped by days past due.' },
  { id: 'arAgingDetail', label: 'A/R Aging Detail', desc: 'Unpaid invoices, grouped by days past due.' },
  { id: 'openInvoices', label: 'Open Invoices', desc: 'Every unpaid invoice with its due date and open balance.' },
  { id: 'customerBalance', label: 'Customer Balance Summary', desc: 'How much each customer owes you right now.' },
  { id: 'collections', label: 'Collections Report', desc: 'Overdue invoices with the customer contact details, so you can chase payment.' },
]

/** Sales and customers. */
const SALES_CUSTOMERS: Entry[] = [
  { id: 'depositDetail', label: 'Deposit Detail', desc: 'Your deposits, with the date, customer or supplier, and amount.' },
  { id: 'incomeByCustomer', label: 'Income by Customer Summary', desc: 'Your income minus your expenses (net income) for each customer.' },
  { id: 'salesByCustomer', label: 'Sales by Customer Summary', desc: 'Total sales for each customer over the period.' },
  { id: 'txnByCustomer', label: 'Transaction List by Customer', desc: 'Every transaction for each customer, with the date, type and amount.' },
  { id: 'customerList', label: 'Customer Contact List', desc: 'Your customers with their phone, email and billing details.' },
]

/** Payables ageing ("What you owe"). */
const WHAT_YOU_OWE: Entry[] = [
  { id: 'apAgingSummary', label: 'A/P Aging Summary', desc: 'The total amount of your unpaid bills, grouped by days past due.' },
  { id: 'apAgingDetail', label: 'A/P Aging Detail', desc: 'Your unpaid bills, grouped by days past due.' },
  { id: 'unpaidBills', label: 'Unpaid Bills', desc: 'All of your unpaid bills, with the supplier, date and open balance.' },
  { id: 'supplierBalance', label: 'Supplier Balance Summary', desc: 'How much you owe each supplier right now.' },
]

/** Expenses and suppliers. */
const EXPENSES_SUPPLIERS: Entry[] = [
  { id: 'chequeDetail', label: 'Cheque Detail', desc: "The checks you've written, with the date, payee, and amount." },
  { id: 'expensesBySupplier', label: 'Expenses by Supplier Summary', desc: 'Total amount you have spent with each supplier.' },
  { id: 'txnBySupplier', label: 'Transaction List by Supplier', desc: 'Every transaction for each supplier, with the date, type and amount.' },
  { id: 'supplierList', label: 'Supplier Contact List', desc: 'Your suppliers with their contact person, phone and email.' },
]

/** Accountant tools ("For my accountant"). */
const FOR_ACCOUNTANT: Entry[] = [
  { id: 'txnDetailByAccount', label: 'Transaction Detail by Account', desc: 'Every transaction in each account, with a running balance — the accountant view of the ledger.' },
  { id: 'txnListByDate', label: 'Transaction List by Date', desc: 'All transactions in date order, with the type, name, account and amount.' },
  { id: 'recentTxns', label: 'Recent Transactions', desc: 'The transactions entered most recently, newest first.' },
  { id: 'auditLog', label: 'Audit Log', desc: 'Who did what and when — the trail of changes made in the system.' },
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

/** A user-defined report saved in the Custom Reports card. */
type CustomSource = 'receipts' | 'payments' | 'journals' | 'accounts'
type CustomReport = {
  id: string
  name: string
  source: CustomSource
  from?: string
  to?: string
  groupBy?: '' | 'month' | 'party' | 'account'
  columns: string[]
  createdAt: string
}

const CUSTOM_REPORTS_KEY = 'fitpro_custom_reports_v1'

const SOURCE_LABEL: Record<CustomSource, string> = {
  receipts: 'Receipts (money in)',
  payments: 'Payments (money out)',
  journals: 'Journal entry lines',
  accounts: 'Chart of accounts',
}

/** Columns offered per data source; `num` marks right-aligned money columns. */
const CUSTOM_COLUMNS: Record<CustomSource, { key: string; label: string; num?: boolean }[]> = {
  receipts: [
    { key: 'date', label: 'Date' }, { key: 'number', label: 'No.' }, { key: 'party', label: 'Received from' },
    { key: 'class', label: 'Stakeholder class' }, { key: 'account', label: 'Deposited to' },
    { key: 'method', label: 'Method' }, { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', num: true },
  ],
  payments: [
    { key: 'date', label: 'Date' }, { key: 'number', label: 'No.' }, { key: 'party', label: 'Paid to' },
    { key: 'class', label: 'Stakeholder class' }, { key: 'account', label: 'Paid from' },
    { key: 'method', label: 'Method' }, { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', num: true },
  ],
  journals: [
    { key: 'date', label: 'Date' }, { key: 'number', label: 'Voucher' }, { key: 'account', label: 'Account' },
    { key: 'description', label: 'Description' }, { key: 'party', label: 'Stakeholder' },
    { key: 'debit', label: 'Debit', num: true }, { key: 'credit', label: 'Credit', num: true },
  ],
  accounts: [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'type', label: 'Class' },
    { key: 'accountType', label: 'Account type' }, { key: 'balance', label: 'Balance', num: true },
  ],
}

const loadCustomReports = (): CustomReport[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_REPORTS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as CustomReport[]) : []
  } catch { return [] }
}
const saveCustomReports = (list: CustomReport[]) => {
  try { localStorage.setItem(CUSTOM_REPORTS_KEY, JSON.stringify(list)) } catch { /* storage full */ }
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
  const { accounts, receipts, paymentVouchers, journals, banks, reconciliations, budgets, purchases, suppliers, cheques, customers, audit } = app
  /** Invoice party: the customer name, falling back to the linked member. */
  const invoiceParty = (inv: { customerName?: string; memberId?: string }) => {
    if (inv.customerName) return inv.customerName
    const member = app.members.find((m) => m.id === inv.memberId)
    return app.users.find((u) => u.id === member?.userId)?.name || '—'
  }
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
  /** Every report listed in the catalog, across all sections. */
  const totalReports = STATEMENTS_LEFT.length + STATEMENTS_RIGHT.length + finLeft.length + finRight.length + ANALYSIS.length + BUDGET.length
    + SALES_TAX.length + WHO_OWES_YOU.length + SALES_CUSTOMERS.length + WHAT_YOU_OWE.length + EXPENSES_SUPPLIERS.length + FOR_ACCOUNTANT.length

  const [sel, setSel] = useState<string | null>(null)
  /** Accordion: exactly one catalog section open at a time, like Bootstrap's accordion. */
  const [openSection, setOpenSection] = useState<string | null>('statements')
  /** Expand every catalog section at once (mirrors the Report Viewer's "Show all at once"). */
  const [showAll, setShowAll] = useState(false)
  /** Catalog search — case-insensitive match on report label/description across all sections. */
  const [q, setQ] = useState('')

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

  /** Journal Entry report — pending filter inputs vs applied (on Generate). */
  const [jePeriod, setJePeriod] = useState('')
  const [jeFrom, setJeFrom] = useState(monthStart)
  const [jeTo, setJeTo] = useState(todayIso)
  const [jeStatus, setJeStatus] = useState('')
  const [jeApplied, setJeApplied] = useState({ from: monthStart, to: todayIso, status: '' })
  /** Which journal entries are expanded to show their lines. */
  const [jeOpen, setJeOpen] = useState<Record<string, boolean>>({})

  /** Bank Reconciliation Report — chosen bank account and statement. */
  const [recBankId, setRecBankId] = useState('')
  const [recId, setRecId] = useState('')

  /**
   * Bank reconciliation figures in the internationally used layout (the same
   * statement QuickBooks Online and Xero produce):
   *
   *   Statement beginning balance
   *   +/- cleared deposits and cleared payments        → Cleared balance
   *   compared with the Statement ending balance       → Difference (must be 0)
   *   +/- uncleared items as of the statement date     → Register balance
   *   +/- transactions after the statement date        → Register balance today
   */
  const recData = useMemo(() => {
    // Default to an account that actually has a statement to report on.
    const bank = banks.find((b) => b.id === recBankId)
      ?? banks.find((b) => reconciliations.some((r) => r.bankAccountId === b.id))
      ?? banks[0]
    if (!bank) return null
    const forBank = reconciliations
      .filter((r) => r.bankAccountId === bank.id)
      .slice()
      .sort((a, b) => a.statementDate.localeCompare(b.statementDate))
    // Default to the newest FINISHED statement (what accountants file), else the newest.
    const rec = forBank.find((r) => r.id === recId)
      ?? [...forBank].reverse().find((r) => r.status === 'reconciled')
      ?? forBank[forBank.length - 1]
    if (!rec) return { bank, forBank, rec: null }

    const previous = forBank.filter((r) => r.statementDate < rec.statementDate).pop()
    const ledger = bankEntries(app.accountHistory, bank)
    const inWindow = windowEntries(ledger, rec.periodStart, rec.statementDate)
    const clearedIds = new Set(rec.clearedEntryIds ?? [])
    const beginning = rec.startingBalance ?? computeStartingBalance(bank, previous)

    const split = (list: typeof ledger, cleared: boolean | null) =>
      list.filter((e) => (cleared === null ? true : clearedIds.has(e.id) === cleared))
    const deposits = (list: typeof ledger) => list.filter((e) => entryDirection(e) === 'deposit')
    const payments = (list: typeof ledger) => list.filter((e) => entryDirection(e) === 'withdrawal')
    const sum = (list: typeof ledger) => list.reduce((n, e) => n + (entryDirection(e) === 'deposit' ? e.debit : e.credit), 0)

    const clearedDeposits = deposits(split(inWindow, true))
    const clearedPayments = payments(split(inWindow, true))
    const unclearedDeposits = deposits(split(inWindow, false))
    const unclearedPayments = payments(split(inWindow, false))
    const after = ledger.filter((e) => e.dateCreated.slice(0, 10) > rec.statementDate)
    const afterDeposits = deposits(after)
    const afterPayments = payments(after)

    const clearedBalance = beginning + sum(clearedDeposits) - sum(clearedPayments)
    const difference = rec.statementBalance - clearedBalance
    const registerAtStatement = clearedBalance + sum(unclearedDeposits) - sum(unclearedPayments)
    const registerToday = registerAtStatement + sum(afterDeposits) - sum(afterPayments)

    return {
      bank, forBank, rec, beginning, sum,
      clearedDeposits, clearedPayments, unclearedDeposits, unclearedPayments,
      afterDeposits, afterPayments,
      clearedBalance, difference, registerAtStatement, registerToday,
    }
  }, [banks, reconciliations, recBankId, recId, app.accountHistory])

  /**
   * Printable Bank Reconciliation Report — same A4 sheet design as the
   * printable General Ledger, laid out as the standard reconciliation
   * statement (summary first, then the cleared and uncleared detail).
   */
  const printBankReconciliation = () => {
    const d = recData
    if (!d || !d.rec) return
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => `${n < 0 ? '(' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${n < 0 ? ')' : ''}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const amt = (e: typeof d.clearedDeposits[number]) => (entryDirection(e) === 'deposit' ? e.debit : e.credit)

    const section = (title: string, list: typeof d.clearedDeposits, total: number) => {
      const rows = list.length
        ? list.map((e) => `<tr class="vline"><td>${dmy(e.dateCreated.slice(0, 10))}</td><td>${esc(e.relType || '—')}</td>` +
            `<td>${esc(e.number || e.relId || '—')}</td><td>${esc(e.description || e.customer || e.vendor || '—')}</td>` +
            `<td class="num">${fmtNum(amt(e))}</td></tr>`).join('')
        : '<tr class="vline"><td colspan="5" style="color:#666">None</td></tr>'
      return `<tr class="acct-head"><td colspan="5">${esc(title)} (${list.length})</td></tr>${rows}` +
        `<tr class="acct-total"><td colspan="4">Total ${esc(title.toLowerCase())}</td><td class="num">${fmtNum(total)}</td></tr>`
    }

    const sumRow = (label: string, value: number, cls = '') =>
      `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${fmtNum(value)}</td></tr>`

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const periodTitle = `BANK RECONCILIATION REPORT — ${esc(d.bank.name.toUpperCase())}`
    const sub = `STATEMENT ENDING ${dmy(d.rec.statementDate)}`

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${periodTitle}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  /* On-screen A4 page. */
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3, h4 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; } h4 { font-size: 14px; margin-top: 2px; font-weight: normal; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.acct-head td { border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold; background: #f2f2f2; }
  .book tr.acct-total td { border-top: 1px solid #333; font-weight: bold; }
  .book tr.grand td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .book tr.rule td { border-top: 1px solid #333; font-weight: bold; }
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
    <h3>${periodTitle}</h3>
    <h4>${sub}${d.rec.periodStart ? ` · period ${dmy(d.rec.periodStart)} to ${dmy(d.rec.statementDate)}` : ''} · ${d.rec.status === 'reconciled' ? 'Reconciled' : 'In progress'}</h4>

    <div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Bank Account</th><th>Statement Date</th><th>Statement Balance</th>
        <th>Cleared Balance</th><th>Difference</th><th>Status</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(d.bank.name)}${d.bank.code ? ` (${esc(d.bank.code)})` : ''}</td><td>${dmy(d.rec.statementDate)}</td>
        <td>${fmtNum(d.rec.statementBalance)}</td><td>${fmtNum(d.clearedBalance)}</td>
        <td>${fmtNum(d.difference)}</td><td>${d.rec.status === 'reconciled' ? 'Reconciled' : 'Open'}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr><th>Summary</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${sumRow('Statement beginning balance', d.beginning)}
        ${sumRow(`Checks and payments cleared (${d.clearedPayments.length})`, -d.sum(d.clearedPayments))}
        ${sumRow(`Deposits and other credits cleared (${d.clearedDeposits.length})`, d.sum(d.clearedDeposits))}
        ${sumRow('Cleared balance', d.clearedBalance, 'rule')}
        ${sumRow('Statement ending balance', d.rec.statementBalance)}
        ${sumRow('Difference', d.difference, 'grand')}
        ${sumRow(`Uncleared checks and payments as of ${dmy(d.rec.statementDate)} (${d.unclearedPayments.length})`, -d.sum(d.unclearedPayments))}
        ${sumRow(`Uncleared deposits and other credits as of ${dmy(d.rec.statementDate)} (${d.unclearedDeposits.length})`, d.sum(d.unclearedDeposits))}
        ${sumRow(`Register balance as of ${dmy(d.rec.statementDate)}`, d.registerAtStatement, 'rule')}
        ${sumRow(`Checks and payments after ${dmy(d.rec.statementDate)} (${d.afterPayments.length})`, -d.sum(d.afterPayments))}
        ${sumRow(`Deposits and other credits after ${dmy(d.rec.statementDate)} (${d.afterDeposits.length})`, d.sum(d.afterDeposits))}
        ${sumRow('Register balance as of today', d.registerToday, 'grand')}
      </tbody>
    </table>

    <div class="summary-title" style="margin-top:22px">Details</div>
    <table class="book">
      <thead><tr><th>Date</th><th>Type</th><th>Ref No.</th><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${section('Cleared checks and payments', d.clearedPayments, d.sum(d.clearedPayments))}
        ${section('Cleared deposits and other credits', d.clearedDeposits, d.sum(d.clearedDeposits))}
        ${section('Uncleared checks and payments', d.unclearedPayments, d.sum(d.unclearedPayments))}
        ${section('Uncleared deposits and other credits', d.unclearedDeposits, d.sum(d.unclearedDeposits))}
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
   * Printable Reconciliation Summary — the QuickBooks/Xero summary statement
   * (beginning balance → cleared → uncleared → new transactions → ending
   * balance), on the same A4 sheet as the Bank Reconciliation report.
   */
  const printReconSummary = () => {
    const d = recData
    if (!d || !d.rec) return
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => `${n < 0 ? '(' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${n < 0 ? ')' : ''}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const row = (label: string, value: number | '', cls = '', indent = 0) =>
      `<tr class="${cls}"><td style="padding-left:${indent}px">${esc(label)}</td>` +
      `<td class="num">${value === '' ? '' : fmtNum(value)}</td></tr>`

    const clearedTotal = d.sum(d.clearedDeposits) - d.sum(d.clearedPayments)
    const unclearedTotal = d.sum(d.unclearedDeposits) - d.sum(d.unclearedPayments)
    const newTotal = d.sum(d.afterDeposits) - d.sum(d.afterPayments)
    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const title = `RECONCILIATION SUMMARY — ${esc(d.bank.name.toUpperCase())}`

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3, h4 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; } h4 { font-size: 14px; margin-top: 2px; font-weight: normal; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.grp td { padding-top: 12px; font-weight: bold; }
  .book tr.sub td { border-top: 1px solid #999; font-weight: bold; }
  .book tr.rule td { border-top: 1px solid #333; font-weight: bold; }
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
    <h3>${title}</h3>
    <h4>STATEMENT ENDING ${dmy(d.rec.statementDate)}${d.rec.periodStart ? ` · period ${dmy(d.rec.periodStart)} to ${dmy(d.rec.statementDate)}` : ''} · ${d.rec.status === 'reconciled' ? 'Reconciled' : 'In progress'}</h4>

    <div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Bank Account</th><th>Statement Date</th><th>Statement Balance</th><th>Cleared Balance</th><th>Difference</th><th>Status</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(d.bank.name)}${d.bank.code ? ` (${esc(d.bank.code)})` : ''}</td><td>${dmy(d.rec.statementDate)}</td>
        <td>${fmtNum(d.rec.statementBalance)}</td><td>${fmtNum(d.clearedBalance)}</td>
        <td>${fmtNum(d.difference)}</td><td>${d.rec.status === 'reconciled' ? 'Reconciled' : 'Open'}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr><th>Summary</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${row('Beginning balance', d.beginning)}
        ${row('Cleared transactions', '', 'grp')}
        ${row(`Checks and payments — ${d.clearedPayments.length} item${d.clearedPayments.length === 1 ? '' : 's'}`, -d.sum(d.clearedPayments), '', 16)}
        ${row(`Deposits and other credits — ${d.clearedDeposits.length} item${d.clearedDeposits.length === 1 ? '' : 's'}`, d.sum(d.clearedDeposits), '', 16)}
        ${row('Total cleared transactions', clearedTotal, 'sub', 16)}
        ${row('Cleared balance', d.clearedBalance, 'rule')}
        ${row('Statement ending balance', d.rec.statementBalance)}
        ${row('Difference', d.difference, 'grand')}
        ${row('Uncleared transactions', '', 'grp')}
        ${row(`Checks and payments — ${d.unclearedPayments.length} item${d.unclearedPayments.length === 1 ? '' : 's'}`, -d.sum(d.unclearedPayments), '', 16)}
        ${row(`Deposits and other credits — ${d.unclearedDeposits.length} item${d.unclearedDeposits.length === 1 ? '' : 's'}`, d.sum(d.unclearedDeposits), '', 16)}
        ${row('Total uncleared transactions', unclearedTotal, 'sub', 16)}
        ${row(`Register balance as of ${dmy(d.rec.statementDate)}`, d.registerAtStatement, 'rule')}
        ${row('New transactions', '', 'grp')}
        ${row(`Checks and payments — ${d.afterPayments.length} item${d.afterPayments.length === 1 ? '' : 's'}`, -d.sum(d.afterPayments), '', 16)}
        ${row(`Deposits and other credits — ${d.afterDeposits.length} item${d.afterDeposits.length === 1 ? '' : 's'}`, d.sum(d.afterDeposits), '', 16)}
        ${row('Total new transactions', newTotal, 'sub', 16)}
        ${row('Ending balance', d.registerToday, 'grand')}
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
   * Printable Reconciliation Detail — the QuickBooks/Xero detail statement:
   * every cleared, uncleared and new transaction listed under its group with
   * running group totals, on the Bank Reconciliation sheet design.
   */
  const printReconDetail = () => {
    const d = recData
    if (!d || !d.rec) return
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => `${n < 0 ? '(' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${n < 0 ? ')' : ''}`
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const amtOf = (e: typeof d.clearedDeposits[number]) => (entryDirection(e) === 'deposit' ? e.debit : e.credit)

    const line = (label: string, value: number | '', cls = '', indent = 0) =>
      `<tr class="${cls}"><td colspan="4" style="padding-left:${indent}px">${esc(label)}</td>` +
      `<td class="num">${value === '' ? '' : fmtNum(value)}</td></tr>`
    const listRows = (list: typeof d.clearedDeposits, sign: 1 | -1) => (list.length
      ? list.map((e) => `<tr class="vline"><td style="padding-left:28px">${dmy(e.dateCreated.slice(0, 10))}</td>` +
          `<td>${esc(e.relType || '—')}</td><td>${esc(e.number || e.relId || '—')}</td>` +
          `<td>${esc(e.description || e.customer || e.vendor || '—')}</td>` +
          `<td class="num">${fmtNum(sign * amtOf(e))}</td></tr>`).join('')
      : '<tr class="vline"><td colspan="4" style="padding-left:28px;color:#666">None</td><td class="num"></td></tr>')
    const group = (title: string, payments: typeof d.clearedPayments, deposits: typeof d.clearedDeposits) => {
      const total = d.sum(deposits) - d.sum(payments)
      return line(title, '', 'grp') +
        line(`Checks and payments — ${payments.length} item${payments.length === 1 ? '' : 's'}`, -d.sum(payments), 'sub-grp', 16) +
        listRows(payments, -1) +
        line(`Deposits and other credits — ${deposits.length} item${deposits.length === 1 ? '' : 's'}`, d.sum(deposits), 'sub-grp', 16) +
        listRows(deposits, 1) +
        line(`Total ${title.toLowerCase()}`, total, 'sub', 16)
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const l1 = esc((company?.name || 'Company').toUpperCase())
    const l2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const title = `RECONCILIATION DETAIL — ${esc(d.bank.name.toUpperCase())}`

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3, h4 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; } h4 { font-size: 14px; margin-top: 2px; font-weight: normal; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 4px 8px; vertical-align: top; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.grp td { padding-top: 12px; font-weight: bold; }
  .book tr.sub-grp td { font-weight: bold; }
  .book tr.sub td { border-top: 1px solid #999; font-weight: bold; }
  .book tr.rule td { border-top: 1px solid #333; font-weight: bold; }
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
    <h1>${l1}</h1>
    ${l2 ? `<h2>${l2}</h2>` : ''}
    <h3>${title}</h3>
    <h4>STATEMENT ENDING ${dmy(d.rec.statementDate)}${d.rec.periodStart ? ` · period ${dmy(d.rec.periodStart)} to ${dmy(d.rec.statementDate)}` : ''} · ${d.rec.status === 'reconciled' ? 'Reconciled' : 'In progress'}</h4>

    <div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Bank Account</th><th>Statement Date</th><th>Statement Balance</th><th>Cleared Balance</th><th>Difference</th><th>Status</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(d.bank.name)}${d.bank.code ? ` (${esc(d.bank.code)})` : ''}</td><td>${dmy(d.rec.statementDate)}</td>
        <td>${fmtNum(d.rec.statementBalance)}</td><td>${fmtNum(d.clearedBalance)}</td>
        <td>${fmtNum(d.difference)}</td><td>${d.rec.status === 'reconciled' ? 'Reconciled' : 'Open'}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr><th>Date</th><th>Type</th><th>Ref No.</th><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${line('Beginning balance', d.beginning, 'grand')}
        ${group('Cleared transactions', d.clearedPayments, d.clearedDeposits)}
        ${line('Cleared balance', d.clearedBalance, 'rule')}
        ${line('Statement ending balance', d.rec.statementBalance)}
        ${line('Difference', d.difference, 'grand')}
        ${group('Uncleared transactions', d.unclearedPayments, d.unclearedDeposits)}
        ${line(`Register balance as of ${dmy(d.rec.statementDate)}`, d.registerAtStatement, 'rule')}
        ${group('New transactions', d.afterPayments, d.afterDeposits)}
        ${line('Ending balance', d.registerToday, 'grand')}
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
   * Printable Journal Entry register — same A4 sheet design as the printable
   * General Ledger: company header, period title, a Journal Summary band, then
   * one block per journal entry (voucher band with date / reference / status,
   * its account lines, and an entry total) with a grand total proving Dr = Cr.
   */
  const printJournalEntry = () => {
    const from = jeApplied.from
    const to = jeApplied.to
    const entries = journals
      .filter((j) => j.date >= from && j.date <= to)
      .filter((j) => !jeApplied.status || j.status === jeApplied.status)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))

    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

    const periodTitle = `JOURNAL ENTRIES FROM ${dmy(from) || '—'} TO ${dmy(to) || '—'}`

    let grandDr = 0
    let grandCr = 0
    const rowsHtml: string[] = []
    for (const j of entries) {
      const dr = j.lines.reduce((n, l) => n + (l.debit || 0), 0)
      const cr = j.lines.reduce((n, l) => n + (l.credit || 0), 0)
      grandDr += dr
      grandCr += cr
      const tag = journalRef(j.description || '').label
      rowsHtml.push(
        `<tr class="acct-head"><td colspan="6">${esc(`${j.number} · ${dmy(j.date)} · ${tag} · ${cap(j.status)}`)}` +
        `${j.description ? ` — ${esc(j.description)}` : ''}</td></tr>`,
      )
      for (const l of j.lines) {
        const a = accounts.find((x) => x.id === l.accountId)
        const lineDesc = (l as { description?: string }).description || j.description || ''
        rowsHtml.push(
          `<tr class="vline"><td>${dmy(j.date)}</td><td>${esc(j.number)}</td>` +
          `<td><div class="acct">${esc(a ? `${a.code ? `${a.code}-` : ''}${a.name}` : '—')}</div></td>` +
          `<td class="narr">${esc(lineDesc)}</td>` +
          `<td class="num">${l.debit ? fmtNum(l.debit) : ''}</td><td class="num">${l.credit ? fmtNum(l.credit) : ''}</td></tr>`,
        )
      }
      rowsHtml.push(
        `<tr class="acct-total"><td></td><td></td><td colspan="2">Total ${esc(j.number)}</td>` +
        `<td class="num">${fmtNum(dr)}</td><td class="num">${fmtNum(cr)}</td></tr>`,
      )
    }

    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const line1 = esc((company?.name || 'Company').toUpperCase())
    const line2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')
    const bodyRows = rowsHtml.length
      ? rowsHtml.join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:#666">No journal entries for the selected period.</td></tr>'

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
  .book .acct { font-weight: 600; }
  .book .narr { color: #333; }
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

    <div class="summary-title">Journal Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Dated From</th><th>Dated To</th><th>Status</th>
        <th>Entries</th><th>Total Debit</th><th>Total Credit</th>
      </tr></thead>
      <tbody><tr>
        <td>${dmy(from) || '—'}</td><td>${dmy(to) || '—'}</td><td>${esc(jeApplied.status ? cap(jeApplied.status) : 'All Status')}</td>
        <td>${entries.length}</td><td>${fmtNum(grandDr)}</td><td>${fmtNum(grandCr)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr>
        <th>Date</th><th>Journal No.</th><th>Account</th><th>Description</th>
        <th class="num">Debit</th><th class="num">Credit</th>
      </tr></thead>
      <tbody>${bodyRows}
        <tr class="grand"><td></td><td></td><td colspan="2">Grand Total</td><td class="num">${fmtNum(grandDr)}</td><td class="num">${fmtNum(grandCr)}</td></tr>
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

  /** General Journal report filters. */

  /** General Ledger report — pending inputs vs applied (on Generate). */


  /** Balance Sheet (Perfex-style) filter state — pending vs applied on Filter. */
  const [bsf, setBsf] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '', period: '' })
  const [bsa, setBsa] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '', period: '' })
  /** Balance Sheet Comparison filter state — pending vs applied on Filter. */
  const [csf, setCsf] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '', period: '' })
  const [csa, setCsa] = useState({ type: 'to', to: todayIso, from: yearStart, method: 'accrual', item: '', period: '' })
  /** Profit & Loss filter state — pending vs applied on Filter. */
  const [plf, setPlf] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  const [pla, setPla] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  /** Profit & Loss Comparison filter state — pending vs applied on Filter. */
  const [pcf, setPcf] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  const [pca, setPca] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  /** Comparative P&L with Budgets filter state — pending vs applied on Filter. */
  const [bif, setBif] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  const [bia, setBia] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  /** Trial Balance filter state — pending vs applied on Filter. */
  const [tbf, setTbf] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  const [tba, setTba] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  /** Comparative P&L With Notes filter state — pending vs applied on Filter. */
  const [ienf, setIenf] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  const [iena, setIena] = useState({ from: yearStart, to: todayIso, method: 'accrual', period: '' })
  /** Cash Flow Statement filter state — pending vs applied on Filter. */
  const [cfsf, setCfsf] = useState({ from: yearStart, to: todayIso, period: '' })
  const [cfsa, setCfsa] = useState({ from: yearStart, to: todayIso, period: '' })
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

  /**
   * Generic per-report filters. Every report that needs one keeps a small
   * record here ({ from, to, q, a, b }) keyed by its report id, so adding a
   * filter bar to a report is a one-liner.
   */
  type RepFilter = { from?: string; to?: string; q?: string; a?: string; b?: string }
  const [repFilters, setRepFilters] = useState<Record<string, RepFilter>>({})
  const rf = (id: string): RepFilter => repFilters[id] ?? {}
  const setRf = (id: string, patch: RepFilter) => setRepFilters((m) => ({ ...m, [id]: { ...(m[id] ?? {}), ...patch } }))
  const clearRf = (id: string) => setRepFilters((m) => ({ ...m, [id]: {} }))
  /** True when a date sits inside the report's (optional) from/to filter. */
  const inRf = (id: string, date: string) => {
    const f = rf(id)
    const d = (date || '').slice(0, 10)
    return (!f.from || d >= f.from) && (!f.to || d <= f.to)
  }

  type SelectCfg = { key: 'a' | 'b'; label: string; placeholder?: string; options: { value: string; label: string }[] }
  /** Renders the standard inline filter bar used across the report catalog. */
  const filterBar = (
    id: string,
    cfg: { dates?: boolean; asOf?: boolean; search?: string; selects?: SelectCfg[] },
  ) => {
    const f = rf(id)
    return (
      <div className="mb-5 flex w-full flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
        {cfg.dates && (
          <>
            <div className="min-w-[150px] flex-1"><Field label="From date">
              <DatePicker value={f.from || ''} onChange={(v) => setRf(id, { from: v })} max={f.to || undefined} placeholder="Dated from" />
            </Field></div>
            <div className="min-w-[150px] flex-1"><Field label="To date">
              <DatePicker value={f.to || ''} onChange={(v) => setRf(id, { to: v })} min={f.from || undefined} placeholder="Dated to" />
            </Field></div>
          </>
        )}
        {cfg.asOf && (
          <div className="min-w-[150px] flex-1"><Field label="As at date">
            <DatePicker value={f.to || todayIso} onChange={(v) => setRf(id, { to: v })} placeholder="As at" />
          </Field></div>
        )}
        {(cfg.selects ?? []).map((sc) => (
          <div key={sc.key} className="min-w-[150px] flex-1"><Field label={sc.label}>
            {/* With nothing chosen the first option is the effective default. */}
            <Select value={f[sc.key] || sc.options[0]?.value || ''} onChange={(e) => setRf(id, { [sc.key]: e.target.value } as RepFilter)} placeholder={sc.placeholder}>
              {sc.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field></div>
        ))}
        {cfg.search && (
          <div className="min-w-[170px] flex-1"><Field label="Search">
            <SearchField value={f.q || ''} onChange={(v) => setRf(id, { q: v })} placeholder={cfg.search} />
          </Field></div>
        )}
        <button
          type="button"
          onClick={() => clearRf(id)}
          className="mb-1 inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
        >
          Clear
        </button>
      </div>
    )
  }
  /** Wraps a report body with its filter bar. */
  const withFilters = (bar: ReactNode, body: ReactNode) => (<div>{bar}{body}</div>)

  /** Small header above a saved custom report: what it covers + Edit. */
  const customHeader = (def: CustomReport) => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-black/[0.02] px-4 py-3 text-xs dark:bg-white/[0.03] print:hidden">
      <div>
        <div className="font-bold text-[#2e75b6] dark:text-sky-300">{def.name}</div>
        <div className="mt-0.5 text-mist">
          {SOURCE_LABEL[def.source]}
          {def.from || def.to ? ` · ${def.from ? dFmt(def.from) : '…'} – ${def.to ? dFmt(def.to) : '…'}` : ' · all dates'}
          {def.groupBy ? ` · grouped by ${def.groupBy}` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={() => { setCbDraft(def); setSel('customBuilder') }}
        className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
      >
        Edit report
      </button>
    </div>
  )

  /** Custom Reports — user-built reports saved in this browser. */
  const [customReports, setCustomReports] = useState<CustomReport[]>(() => loadCustomReports())
  const [cbDraft, setCbDraft] = useState<CustomReport | null>(null)
  const persistCustom = (list: CustomReport[]) => { setCustomReports(list); saveCustomReports(list) }
  const newCustomDraft = (): CustomReport => ({
    id: `cr_${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    source: 'receipts',
    from: '',
    to: '',
    groupBy: '',
    columns: CUSTOM_COLUMNS.receipts.map((c) => c.key),
    createdAt: new Date().toISOString(),
  })

  /** Tax Detail Report filters: date range, transaction type, tax, search. */
  const [txFrom, setTxFrom] = useState('')
  const [txTo, setTxTo] = useState('')
  const [txType, setTxType] = useState('all')
  const [txTax, setTxTax] = useState('')
  const [txQuery, setTxQuery] = useState('')

  /** Monthly Profit and Loss filters: period, month range, basis, options. */
  const [plYear, setPlYear] = useState('rolling')
  const [plFrom, setPlFrom] = useState('1')
  const [plTo, setPlTo] = useState('12')
  const [plBasis, setPlBasis] = useState<'accrual' | 'cash'>('accrual')
  const [plHideEmpty, setPlHideEmpty] = useState(false)

  /** Liquidity Analysis — as-of date and the length of the trend window. */
  const [laAsOf, setLaAsOf] = useState(todayIso)
  const [laMonths, setLaMonths] = useState('6')

  /**
   * Liquidity model — classifies the chart of accounts the way QuickBooks,
   * Sage 50 and TallyPrime do, then derives the standard liquidity measures.
   * Only CURRENT assets and CURRENT liabilities feed the ratios, per IAS 1.
   *
   *   Current assets      = cash + bank + receivables + inventory + other CA
   *   Current liabilities = A/P + payroll + taxes + short-term loans + other CL
   *   Working capital     = CA − CL
   *   Current ratio       = CA / CL
   *   Quick ratio         = (CA − inventory) / CL
   *   Cash ratio          = (cash + bank) / CL
   *   Net liquidity       = (cash + bank) − immediate obligations (A/P + taxes
   *                         + payroll + short-term loans)
   */
  const laModel = useMemo(() => {
    const asOf = laAsOf || todayIso
    // Balance at a date = opening balance + movements up to that date.
    const movementsTo = (iso: string) => buildMap((d) => d <= iso)
    const balanceAt = (map: Act, a: typeof accounts[number]) => {
      const e = map.get(a.id)
      const net = (e?.debit ?? 0) - (e?.credit ?? 0)
      const signed = a.type === 'liability' || a.type === 'equity' || a.type === 'income' ? -net : net
      return (a.primaryBalance ?? 0) + signed
    }
    const text = (a: typeof accounts[number]) => `${a.name} ${a.detailType || ''}`.toLowerCase()
    const typeId = (a: typeof accounts[number]) => Number(a.accountTypeId)
    const isInventory = (a: typeof accounts[number]) => /invent|stock|goods/.test(text(a))
    const isPayroll = (a: typeof accounts[number]) => /payroll|salar|wage|ssf|pension|gratuity/.test(text(a))
    const isTax = (a: typeof accounts[number]) => /tax|vat|withholding|paye|levy/.test(text(a))
    const isLoan = (a: typeof accounts[number]) => /loan|overdraft|borrow|line of credit|note payable/.test(text(a))

    const groups = {
      cash: accounts.filter((a) => typeId(a) === 3),
      bank: accounts.filter((a) => typeId(a) === 16),
      receivables: accounts.filter((a) => typeId(a) === 1),
      inventory: accounts.filter((a) => typeId(a) === 2 && isInventory(a)),
      otherCA: accounts.filter((a) => typeId(a) === 2 && !isInventory(a)),
      payables: accounts.filter((a) => typeId(a) === 6),
      payroll: accounts.filter((a) => typeId(a) === 8 && isPayroll(a)),
      taxes: accounts.filter((a) => typeId(a) === 8 && !isPayroll(a) && isTax(a)),
      loans: accounts.filter((a) => typeId(a) === 7 || (typeId(a) === 8 && !isPayroll(a) && !isTax(a) && isLoan(a))),
      otherCL: accounts.filter((a) => typeId(a) === 8 && !isPayroll(a) && !isTax(a) && !isLoan(a)),
    }

    /** Every measure at one date — reused by the trend series. */
    const snapshot = (iso: string) => {
      const map = movementsTo(iso)
      const sum = (list: typeof accounts) => list.reduce((n, a) => n + balanceAt(map, a), 0)
      const cash = sum(groups.cash)
      const bank = sum(groups.bank)
      const receivables = sum(groups.receivables)
      const inventory = sum(groups.inventory)
      const otherCA = sum(groups.otherCA)
      const payables = sum(groups.payables)
      const payroll = sum(groups.payroll)
      const taxes = sum(groups.taxes)
      const loans = sum(groups.loans)
      const otherCL = sum(groups.otherCL)
      const currentAssets = cash + bank + receivables + inventory + otherCA
      const currentLiabilities = payables + payroll + taxes + loans + otherCL
      const liquid = cash + bank
      const immediate = payables + payroll + taxes + loans
      const ratio = (n: number) => (currentLiabilities > 0 ? n / currentLiabilities : null)
      return {
        date: iso, map, cash, bank, receivables, inventory, otherCA,
        payables, payroll, taxes, loans, otherCL,
        currentAssets, currentLiabilities, liquid, immediate,
        workingCapital: currentAssets - currentLiabilities,
        currentRatio: ratio(currentAssets),
        quickRatio: ratio(currentAssets - inventory),
        cashRatio: ratio(liquid),
        netLiquidity: liquid - immediate,
      }
    }

    const now = snapshot(asOf)
    // Trend: month-ends up to the as-of month.
    const months = Number(laMonths) || 6
    const [y, m] = asOf.split('-').map(Number)
    const series = Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(y, m - months + i + 1, 0))
      return snapshot(d.toISOString().slice(0, 10))
    })

    // Per-bank balances. Available = current balance less uncleared payments
    // (cheques issued but not yet presented) from the latest reconciliation.
    const bankRows = groups.bank.map((a) => {
      const current = balanceAt(now.map, a)
      const rec = reconciliations
        .filter((r) => r.bankAccountId === a.id)
        .slice()
        .sort((x, z) => x.statementDate.localeCompare(z.statementDate))
        .pop()
      let outstanding = 0
      if (rec) {
        const cleared = new Set(rec.clearedEntryIds ?? [])
        const entries = windowEntries(bankEntries(app.accountHistory, { id: a.id, code: a.code }), rec.periodStart, rec.statementDate)
        outstanding = entries
          .filter((e) => !cleared.has(e.id) && entryDirection(e) === 'withdrawal')
          .reduce((n, e) => n + e.credit, 0)
      }
      const meta = banks.find((b) => b.id === a.id)
      return { id: a.id, name: a.name, code: a.code || '', number: meta?.accountNumber || '', current, available: current - outstanding, outstanding }
    })

    // Health status and the warnings QuickBooks-style dashboards surface.
    const alerts: string[] = []
    if (now.cash + now.bank < 0) alerts.push('Negative cash/bank balance — the books show more money paid out than received.')
    if (now.currentRatio !== null && now.currentRatio < 1) alerts.push(`Current ratio is ${now.currentRatio.toFixed(2)} — below the 1.00 safety line.`)
    if (now.quickRatio !== null && now.quickRatio < 1) alerts.push(`Quick ratio is ${now.quickRatio.toFixed(2)} — short-term obligations depend on selling inventory.`)
    if (now.payables > 0 && now.payables > now.liquid) alerts.push('Payables exceed available cash and bank balances.')
    if (now.workingCapital < 0) alerts.push('Working capital is negative — current liabilities exceed current assets.')

    const status = now.currentRatio === null
      ? 'No current liabilities'
      : now.currentRatio >= 2 ? 'Healthy'
        : now.currentRatio >= 1 ? 'Satisfactory'
          : 'At risk'

    const interpretation: string[] = []
    if (now.currentRatio !== null) {
      if (now.currentRatio > 2) interpretation.push('Excellent liquidity position.')
      else if (now.currentRatio >= 1) interpretation.push('Satisfactory liquidity position.')
      else interpretation.push('Potential liquidity risk.')
    }
    if (now.quickRatio !== null && now.quickRatio < 1) {
      interpretation.push('Company may struggle to meet short-term obligations without selling inventory.')
    }

    return { asOf, groups, now, series, bankRows, alerts, status, interpretation, balanceAt }
  }, [accounts, banks, reconciliations, app.accountHistory, laAsOf, laMonths, live, todayIso])

  /** Printable Liquidity Analysis management report (A4, same sheet design). */
  const printLiquidity = () => {
    const d = laModel
    const n = d.now
    const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]
    const fmtNum = (v: number) => `${v < 0 ? '(' : ''}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${v < 0 ? ')' : ''}`
    const ratio = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} : 1`)
    const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const line = (label: string, value: string, cls = '', indent = 0) =>
      `<tr class="${cls}"><td style="padding-left:${indent}px">${esc(label)}</td><td class="num">${value}</td></tr>`
    const curName = company?.currency === 'GHS' || !company?.currency ? 'Ghana Cedi(s)' : company.currency
    const l1 = esc((company?.name || 'Company').toUpperCase())
    const l2 = esc([company?.location, company?.stateRegion].filter(Boolean).join(' — ') || company?.address || '')

    const bankTable = d.bankRows.length ? `
    <div class="summary-title" style="margin-top:22px">Bank Accounts</div>
    <table class="book">
      <thead><tr><th>Bank Account</th><th>Account Number</th><th class="num">Current Balance</th><th class="num">Available Balance</th></tr></thead>
      <tbody>
        ${d.bankRows.map((b) => `<tr class="vline"><td>${esc(b.name)}${b.code ? ` (${esc(b.code)})` : ''}</td><td>${esc(b.number || '—')}</td>` +
          `<td class="num">${fmtNum(b.current)}</td><td class="num">${fmtNum(b.available)}</td></tr>`).join('')}
        <tr class="grand"><td colspan="2">Total bank balances</td>` +
          `<td class="num">${fmtNum(d.bankRows.reduce((t, b) => t + b.current, 0))}</td>` +
          `<td class="num">${fmtNum(d.bankRows.reduce((t, b) => t + b.available, 0))}</td></tr>
      </tbody>
    </table>` : ''

    const trendTable = `
    <div class="summary-title" style="margin-top:22px">Trend Analysis</div>
    <table class="book">
      <thead><tr><th>Month</th><th class="num">Cash Position</th><th class="num">Current Ratio</th><th class="num">Quick Ratio</th><th class="num">Working Capital</th></tr></thead>
      <tbody>
        ${d.series.map((p) => `<tr class="vline"><td>${dmy(p.date)}</td><td class="num">${fmtNum(p.liquid)}</td>` +
          `<td class="num">${p.currentRatio === null ? '—' : p.currentRatio.toFixed(2)}</td>` +
          `<td class="num">${p.quickRatio === null ? '—' : p.quickRatio.toFixed(2)}</td>` +
          `<td class="num">${fmtNum(p.workingCapital)}</td></tr>`).join('')}
      </tbody>
    </table>`

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>LIQUIDITY ANALYSIS REPORT</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3, h4 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 2px; } h3 { font-size: 16px; margin-top: 4px; } h4 { font-size: 13px; margin-top: 2px; font-weight: normal; }
  .summary-title { text-align: center; font-weight: bold; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; }
  .cur { text-align: right; font-weight: bold; margin: 18px 0 4px; }
  .book th { border-bottom: 2px solid #333; padding: 6px 8px; text-align: left; font-weight: bold; }
  .book td { padding: 5px 8px; }
  .book th.num, .book td.num { text-align: right; white-space: nowrap; }
  .book tr.grp td { padding-top: 12px; font-weight: bold; text-transform: uppercase; }
  .book tr.sub td { border-top: 1px solid #999; font-weight: bold; }
  .book tr.grand td { border-top: 2px solid #333; font-weight: bold; padding-top: 8px; }
  .note { border: 1px solid #333; padding: 10px 12px; margin-top: 18px; }
  .note b { display: block; margin-bottom: 4px; }
  .note ul { margin: 0; padding-left: 18px; }
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
    <h1>${l1}</h1>
    ${l2 ? `<h2>${l2}</h2>` : ''}
    <h3>LIQUIDITY ANALYSIS REPORT</h3>
    <h4>AS AT ${dmy(d.asOf)}</h4>

    <div class="summary-title">Report Summary</div>
    <table class="summary">
      <thead><tr>
        <th>Current Assets</th><th>Current Liabilities</th><th>Working Capital</th>
        <th>Current Ratio</th><th>Quick Ratio</th><th>Cash Ratio</th><th>Status</th>
      </tr></thead>
      <tbody><tr>
        <td>${fmtNum(n.currentAssets)}</td><td>${fmtNum(n.currentLiabilities)}</td><td>${fmtNum(n.workingCapital)}</td>
        <td>${ratio(n.currentRatio)}</td><td>${ratio(n.quickRatio)}</td><td>${ratio(n.cashRatio)}</td><td>${esc(d.status)}</td>
      </tr></tbody>
    </table>

    <div class="cur">Amount in ${esc(curName)}</div>
    <table class="book">
      <thead><tr><th>Statement</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${line('Current assets', '', 'grp')}
        ${line('Cash on hand', fmtNum(n.cash), '', 16)}
        ${line('Bank accounts', fmtNum(n.bank), '', 16)}
        ${line('Accounts receivable', fmtNum(n.receivables), '', 16)}
        ${line('Inventory', fmtNum(n.inventory), '', 16)}
        ${line('Other current assets', fmtNum(n.otherCA), '', 16)}
        ${line('Total current assets', fmtNum(n.currentAssets), 'sub', 16)}
        ${line('Current liabilities', '', 'grp')}
        ${line('Accounts payable', fmtNum(n.payables), '', 16)}
        ${line('Payroll liabilities', fmtNum(n.payroll), '', 16)}
        ${line('Taxes payable', fmtNum(n.taxes), '', 16)}
        ${line('Short-term loans', fmtNum(n.loans), '', 16)}
        ${line('Other current liabilities', fmtNum(n.otherCL), '', 16)}
        ${line('Total current liabilities', fmtNum(n.currentLiabilities), 'sub', 16)}
        ${line('Working capital', fmtNum(n.workingCapital), 'grand')}
        ${line('Liquidity ratios', '', 'grp')}
        ${line('Current ratio', ratio(n.currentRatio), '', 16)}
        ${line('Quick ratio (acid test)', ratio(n.quickRatio), '', 16)}
        ${line('Cash ratio', ratio(n.cashRatio), '', 16)}
        ${line('Net liquidity position', fmtNum(n.netLiquidity), 'grand')}
      </tbody>
    </table>

    ${bankTable}
    ${trendTable}

    <div class="note">
      <b>Interpretation</b>
      <ul>${d.interpretation.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>No current liabilities recorded at this date.</li>'}</ul>
    </div>
    ${d.alerts.length ? `<div class="note"><b>Alerts</b><ul>${d.alerts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
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


  const customEntries: Entry[] = customReports.map((r) => ({
    id: `custom:${r.id}`,
    label: r.name,
    desc: `${SOURCE_LABEL[r.source]}${r.from || r.to ? ` · ${r.from || '…'} to ${r.to || '…'}` : ''}${r.groupBy ? ` · grouped by ${r.groupBy}` : ''}`,
  }))
  const current = sel
    ? (sel === 'customBuilder'
        ? { id: 'customBuilder', label: cbDraft && customReports.some((r) => r.id === cbDraft.id) ? `Edit — ${cbDraft.name}` : 'New custom report', desc: 'Build a report from your own data source, period, columns and grouping.' }
        : [...STATEMENTS_LEFT, ...STATEMENTS_RIGHT, ...finLeft, ...finRight, ...ANALYSIS, ...BUDGET, ...SALES_TAX, ...WHO_OWES_YOU, ...SALES_CUSTOMERS, ...WHAT_YOU_OWE, ...EXPENSES_SUPPLIERS, ...FOR_ACCOUNTANT, ...customEntries].find((e) => e.id === sel) ?? null)
    : null
  const pick = (id: string) => setSel(id)


  const render = (): ReactNode => {
    switch (sel) {
      case 'checkBalance': {
        // Reuse the Report Viewer's Check Balance so both places stay identical.
        return <AccountingReportsPage bodyOnly embedded forcedReport="checkBalance" />
      }
      case 'receivables': {
        const bar = filterBar('receivables', { asOf: true, search: 'Account…' })
        const f = rf('receivables')
        const asOf = f.to || todayIso
        const ql = (f.q || '').trim().toLowerCase()
        const map = buildMap((d) => d <= asOf)
        const list = accounts
          .filter((a) => a.type === 'asset' && bal(map, a.id) > 0)
          .filter((a) => !ql || `${a.code || ''} ${a.name}`.toLowerCase().includes(ql))
        const rows: ReactNode[][] = list.map((a) => [<span className="font-semibold">{a.name}</span>, formatGhs(bal(map, a.id))])
        if (rows.length) rows.push([<b>Total</b>, <b>{formatGhs(list.reduce((s2, a) => s2 + bal(map, a.id), 0))}</b>])
        return withFilters(bar, rows.length
          ? <T head={['Account', curTitle('Balance')]} right={[1]} rows={rows} />
          : <Empty title="No receivables" desc="Outstanding balances owed to the organisation appear here." />)
      }
      case 'analysis': {
        const bar = filterBar('analysis', { dates: true, search: 'Account…' })
        const ql = (rf('analysis').q || '').trim().toLowerCase()
        const rows = accounts
          .map((a) => {
            const rec = live.receipts.filter((r) => inRf('analysis', r.date)).reduce((s2, r) => s2 + (r.lines || []).filter((l) => l.accountId === a.id).reduce((x, l) => x + l.amount, 0), 0)
            const pay = live.payments.filter((pv) => inRf('analysis', pv.date)).reduce((s2, pv) => s2 + (pv.lines || []).filter((l) => l.accountId === a.id).reduce((x, l) => x + l.amount, 0), 0)
            return { a, rec, pay }
          })
          .filter((x) => (x.rec > 0 || x.pay > 0) && (!ql || `${x.a.code || ''} ${x.a.name}`.toLowerCase().includes(ql)))
          .map((x) => [<span className="font-semibold">{x.a.name}</span>, formatGhs(x.rec), formatGhs(x.pay), formatGhs(x.rec - x.pay)])
        return withFilters(bar, rows.length
          ? <T head={['Account', curTitle('Receipts'), curTitle('Payments'), curTitle('Net')]} right={[1, 2, 3]} rows={rows} />
          : <Empty title="No activity for the selected filters" desc="Receipts and payments analysed per account appear here." />)
      }
      case 'cashBook': {
        // Reuse the Report Viewer's Cash Book so both places stay identical.
        return <AccountingReportsPage bodyOnly embedded forcedReport="cashBook" />
      }
      case 'bankBook': {
        // Reuse the Report Viewer's Bank Book so both places stay identical.
        return <AccountingReportsPage bodyOnly embedded forcedReport="bankBook" />
      }
      case 'reconciliation': {
        // Standard bank reconciliation statement — the layout QuickBooks Online
        // and Xero print: summary (beginning balance → cleared balance →
        // difference → register balance) followed by cleared/uncleared detail.
        const d = recData
        if (!d) return <Empty title="No bank accounts" desc="Add a bank account, then reconcile a statement to see this report." />
        // Reconciliations are matched to the cent, so always show 2 decimals.
        const money = (n: number) => (n < 0 ? `(${formatGhsExact(Math.abs(n))})` : formatGhsExact(n))
        const bankPicker = (
          <div className="mb-5 flex w-full max-w-3xl flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
            <div className="min-w-[180px] flex-1"><Field label="Bank account">
              <Select value={d.bank.id} onChange={(e) => { setRecBankId(e.target.value); setRecId('') }}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[180px] flex-1"><Field label="Statement">
              <Select value={d.rec?.id ?? ''} onChange={(e) => setRecId(e.target.value)} placeholder="No statements">
                {d.forBank.map((r) => <option key={r.id} value={r.id}>{dFmt(r.statementDate)} — {r.status === 'reconciled' ? 'Reconciled' : 'Open'}</option>)}
              </Select>
            </Field></div>
            <button
              type="button"
              disabled={!d.rec}
              onClick={printBankReconciliation}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="size-4" /> Print
            </button>
          </div>
        )
        if (!d.rec) {
          return (
            <div>
              {bankPicker}
              <Empty title="No reconciliation for this account" desc="Start and complete a reconciliation under Accounting → Bank Reconciliation, then come back." />
            </div>
          )
        }
        const rec = d.rec
        const stDate = dFmt(rec.statementDate)
        const bold = (n: ReactNode) => <span className="font-bold">{n}</span>
        const summaryRows: ReactNode[][] = [
          ['Statement beginning balance', money(d.beginning)],
          [`Checks and payments cleared (${d.clearedPayments.length})`, money(-d.sum(d.clearedPayments))],
          [`Deposits and other credits cleared (${d.clearedDeposits.length})`, money(d.sum(d.clearedDeposits))],
          [bold('Cleared balance'), bold(money(d.clearedBalance))],
          ['Statement ending balance', money(rec.statementBalance)],
          [bold('Difference'), <span className={`font-bold ${Math.round(d.difference * 100) === 0 ? 'text-emerald-600' : 'text-ember'}`}>{money(d.difference)}</span>],
          [`Uncleared checks and payments as of ${stDate} (${d.unclearedPayments.length})`, money(-d.sum(d.unclearedPayments))],
          [`Uncleared deposits and other credits as of ${stDate} (${d.unclearedDeposits.length})`, money(d.sum(d.unclearedDeposits))],
          [bold(`Register balance as of ${stDate}`), bold(money(d.registerAtStatement))],
          [`Checks and payments after ${stDate} (${d.afterPayments.length})`, money(-d.sum(d.afterPayments))],
          [`Deposits and other credits after ${stDate} (${d.afterDeposits.length})`, money(d.sum(d.afterDeposits))],
          [bold('Register balance as of today'), bold(money(d.registerToday))],
        ]
        const detail = (title: string, list: typeof d.clearedDeposits) => {
          const total = d.sum(list)
          const rows: ReactNode[][] = list.length
            ? list.map((e) => [
                dFmt(e.dateCreated.slice(0, 10)),
                e.relType || '—',
                e.number || e.relId || '—',
                e.description || e.customer || e.vendor || '—',
                formatGhsExact(entryDirection(e) === 'deposit' ? e.debit : e.credit),
              ])
            : [['—', '—', '—', <span className="text-mist">None</span>, '—']]
          rows.push(['', '', '', bold('Total'), bold(formatGhsExact(total))])
          return (
            <div className="mt-6" key={title}>
              <h3 className="mb-2 text-sm font-bold text-ink dark:text-white">{title} ({list.length})</h3>
              <T head={['Date', 'Type', 'Ref No.', 'Description', curTitle('Amount')]} right={[4]} rows={rows} />
            </div>
          )
        }
        return (
          <div>
            {bankPicker}
            <div className="mb-4 rounded-lg border border-line bg-black/[0.02] px-4 py-3 text-xs dark:bg-white/[0.03]">
              <div className="font-bold text-[#2e75b6] dark:text-sky-300">{d.bank.name}{d.bank.code ? ` (${d.bank.code})` : ''}</div>
              <div className="mt-0.5 text-mist">
                Statement ending {stDate}
                {rec.periodStart ? ` · period ${dFmt(rec.periodStart)} – ${stDate}` : ''}
                {' · '}{rec.status === 'reconciled' ? `Reconciled${rec.finishedAt ? ` on ${dFmt(rec.finishedAt.slice(0, 10))}` : ''}` : 'In progress'}
              </div>
            </div>
            <T head={['Summary', curTitle('Amount')]} right={[1]} rows={summaryRows} />
            {detail('Cleared checks and payments', d.clearedPayments)}
            {detail('Cleared deposits and other credits', d.clearedDeposits)}
            {detail('Uncleared checks and payments', d.unclearedPayments)}
            {detail('Uncleared deposits and other credits', d.unclearedDeposits)}
          </div>
        )
      }
      case 'contribution': {
        const bar = filterBar('contribution', { dates: true, search: 'Contributor…' })
        const ql = (rf('contribution').q || '').trim().toLowerCase()
        const map = new Map<string, { count: number; total: number }>()
        for (const r of live.receipts) {
          if (!inRf('contribution', r.date)) continue
          const who = r.receivedFrom || '—'
          if (ql && !who.toLowerCase().includes(ql)) continue
          const v = map.get(who) ?? { count: 0, total: 0 }
          v.count += 1
          v.total += r.amount
          map.set(who, v)
        }
        const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total).map(([who, v], i) => [String(i + 1), <span className="font-semibold">{who}</span>, String(v.count), formatGhs(v.total)])
        return withFilters(bar, rows.length
          ? <T head={['S/No.', 'Contributor', curTitle('Receipts'), curTitle('Total')]} right={[2, 3]} rows={rows} />
          : <Empty title="No contributions for the selected filters" desc="Receipts grouped per contributor appear here." />)
      }
      case 'listAccounts':
        // Mirror the Report Viewer: the same option picker (Accounts List /
        // Opening Balance Form / Fixed Asset Opening Balance Form) and the same
        // printable sheet, so both places behave identically.
        return <AccountingReportsPage bodyOnly embedded forcedReport="listAccounts" />
      case 'subLedger': {
        // Reuse the Report Viewer's Sub-Ledger so both places stay identical.
        return <AccountingReportsPage bodyOnly forcedReport="subLedger" />
      }
      case 'ledger': {
        // Reuse the Report Viewer's Ledger Summary so both places stay identical.
        return <AccountingReportsPage bodyOnly forcedReport="ledger" />
      }
      case 'generalLedger': {
        // Reuse the Report Viewer's General Ledger so both places stay identical.
        return <AccountingReportsPage bodyOnly forcedReport="generalLedger" />
      }
      case 'generalJournal': {
        // Reuse the Report Viewer's General Journal so both places stay identical.
        return <AccountingReportsPage bodyOnly embedded forcedReport="generalJournal" />
      }
      case 'journalEntry': {
        const refOf = journalRef
        /** Account-code chip tone follows the account class. */
        const codeTone = (t?: string): Parameters<typeof Badge>[0]['tone'] =>
          t === 'asset' ? 'amber' : t === 'liability' ? 'rose' : t === 'equity' ? 'violet' : t === 'income' ? 'lime' : 'sky'
        const statusTone = (s: string): Parameters<typeof Badge>[0]['tone'] => (s === 'posted' ? 'lime' : s === 'draft' ? 'amber' : 'rose')
        const jeRows = journals
          .filter((j) => j.date >= jeApplied.from && j.date <= jeApplied.to)
          .filter((j) => !jeApplied.status || j.status === jeApplied.status)
          .sort((a, b) => b.date.localeCompare(a.date))
        const totDebit = (j: typeof journals[number]) => j.lines.reduce((s, l) => s + (l.debit || 0), 0)
        const totCredit = (j: typeof journals[number]) => j.lines.reduce((s, l) => s + (l.credit || 0), 0)
        const clearFilters = () => { setJePeriod(''); setJeFrom(monthStart); setJeTo(todayIso); setJeStatus(''); setJeApplied({ from: monthStart, to: todayIso, status: '' }) }
        return (
          <div>
            {/* Filter bar — Period · From · To · Status · Generate · Clear · Print stay on
                ONE line at every width: the four fields shrink (never wrap) and the row
                scrolls horizontally only when even the minimum widths no longer fit. */}
            <div className="mb-5 flex w-full flex-nowrap items-end gap-2 overflow-x-auto pb-1 print:hidden">
              <div className="min-w-[116px] max-w-[176px] flex-1"><Field label="Period">
                <Select value={jePeriod} onChange={(e) => { const v = e.target.value; setJePeriod(v); const r = periodRange(v); if (r) { setJeFrom(r.from); setJeTo(r.to) } }} placeholder="Select period">
                  <option value="">Select period</option>
                  {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                </Select>
              </Field></div>
              <div className="min-w-[116px] max-w-[176px] flex-1"><Field label="From Date"><DatePicker value={jeFrom} onChange={(v) => { setJeFrom(v); setJePeriod('') }} max={jeTo} /></Field></div>
              <div className="min-w-[116px] max-w-[176px] flex-1"><Field label="To Date"><DatePicker value={jeTo} onChange={(v) => { setJeTo(v); setJePeriod('') }} min={jeFrom} /></Field></div>
              <div className="min-w-[108px] max-w-[160px] flex-1"><Field label="Status">
                <Select value={jeStatus} onChange={(e) => setJeStatus(e.target.value)} placeholder="All Status">
                  <option value="posted">Posted</option>
                  <option value="draft">Draft</option>
                  <option value="void">Void</option>
                </Select>
              </Field></div>
              <button
                type="button"
                onClick={() => setJeApplied({ from: jeFrom, to: jeTo, status: jeStatus })}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Generate
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={printJournalEntry}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-mist transition hover:text-inherit"
              >
                <Printer className="size-4" /> Print
              </button>
            </div>

            {jeRows.length ? (
              <div className="overflow-hidden rounded-lg border border-line shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-xs">
                    <thead>
                      <tr className="bg-[#2e75b6] text-left text-[10px] font-bold uppercase tracking-wider text-white">
                        <th className="w-8 px-3 py-2.5" />
                        <th className="px-3 py-2.5">Journal #</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Reference</th>
                        <th className="px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5 text-right">{curTitle('Total Debit')}</th>
                        <th className="px-3 py-2.5 text-right">{curTitle('Total Credit')}</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70 bg-white dark:bg-transparent">
                      {jeRows.map((j) => {
                        const r = refOf(j.description)
                        const open = !!jeOpen[j.id]
                        return (
                          <Fragment key={j.id}>
                            <tr
                              onClick={() => setJeOpen((m) => ({ ...m, [j.id]: !m[j.id] }))}
                              className="cursor-pointer transition-colors hover:bg-[#2e75b6]/10 dark:hover:bg-[#2e75b6]/15"
                            >
                              <td className="px-3 py-2.5 text-mist">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                              <td className="px-3 py-2.5"><Badge tone="sky" className="font-semibold">{j.number}</Badge></td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-mist"><Calendar className="size-3.5" /> {dFmt(j.date)}</span>
                              </td>
                              <td className="px-3 py-2.5"><Badge tone={r.tone}>{r.label}</Badge></td>
                              <td className="px-3 py-2.5">{j.description || '—'}</td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatGhs(totDebit(j))}</td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatGhs(totCredit(j))}</td>
                              <td className="px-3 py-2.5 text-center"><Badge tone={statusTone(j.status)}>{j.status.charAt(0).toUpperCase() + j.status.slice(1)}</Badge></td>
                            </tr>
                            {open && (
                              <tr className="bg-zinc-50/70 dark:bg-white/[0.02]">
                                <td className="px-0 py-0" colSpan={8}>
                                  <div className="px-6 py-3">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-mist">
                                          <th className="py-1.5 pr-3">Account Code</th>
                                          <th className="py-1.5 pr-3">Account Name</th>
                                          <th className="py-1.5 pr-3">Description</th>
                                          <th className="py-1.5 pr-3 text-right">{curTitle('Debit')}</th>
                                          <th className="py-1.5 pl-3 text-right">{curTitle('Credit')}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {j.lines.map((l, li) => {
                                          const a = accounts.find((x) => x.id === l.accountId)
                                          const lineDesc = (l as { description?: string }).description
                                          return (
                                            <tr key={li} className="border-t border-line/50">
                                              <td className="py-1.5 pr-3"><Badge tone={codeTone(a?.type)}>{a?.code ?? '—'}</Badge></td>
                                              <td className="py-1.5 pr-3">{a?.name ?? '—'}</td>
                                              <td className="py-1.5 pr-3 text-mist">{lineDesc || j.description || '—'}</td>
                                              <td className="py-1.5 pr-3 text-right tabular-nums">{l.debit ? formatGhs(l.debit) : '-'}</td>
                                              <td className="py-1.5 pl-3 text-right tabular-nums">{l.credit ? formatGhs(l.credit) : '-'}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Empty title="No journal entries" desc="No journal entries match the selected dates and status. Adjust the filters and click Generate." />
            )}
          </div>
        )
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
                <Field label="Period">
                  <Select value={bsf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setBsf({ ...bsf, period: v, ...(r ? { type: 'range', from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="Date filter type">
                  <Select value={bsf.type} onChange={(e) => setBsf({ ...bsf, type: e.target.value })}>
                    <option value="to">To date</option>
                    <option value="range">From date to date</option>
                  </Select>
                </Field>
                {bsf.type === 'range' && (
                  <Field label="* From date"><DatePicker value={bsf.from} onChange={(v) => setBsf({ ...bsf, from: v, period: '' })} /></Field>
                )}
                <Field label="* To date"><DatePicker value={bsf.to} onChange={(v) => setBsf({ ...bsf, to: v, period: '' })} /></Field>
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
                <Field label="Period">
                  <Select value={csf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setCsf({ ...csf, period: v, ...(r ? { type: 'range', from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="Date filter type">
                  <Select value={csf.type} onChange={(e) => setCsf({ ...csf, type: e.target.value })}>
                    <option value="to">To date</option>
                    <option value="range">From date to date</option>
                  </Select>
                </Field>
                {csf.type === 'range' && (
                  <Field label="* From date"><DatePicker value={csf.from} onChange={(v) => setCsf({ ...csf, from: v, period: '' })} /></Field>
                )}
                <Field label="* To date"><DatePicker value={csf.to} onChange={(v) => setCsf({ ...csf, to: v, period: '' })} /></Field>
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
                <Field label="Period">
                  <Select value={plf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setPlf({ ...plf, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={plf.from} onChange={(v) => setPlf({ ...plf, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={plf.to} onChange={(v) => setPlf({ ...plf, to: v, period: '' })} /></Field>
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
                <Field label="Period">
                  <Select value={pcf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setPcf({ ...pcf, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={pcf.from} onChange={(v) => setPcf({ ...pcf, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={pcf.to} onChange={(v) => setPcf({ ...pcf, to: v, period: '' })} /></Field>
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
        const inR = (d: string) => d >= iena.from && d <= iena.to
        const map = buildMap(inR, iena.method)
        const withNotes = true
        const rows: ReactNode[][] = []
        const section = (title: string, type: string) => {
          const list = accounts.filter((a) => a.type === type && keepAccountRowAt(frPrefs, 0.5, bal(map, a.id)))
          if (frPrefs.includeZeroBalanceAccounts || list.length > 0) rows.push([<b>{title}</b>, '', ...(withNotes ? [''] : [])])
          list.forEach((a) => rows.push([a.name, formatGhs(Math.abs(bal(map, a.id))), ...(withNotes ? [a.description || a.detailType || '—'] : [])]))
          return list.reduce((s, a) => s + Math.abs(bal(map, a.id)), 0)
        }
        const showRow = (v: number) => frPrefs.includeZeroBalanceAccounts || Math.abs(v) >= 0.5
        const ti = section(terms.incomeSection, 'income')
        if (showRow(ti)) rows.push([<b>Total {terms.incomeSection.toLowerCase()}</b>, <b>{formatGhs(ti)}</b>, ...(withNotes ? [''] : [])])
        const te = section(terms.expenseSection, 'expense')
        if (showRow(te)) rows.push([<b>Total {terms.expenseSection.toLowerCase()}</b>, <b>{formatGhs(te)}</b>, ...(withNotes ? [''] : [])])
        if (showRow(ti - te)) rows.push([<b>{terms.surplusLabel}</b>, <b>{formatGhs(ti - te)}</b>, ...(withNotes ? [''] : [])])
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Period">
                  <Select value={ienf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setIenf({ ...ienf, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={ienf.from} onChange={(v) => setIenf({ ...ienf, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={ienf.to} onChange={(v) => setIenf({ ...ienf, to: v, period: '' })} /></Field>
                <Field label="Accounting method">
                  <Select value={ienf.method} onChange={(e) => setIenf({ ...ienf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setIena({ ...ienf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <T head={withNotes ? ['Account', 'Amount', 'Notes'] : ['Account', 'Amount']} right={[1]} rows={rows} />
          </div>
        )
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
                <Field label="Period">
                  <Select value={bif.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setBif({ ...bif, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={bif.from} onChange={(v) => setBif({ ...bif, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={bif.to} onChange={(v) => setBif({ ...bif, to: v, period: '' })} /></Field>
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
        const inR = (d: string) => d >= cfsa.from && d <= cfsa.to
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
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Period">
                  <Select value={cfsf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setCfsf({ ...cfsf, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={cfsf.from} onChange={(v) => setCfsf({ ...cfsf, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={cfsf.to} onChange={(v) => setCfsf({ ...cfsf, to: v, period: '' })} /></Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setCfsa({ ...cfsf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <T head={['Item', curTitle('Amount')]} right={[1]} rows={rows} />
          </div>
        )
      }
      case 'tb': {
        const inR = (d: string) => d >= tba.from && d <= tba.to
        const map = buildMap(inR, tba.method)
        const rows = accounts.filter((a) => keepAccountRowAt(frPrefs, 0.5, bal(map, a.id))).map((a) => {
          const e = map.get(a.id)
          const net = (e?.debit ?? 0) - (e?.credit ?? 0)
          return [a.code, <span className="font-semibold">{a.name}</span>, net > 0 ? formatGhs(net) : '—', net < 0 ? formatGhs(-net) : '—']
        })
        let td = 0
        let tc = 0
        for (const a of accounts) {
          const e = map.get(a.id)
          if (!e) continue
          const net = e.debit - e.credit
          if (net > 0) td += net
          else tc += -net
        }
        rows.push([<b>Total</b>, '', <b>{formatGhs(td)}</b>, <b>{formatGhs(tc)}</b>])
        return (
          <div>
            <div className="mb-6 rounded-lg border border-line p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Period">
                  <Select value={tbf.period} onChange={(e) => { const v = e.target.value; const r = periodRange(v); setTbf({ ...tbf, period: v, ...(r ? { from: r.from, to: r.to } : {}) }) }} placeholder="Select period">
                    {PERIOD_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </Select>
                </Field>
                <Field label="* From date"><DatePicker value={tbf.from} onChange={(v) => setTbf({ ...tbf, from: v, period: '' })} /></Field>
                <Field label="* To date"><DatePicker value={tbf.to} onChange={(v) => setTbf({ ...tbf, to: v, period: '' })} /></Field>
                <Field label="Accounting method">
                  <Select value={tbf.method} onChange={(e) => setTbf({ ...tbf, method: e.target.value })}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setTba({ ...tbf })} className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#1a8fd1] px-4 text-sm font-semibold text-white transition hover:brightness-110">Filter</button>
                <button type="button" onClick={() => window.print()} aria-label="Print" className="inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border border-line text-mist transition hover:text-inherit"><Printer className="size-4" /></button>
              </div>
            </div>
            <T head={['Code', 'Account', curTitle('Debit'), curTitle('Credit')]} right={[2, 3]} rows={rows} />
          </div>
        )
      }
      case 'pl12m': {
        // Filters: rolling 12 months or a chosen year with a month range,
        // accrual/cash basis, and an option to drop months with no activity.
        const txnYears = Array.from(new Set([
          ...live.receipts.map((r) => r.date.slice(0, 4)),
          ...live.payments.map((pv) => pv.date.slice(0, 4)),
          ...live.journals.map((j) => j.date.slice(0, 4)),
          String(now.getFullYear()),
        ])).filter(Boolean).sort((a, b) => b.localeCompare(a))
        const rolling = plYear === 'rolling'
        const from = Math.min(Number(plFrom) || 1, Number(plTo) || 12)
        const to = Math.max(Number(plFrom) || 1, Number(plTo) || 12)

        // The months the report covers.
        const periods = rolling
          ? Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1))
          : Array.from({ length: to - from + 1 }, (_, i) => new Date(Number(plYear), from - 1 + i, 1))

        const stats = periods.map((d) => {
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          const map = buildMap((dte) => dte >= `${mKey}-01` && dte <= `${mKey}-${String(lastDay).padStart(2, '0')}`, plBasis)
          let inc = 0
          let exp = 0
          for (const a of accounts) {
            if (a.type === 'income') inc += bal(map, a.id)
            else if (a.type === 'expense') exp += bal(map, a.id)
          }
          return { label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), inc, exp }
        }).filter((m) => !plHideEmpty || Math.abs(m.inc) >= 0.005 || Math.abs(m.exp) >= 0.005)

        const monthOptions = Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: new Date(2024, i, 1).toLocaleDateString('en-GB', { month: 'long' }),
        }))
        const filters = (
          <div className="mb-5 flex w-full flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
            <div className="min-w-[150px] flex-1"><Field label="Period">
              <Select value={plYear} onChange={(e) => setPlYear(e.target.value)}>
                <option value="rolling">Last 12 months</option>
                {txnYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[130px] flex-1"><Field label="From month">
              <Select value={plFrom} onChange={(e) => setPlFrom(e.target.value)} disabled={rolling}>
                {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[130px] flex-1"><Field label="To month">
              <Select value={plTo} onChange={(e) => setPlTo(e.target.value)} disabled={rolling}>
                {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[130px] flex-1"><Field label="Basis">
              <Select value={plBasis} onChange={(e) => setPlBasis(e.target.value as 'accrual' | 'cash')}>
                <option value="accrual">Accrual</option>
                <option value="cash">Cash</option>
              </Select>
            </Field></div>
            <label className="mb-2 inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-[#2e75b6]"
                checked={plHideEmpty}
                onChange={(e) => setPlHideEmpty(e.target.checked)}
              />
              Hide months with no activity
            </label>
            <button
              type="button"
              onClick={() => { setPlYear('rolling'); setPlFrom('1'); setPlTo('12'); setPlBasis('accrual'); setPlHideEmpty(false) }}
              className="mb-1 inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
            >
              Clear
            </button>
          </div>
        )

        if (!stats.length) {
          return (
            <div>
              {filters}
              <Empty title="No activity for the selected period" desc="Widen the month range, switch the period or untick “Hide months with no activity”." />
            </div>
          )
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
        return (
          <div>
            {filters}
            <T head={['Month', curTitle('Income'), curTitle('Expenses'), curTitle('Net Income')]} right={[1, 2, 3]} rows={rows} />
          </div>
        )
      }
      case 'reconSummary': {
        // Modelled on the Bank Reconciliation report in Statements/Ledgers:
        // the QuickBooks/Xero summary — beginning balance, cleared, uncleared
        // and new transactions, ending at the register balance today.
        const d = recData
        if (!d) return <Empty title="No bank accounts" desc="Add a bank account, then reconcile a statement to see this report." />
        const money = (n: number) => (n < 0 ? `(${formatGhsExact(Math.abs(n))})` : formatGhsExact(n))
        const picker = (
          <div className="mb-5 flex w-full max-w-3xl flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
            <div className="min-w-[180px] flex-1"><Field label="Bank account">
              <Select value={d.bank.id} onChange={(e) => { setRecBankId(e.target.value); setRecId('') }}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[180px] flex-1"><Field label="Statement">
              <Select value={d.rec?.id ?? ''} onChange={(e) => setRecId(e.target.value)} placeholder="No statements">
                {d.forBank.map((r) => <option key={r.id} value={r.id}>{dFmt(r.statementDate)} — {r.status === 'reconciled' ? 'Reconciled' : 'Open'}</option>)}
              </Select>
            </Field></div>
            <button
              type="button"
              disabled={!d.rec}
              onClick={printReconSummary}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="size-4" /> Print
            </button>
          </div>
        )
        if (!d.rec) {
          return (
            <div>
              {picker}
              <Empty title="No reconciliation for this account" desc="Start and complete a reconciliation under Accounting → Bank Reconciliation, then come back." />
            </div>
          )
        }
        const rec = d.rec
        const stDate = dFmt(rec.statementDate)
        const bold = (n: ReactNode) => <span className="font-bold">{n}</span>
        const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`
        const indent = (t: string) => <span className="pl-4">{t}</span>
        const clearedTotal = d.sum(d.clearedDeposits) - d.sum(d.clearedPayments)
        const unclearedTotal = d.sum(d.unclearedDeposits) - d.sum(d.unclearedPayments)
        const newTotal = d.sum(d.afterDeposits) - d.sum(d.afterPayments)
        const rows: ReactNode[][] = [
          ['Beginning balance', money(d.beginning)],
          [bold('Cleared transactions'), ''],
          [indent(`Checks and payments — ${items(d.clearedPayments.length)}`), money(-d.sum(d.clearedPayments))],
          [indent(`Deposits and other credits — ${items(d.clearedDeposits.length)}`), money(d.sum(d.clearedDeposits))],
          [bold(<span className="pl-4">Total cleared transactions</span>), bold(money(clearedTotal))],
          [bold('Cleared balance'), bold(money(d.clearedBalance))],
          ['Statement ending balance', money(rec.statementBalance)],
          [bold('Difference'), <span className={`font-bold ${Math.round(d.difference * 100) === 0 ? 'text-emerald-600' : 'text-ember'}`}>{money(d.difference)}</span>],
          [bold('Uncleared transactions'), ''],
          [indent(`Checks and payments — ${items(d.unclearedPayments.length)}`), money(-d.sum(d.unclearedPayments))],
          [indent(`Deposits and other credits — ${items(d.unclearedDeposits.length)}`), money(d.sum(d.unclearedDeposits))],
          [bold(<span className="pl-4">Total uncleared transactions</span>), bold(money(unclearedTotal))],
          [bold(`Register balance as of ${stDate}`), bold(money(d.registerAtStatement))],
          [bold('New transactions'), ''],
          [indent(`Checks and payments — ${items(d.afterPayments.length)}`), money(-d.sum(d.afterPayments))],
          [indent(`Deposits and other credits — ${items(d.afterDeposits.length)}`), money(d.sum(d.afterDeposits))],
          [bold(<span className="pl-4">Total new transactions</span>), bold(money(newTotal))],
          [bold('Ending balance'), bold(money(d.registerToday))],
        ]
        return (
          <div>
            {picker}
            <div className="mb-4 rounded-lg border border-line bg-black/[0.02] px-4 py-3 text-xs dark:bg-white/[0.03]">
              <div className="font-bold text-[#2e75b6] dark:text-sky-300">{d.bank.name}{d.bank.code ? ` (${d.bank.code})` : ''}</div>
              <div className="mt-0.5 text-mist">
                Statement ending {stDate}
                {rec.periodStart ? ` · period ${dFmt(rec.periodStart)} – ${stDate}` : ''}
                {' · '}{rec.status === 'reconciled' ? `Reconciled${rec.finishedAt ? ` on ${dFmt(rec.finishedAt.slice(0, 10))}` : ''}` : 'In progress'}
              </div>
            </div>
            <T head={['Summary', curTitle('Amount')]} right={[1]} rows={rows} />
          </div>
        )
      }
      case 'reconDetail': {
        // Mirrors the Bank Reconciliation report, listing every transaction in
        // its reconciliation group (cleared / uncleared / new).
        const d = recData
        if (!d) return <Empty title="No bank accounts" desc="Add a bank account, then reconcile a statement to see this report." />
        const money = (n: number) => (n < 0 ? `(${formatGhsExact(Math.abs(n))})` : formatGhsExact(n))
        const picker = (
          <div className="mb-5 flex w-full max-w-3xl flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
            <div className="min-w-[180px] flex-1"><Field label="Bank account">
              <Select value={d.bank.id} onChange={(e) => { setRecBankId(e.target.value); setRecId('') }}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
              </Select>
            </Field></div>
            <div className="min-w-[180px] flex-1"><Field label="Statement">
              <Select value={d.rec?.id ?? ''} onChange={(e) => setRecId(e.target.value)} placeholder="No statements">
                {d.forBank.map((r) => <option key={r.id} value={r.id}>{dFmt(r.statementDate)} — {r.status === 'reconciled' ? 'Reconciled' : 'Open'}</option>)}
              </Select>
            </Field></div>
            <button
              type="button"
              disabled={!d.rec}
              onClick={printReconDetail}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="size-4" /> Print
            </button>
          </div>
        )
        if (!d.rec) {
          return (
            <div>
              {picker}
              <Empty title="No reconciliation for this account" desc="Start and complete a reconciliation under Accounting → Bank Reconciliation, then come back." />
            </div>
          )
        }
        const rec = d.rec
        const stDate = dFmt(rec.statementDate)
        const bold = (n: ReactNode) => <span className="font-bold">{n}</span>
        const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`
        const amtOf = (e: typeof d.clearedDeposits[number]) => (entryDirection(e) === 'deposit' ? e.debit : e.credit)
        const rows: ReactNode[][] = []
        const headLine = (label: ReactNode, value: ReactNode) => rows.push([label, '', '', '', value])
        const txnLines = (list: typeof d.clearedDeposits, sign: 1 | -1) => {
          if (!list.length) { rows.push([<span className="pl-8 text-mist">None</span>, '', '', '', '']); return }
          for (const e of list) {
            rows.push([
              <span className="pl-8">{dFmt(e.dateCreated.slice(0, 10))}</span>,
              e.relType || '—',
              e.number || e.relId || '—',
              e.description || e.customer || e.vendor || '—',
              money(sign * amtOf(e)),
            ])
          }
        }
        const group = (title: string, payments: typeof d.clearedPayments, deposits: typeof d.clearedDeposits) => {
          headLine(bold(title), '')
          headLine(bold(<span className="pl-4">{`Checks and payments — ${items(payments.length)}`}</span>), bold(money(-d.sum(payments))))
          txnLines(payments, -1)
          headLine(bold(<span className="pl-4">{`Deposits and other credits — ${items(deposits.length)}`}</span>), bold(money(d.sum(deposits))))
          txnLines(deposits, 1)
          headLine(bold(<span className="pl-4">{`Total ${title.toLowerCase()}`}</span>), bold(money(d.sum(deposits) - d.sum(payments))))
        }
        headLine(bold('Beginning balance'), bold(money(d.beginning)))
        group('Cleared transactions', d.clearedPayments, d.clearedDeposits)
        headLine(bold('Cleared balance'), bold(money(d.clearedBalance)))
        headLine('Statement ending balance', money(rec.statementBalance))
        headLine(bold('Difference'), <span className={`font-bold ${Math.round(d.difference * 100) === 0 ? 'text-emerald-600' : 'text-ember'}`}>{money(d.difference)}</span>)
        group('Uncleared transactions', d.unclearedPayments, d.unclearedDeposits)
        headLine(bold(`Register balance as of ${stDate}`), bold(money(d.registerAtStatement)))
        group('New transactions', d.afterPayments, d.afterDeposits)
        headLine(bold('Ending balance'), bold(money(d.registerToday)))
        return (
          <div>
            {picker}
            <div className="mb-4 rounded-lg border border-line bg-black/[0.02] px-4 py-3 text-xs dark:bg-white/[0.03]">
              <div className="font-bold text-[#2e75b6] dark:text-sky-300">{d.bank.name}{d.bank.code ? ` (${d.bank.code})` : ''}</div>
              <div className="mt-0.5 text-mist">
                Statement ending {stDate}
                {rec.periodStart ? ` · period ${dFmt(rec.periodStart)} – ${stDate}` : ''}
                {' · '}{rec.status === 'reconciled' ? `Reconciled${rec.finishedAt ? ` on ${dFmt(rec.finishedAt.slice(0, 10))}` : ''}` : 'In progress'}
              </div>
            </div>
            <T head={['Date', 'Type', 'Ref No.', 'Description', curTitle('Amount')]} right={[4]} rows={rows} />
          </div>
        )
      }
      case 'plpct': {
        const f = rf('plpct')
        const bar = filterBar('plpct', {
          dates: true,
          selects: [{ key: 'a', label: 'Basis', options: [{ value: 'accrual', label: 'Accrual' }, { value: 'cash', label: 'Cash' }] }],
        })
        const from = f.from || yearStart
        const to = f.to || todayIso
        const map = buildMap((d) => d >= from && d <= to, f.a || 'accrual')
        const totalInc = accounts.filter((a) => a.type === 'income').reduce((s, a) => s + bal(map, a.id), 0)
        const totalExp = accounts.filter((a) => a.type === 'expense').reduce((s, a) => s + bal(map, a.id), 0)
        const incAccounts = accounts.filter((a) => a.type === 'income' && keepAccountRowAt(frPrefs, 0.5, bal(map, a.id)))
        const expAccounts = accounts.filter((a) => a.type === 'expense' && keepAccountRowAt(frPrefs, 0.5, bal(map, a.id)))
        if (!incAccounts.length && !expAccounts.length) {
          return withFilters(bar, <Empty title="No income or expense activity" desc="Post receipts, payments or journals in this period to see the report." />)
        }
        const pct = (v: number) => (totalInc !== 0 ? `${((v / totalInc) * 100).toFixed(1)}%` : '—')
        const rows: ReactNode[][] = [[<b>INCOME</b>, '', '']]
        incAccounts.forEach((a) => rows.push([<span className="font-semibold">{a.name}</span>, formatGhs(bal(map, a.id)), pct(bal(map, a.id))]))
        rows.push([<b>Total Income</b>, <b>{formatGhs(totalInc)}</b>, <b>{pct(totalInc)}</b>])
        rows.push([<b>EXPENSES</b>, '', ''])
        expAccounts.forEach((a) => rows.push([<span className="font-semibold">{a.name}</span>, formatGhs(bal(map, a.id)), pct(bal(map, a.id))]))
        rows.push([<b>Total Expenses</b>, <b>{formatGhs(totalExp)}</b>, <b>{pct(totalExp)}</b>])
        const net = totalInc - totalExp
        rows.push([<b>Net Income (Profit or Loss)</b>, <b>{formatGhs(net)}</b>, <b>{pct(net)}</b>])
        return withFilters(bar, <T head={['Account', curTitle('Amount'), '% of Total Income']} right={[1, 2]} rows={rows} />)
      }
      case 'la': {
        // Liquidity dashboard — KPI cards, the standard ratio statement,
        // per-bank balances, a month-by-month trend and health alerts.
        const d = laModel
        const n = d.now
        const money = (v: number) => (v < 0 ? `(${formatGhsExact(Math.abs(v))})` : formatGhsExact(v))
        const ratioTxt = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} : 1`)
        const tone = (ok: boolean, warn: boolean) => (ok ? 'emerald' : warn ? 'amber' : 'rose')
        const toneCls: Record<string, string> = {
          emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
          zinc: 'border-line bg-black/[0.02] text-ink dark:bg-white/[0.03] dark:text-white',
        }
        const Kpi = ({ label, value, hint, t }: { label: string; value: string; hint?: string; t: string }) => (
          <div className={`rounded-lg border px-4 py-3 ${toneCls[t]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
            <div className="mt-1 text-lg font-extrabold tabular-nums">{value}</div>
            {hint ? <div className="mt-0.5 text-[11px] opacity-80">{hint}</div> : null}
          </div>
        )
        const ratioTone = (v: number | null, good: number, ok: number) =>
          v === null ? 'zinc' : v >= good ? 'emerald' : v >= ok ? 'amber' : 'rose'

        // Inline SVG line chart (no external chart library, prints cleanly).
        const Chart = ({ title, values, labels, fmt }: { title: string; values: number[]; labels: string[]; fmt: (v: number) => string }) => {
          const w = 520
          const h = 120
          const pad = 6
          const min = Math.min(0, ...values)
          const max = Math.max(1, ...values)
          const span = max - min || 1
          const x = (i: number) => (values.length <= 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1))
          const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2)
          const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          const zero = min < 0 ? y(0) : null
          return (
            <div className="rounded-lg border border-line p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-mist">{title}</div>
              <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full" role="img" aria-label={title}>
                {zero !== null && <line x1={pad} y1={zero} x2={w - pad} y2={zero} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />}
                <polyline points={pts} fill="none" stroke="#2e75b6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#2e75b6" />)}
              </svg>
              <div className="flex justify-between text-[10px] text-mist">
                {labels.map((l, i) => <span key={i}>{l}</span>)}
              </div>
              <div className="mt-1 text-[11px] text-mist">
                Latest <span className="font-semibold text-inherit">{fmt(values[values.length - 1] ?? 0)}</span>
                {values.length > 1 ? <> · from <span className="font-semibold text-inherit">{fmt(values[0])}</span></> : null}
              </div>
            </div>
          )
        }

        const monthLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })
        const labels = d.series.map((p) => monthLabel(p.date))
        const statement: ReactNode[][] = [
          [<b>CURRENT ASSETS</b>, ''],
          [<span className="pl-4">Cash on hand</span>, money(n.cash)],
          [<span className="pl-4">Bank accounts</span>, money(n.bank)],
          [<span className="pl-4">Accounts receivable</span>, money(n.receivables)],
          [<span className="pl-4">Inventory</span>, money(n.inventory)],
          [<span className="pl-4">Other current assets</span>, money(n.otherCA)],
          [<b className="pl-4">Total current assets</b>, <b>{money(n.currentAssets)}</b>],
          [<b>CURRENT LIABILITIES</b>, ''],
          [<span className="pl-4">Accounts payable</span>, money(n.payables)],
          [<span className="pl-4">Payroll liabilities</span>, money(n.payroll)],
          [<span className="pl-4">Taxes payable</span>, money(n.taxes)],
          [<span className="pl-4">Short-term loans</span>, money(n.loans)],
          [<span className="pl-4">Other current liabilities</span>, money(n.otherCL)],
          [<b className="pl-4">Total current liabilities</b>, <b>{money(n.currentLiabilities)}</b>],
          [<b>WORKING CAPITAL</b>, <b>{money(n.workingCapital)}</b>],
          [<b>LIQUIDITY RATIOS</b>, ''],
          [<span className="pl-4">Current ratio</span>, ratioTxt(n.currentRatio)],
          [<span className="pl-4">Quick ratio (acid test)</span>, ratioTxt(n.quickRatio)],
          [<span className="pl-4">Cash ratio</span>, ratioTxt(n.cashRatio)],
          [<b>NET LIQUIDITY POSITION</b>, <b>{money(n.netLiquidity)}</b>],
        ]
        const bankRows: ReactNode[][] = d.bankRows.map((b) => [
          <span className="font-semibold">{b.name}{b.code ? ` (${b.code})` : ''}</span>,
          b.number || '—',
          money(b.current),
          money(b.available),
        ])
        if (bankRows.length) bankRows.push([
          <b>Total bank balances</b>, '',
          <b>{money(d.bankRows.reduce((t, b) => t + b.current, 0))}</b>,
          <b>{money(d.bankRows.reduce((t, b) => t + b.available, 0))}</b>,
        ])
        const trendRows: ReactNode[][] = d.series.map((p) => [
          dFmt(p.date),
          money(p.liquid),
          p.currentRatio === null ? '—' : p.currentRatio.toFixed(2),
          p.quickRatio === null ? '—' : p.quickRatio.toFixed(2),
          money(p.workingCapital),
        ])

        return (
          <div>
            <div className="mb-5 flex w-full flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
              <div className="min-w-[160px] flex-1"><Field label="As at date">
                <DatePicker value={laAsOf} onChange={setLaAsOf} />
              </Field></div>
              <div className="min-w-[140px] flex-1"><Field label="Trend window">
                <Select value={laMonths} onChange={(e) => setLaMonths(e.target.value)}>
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                </Select>
              </Field></div>
              <button
                type="button"
                onClick={printLiquidity}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
              >
                <Printer className="size-4" /> Print
              </button>
            </div>

            {/* KPI cards */}
            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Cash on hand" value={money(n.cash)} t={n.cash < 0 ? 'rose' : 'emerald'} />
              <Kpi label="Bank balances" value={money(n.bank)} t={n.bank < 0 ? 'rose' : 'emerald'} />
              <Kpi label="Receivables" value={money(n.receivables)} t="zinc" />
              <Kpi label="Working capital" value={money(n.workingCapital)} t={n.workingCapital > 0 ? 'emerald' : n.workingCapital === 0 ? 'amber' : 'rose'} />
              <Kpi label="Current ratio" value={ratioTxt(n.currentRatio)} hint="CA ÷ CL" t={ratioTone(n.currentRatio, 2, 1)} />
              <Kpi label="Quick ratio" value={ratioTxt(n.quickRatio)} hint="(CA − inventory) ÷ CL" t={ratioTone(n.quickRatio, 1.5, 1)} />
              <Kpi label="Cash ratio" value={ratioTxt(n.cashRatio)} hint="(Cash + bank) ÷ CL" t={ratioTone(n.cashRatio, 1, 0.5)} />
              <Kpi label="Net liquidity" value={money(n.netLiquidity)} hint={`Status: ${d.status}`} t={n.netLiquidity > 0 ? 'emerald' : n.netLiquidity === 0 ? 'amber' : 'rose'} />
            </div>

            {/* Alerts */}
            {d.alerts.length > 0 && (
              <div className="mb-5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Alerts</div>
                <ul className="mt-1 list-disc pl-5 text-xs text-rose-700 dark:text-rose-300">
                  {d.alerts.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            <T head={['Liquidity Analysis', curTitle('Amount')]} right={[1]} rows={statement} />

            <div className="mt-4 rounded-lg border border-line bg-black/[0.02] px-4 py-3 text-xs dark:bg-white/[0.03]">
              <div className="font-bold text-[#2e75b6] dark:text-sky-300">Interpretation</div>
              <ul className="mt-1 list-disc pl-5 text-mist">
                {(d.interpretation.length ? d.interpretation : ['No current liabilities recorded at this date.']).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>

            {bankRows.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-bold text-ink dark:text-white">Bank accounts</h3>
                <T head={['Bank account', 'Account number', curTitle('Current balance'), curTitle('Available balance')]} right={[2, 3]} rows={bankRows} />
              </div>
            )}

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold text-ink dark:text-white">Trend analysis</h3>
              <div className="mb-3 grid gap-3 lg:grid-cols-2">
                <Chart title="Cash position" values={d.series.map((p) => p.liquid)} labels={labels} fmt={money} />
                <Chart title="Working capital" values={d.series.map((p) => p.workingCapital)} labels={labels} fmt={money} />
                <Chart title="Current ratio" values={d.series.map((p) => p.currentRatio ?? 0)} labels={labels} fmt={(v) => v.toFixed(2)} />
                <Chart title="Quick ratio" values={d.series.map((p) => p.quickRatio ?? 0)} labels={labels} fmt={(v) => v.toFixed(2)} />
              </div>
              <T head={['Month end', curTitle('Cash position'), 'Current ratio', 'Quick ratio', curTitle('Working capital')]} right={[1, 2, 3, 4]} rows={trendRows} />
            </div>
          </div>
        )
      }
      // ---------------------------------------------------------------- Sales tax
      case 'taxDetail':
      case 'taxSummary':
      case 'taxLiability': {
        // Tax is carried on invoices (sales) and purchases (input tax).
        const salesTax = app.invoices
          .filter((inv) => inv.status !== 'cancelled')
          .map((inv) => {
            const tax = inv.taxAmount ?? (inv.items || []).reduce((n, it) => n + (it.taxes || []).reduce((m, t) => m + (t.amount || 0), 0), 0)
            const net = (inv.total || 0) - tax
            return { date: inv.issuedAt?.slice(0, 10) || '', type: 'Invoice', no: inv.number, party: invoiceParty(inv), rate: inv.taxRate ?? null, name: inv.taxName || 'Sales tax', net, tax, kind: 'collected' as const }
          })
          .filter((r) => Math.abs(r.tax) >= 0.005)
        const inputTax = purchases
          .map((pu) => {
            const tax = (pu as { taxAmount?: number }).taxAmount ?? 0
            const net = (pu.total || 0) - tax
            return { date: pu.date || '', type: 'Bill', no: pu.number, party: suppliers.find((x) => x.id === pu.supplierId)?.name || '—', rate: (pu as { taxRate?: number }).taxRate ?? null, name: 'Input tax', net, tax, kind: 'paid' as const }
          })
          .filter((r) => Math.abs(r.tax) >= 0.005)
        const all = [...salesTax, ...inputTax].sort((a, b) => a.date.localeCompare(b.date))
        const collected = salesTax.reduce((n, r) => n + r.tax, 0)
        const paid = inputTax.reduce((n, r) => n + r.tax, 0)

        if (sel === 'taxDetail') {
          // Filters: date range, sales/purchases, a specific tax, free text.
          const taxNames = Array.from(new Set(all.map((r) => r.name))).sort((a, b) => a.localeCompare(b))
          const ql = txQuery.trim().toLowerCase()
          const shown = all.filter((r) =>
            (!txFrom || r.date >= txFrom)
            && (!txTo || r.date <= txTo)
            && (txType === 'all' || (txType === 'sales' ? r.kind === 'collected' : r.kind === 'paid'))
            && (!txTax || r.name === txTax)
            && (!ql || `${r.no} ${r.party} ${r.name} ${r.type}`.toLowerCase().includes(ql)))
          const filters = (
            <div className="mb-5 flex w-full flex-nowrap items-end gap-3 overflow-x-auto pb-1 print:hidden">
              <div className="min-w-[150px] flex-1"><Field label="From date">
                <DatePicker value={txFrom} onChange={setTxFrom} max={txTo || undefined} placeholder="Dated from" />
              </Field></div>
              <div className="min-w-[150px] flex-1"><Field label="To date">
                <DatePicker value={txTo} onChange={setTxTo} min={txFrom || undefined} placeholder="Dated to" />
              </Field></div>
              <div className="min-w-[140px] flex-1"><Field label="Transaction type">
                <Select value={txType} onChange={(e) => setTxType(e.target.value)}>
                  <option value="all">All transactions</option>
                  <option value="sales">Sales (tax collected)</option>
                  <option value="purchases">Purchases (input tax)</option>
                </Select>
              </Field></div>
              <div className="min-w-[130px] flex-1"><Field label="Tax">
                <Select value={txTax} onChange={(e) => setTxTax(e.target.value)} placeholder="All taxes">
                  <option value="">All taxes</option>
                  {taxNames.map((t2) => <option key={t2} value={t2}>{t2}</option>)}
                </Select>
              </Field></div>
              <div className="min-w-[170px] flex-1"><Field label="Search">
                <SearchField value={txQuery} onChange={setTxQuery} placeholder="No., name or type…" />
              </Field></div>
              <button
                type="button"
                onClick={() => { setTxFrom(''); setTxTo(''); setTxType('all'); setTxTax(''); setTxQuery('') }}
                className="mb-1 inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-mist transition hover:text-inherit"
              >
                Clear
              </button>
            </div>
          )
          if (!all.length) {
            return (
              <div>
                {filters}
                <Empty title="No tax transactions" desc="Invoices or bills carrying tax appear here." />
              </div>
            )
          }
          if (!shown.length) {
            return (
              <div>
                {filters}
                <Empty title="No tax transactions match the filters" desc="Widen the date range, change the transaction type or clear the search." />
              </div>
            )
          }
          const rows: ReactNode[][] = shown.map((r) => [
            dFmt(r.date), r.type, r.no, r.party, r.name,
            r.rate === null ? '—' : `${r.rate}%`,
            formatGhs(r.net), formatGhs(r.tax),
          ])
          rows.push(['', '', '', '', <b>Total</b>, '', <b>{formatGhs(shown.reduce((n, r) => n + r.net, 0))}</b>, <b>{formatGhs(shown.reduce((n, r) => n + r.tax, 0))}</b>])
          return (
            <div>
              {filters}
              <T head={['Date', 'Type', 'No.', 'Name', 'Tax', 'Rate', curTitle('Net amount'), curTitle('Tax amount')]} right={[5, 6, 7]} rows={rows} />
            </div>
          )
        }

        if (sel === 'taxSummary') {
          const bar = filterBar('taxSummary', {
            dates: true,
            selects: [{ key: 'a', label: 'Transaction type', options: [{ value: '', label: 'All transactions' }, { value: 'sales', label: 'Sales (tax collected)' }, { value: 'purchases', label: 'Purchases (input tax)' }] }],
          })
          const fa = rf('taxSummary')
          const scoped = all.filter((r) => inRf('taxSummary', r.date)
            && (!fa.a || (fa.a === 'sales' ? r.kind === 'collected' : r.kind === 'paid')))
          const byBox = new Map<string, { net: number; tax: number; count: number }>()
          for (const r of scoped) {
            const key = `${r.kind === 'collected' ? 'Tax on sales' : 'Tax on purchases'} — ${r.name}${r.rate === null ? '' : ` (${r.rate}%)`}`
            const e = byBox.get(key) ?? { net: 0, tax: 0, count: 0 }
            e.net += r.net; e.tax += r.tax; e.count += 1
            byBox.set(key, e)
          }
          if (!byBox.size) return withFilters(bar, <Empty title="No tax transactions" desc="Invoices or bills carrying tax appear here for the selected filters." />)
          const rows: ReactNode[][] = [...byBox.entries()].map(([box, e]) => [
            <span className="font-semibold">{box}</span>, String(e.count), formatGhs(e.net), formatGhs(e.tax),
          ])
          const sCollected = scoped.filter((r) => r.kind === 'collected').reduce((n, r) => n + r.tax, 0)
          const sPaid = scoped.filter((r) => r.kind === 'paid').reduce((n, r) => n + r.tax, 0)
          rows.push([<b>Net tax due</b>, '', '', <b>{formatGhs(sCollected - sPaid)}</b>])
          return withFilters(bar, <T head={['Box', 'Transactions', curTitle('Net amount'), curTitle('Tax amount')]} right={[1, 2, 3]} rows={rows} />)
        }

        // Tax Liability
        const liabBar = filterBar('taxLiability', { dates: true })
        const liabScoped = all.filter((r) => inRf('taxLiability', r.date))
        const lCollected = liabScoped.filter((r) => r.kind === 'collected').reduce((n, r) => n + r.tax, 0)
        const lPaid = liabScoped.filter((r) => r.kind === 'paid').reduce((n, r) => n + r.tax, 0)
        void collected; void paid
        const rows: ReactNode[][] = [
          ['Tax collected on sales', formatGhs(lCollected)],
          ['Tax paid on purchases (input tax)', formatGhs(lPaid)],
          [<b>Net tax owed to tax agencies</b>, <b>{formatGhs(lCollected - lPaid)}</b>],
        ]
        return (
          <div>
            {liabBar}
            <T head={['Tax position', curTitle('Amount')]} right={[1]} rows={rows} />
            <div className="mt-3 text-xs text-mist">Based on accrual accounting: invoices raised and bills received, whether or not they have been settled.</div>
          </div>
        )
      }

      // ------------------------------------------------------------ Who owes you
      case 'arAgingSummary':
      case 'arAgingDetail': {
        const barId = sel
        const bar = filterBar(barId, { asOf: true, search: 'Customer or invoice…' })
        const asOf = rf(barId).to || todayIso
        const ql = (rf(barId).q || '').trim().toLowerCase()
        const openInv = app.invoices
          .filter((inv) => inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue')
          .filter((inv) => (inv.issuedAt || '').slice(0, 10) <= asOf)
          .filter((inv) => !ql || `${inv.number} ${invoiceParty(inv)}`.toLowerCase().includes(ql))
        if (!openInv.length) return withFilters(bar, <Empty title="No unpaid invoices" desc="Outstanding customer balances appear here." />)
        const daysPast = (due: string) => Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${(due || asOf).slice(0, 10)}T00:00:00`).getTime()) / 86400000)
        const bucketOf = (d: number) => (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4)
        const BUCKETS = ['Current', '1 – 30', '31 – 60', '61 – 90', '91 and over']
        const paidOf = (inv: typeof openInv[number]) =>
          app.payments.filter((pm) => pm.invoiceId === inv.id).reduce((n, pm) => n + (pm.amount || 0), 0)
        const open = openInv.map((inv) => {
          const bal = (inv.total || 0) - paidOf(inv)
          const d = daysPast(inv.dueAt)
          return { inv, bal, days: d, bucket: bucketOf(d), name: invoiceParty(inv) }
        }).filter((r) => Math.abs(r.bal) >= 0.005)

        if (sel === 'arAgingSummary') {
          const byCust = new Map<string, number[]>()
          for (const r of open) {
            const arr = byCust.get(r.name) ?? [0, 0, 0, 0, 0]
            arr[r.bucket] += r.bal
            byCust.set(r.name, arr)
          }
          const rows: ReactNode[][] = [...byCust.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, arr]) => [
            <span className="font-semibold">{name}</span>,
            ...arr.map((v) => formatGhs(v)),
            <b>{formatGhs(arr.reduce((n, v) => n + v, 0))}</b>,
          ])
          const totals = [0, 1, 2, 3, 4].map((i) => open.filter((r) => r.bucket === i).reduce((n, r) => n + r.bal, 0))
          rows.push([<b>Total</b>, ...totals.map((v) => <b>{formatGhs(v)}</b>), <b>{formatGhs(totals.reduce((n, v) => n + v, 0))}</b>])
          return withFilters(bar, <T head={['Customer', ...BUCKETS, curTitle('Total')]} right={[1, 2, 3, 4, 5, 6]} rows={rows} />)
        }

        const rows: ReactNode[][] = []
        for (let i = 0; i < BUCKETS.length; i++) {
          const inB = open.filter((r) => r.bucket === i).sort((a, b) => (a.inv.dueAt || '').localeCompare(b.inv.dueAt || ''))
          if (!inB.length) continue
          rows.push([<b className="uppercase">{BUCKETS[i]}</b>, '', '', '', '', ''])
          for (const r of inB) {
            rows.push([
              <span className="pl-4">{dFmt((r.inv.issuedAt || '').slice(0, 10))}</span>,
              r.inv.number, r.name, dFmt((r.inv.dueAt || '').slice(0, 10)),
              r.days > 0 ? String(r.days) : '—',
              formatGhs(r.bal),
            ])
          }
          rows.push([<b className="pl-4">{`Total ${BUCKETS[i]}`}</b>, '', '', '', '', <b>{formatGhs(inB.reduce((n, r) => n + r.bal, 0))}</b>])
        }
        rows.push([<b>Total outstanding</b>, '', '', '', '', <b>{formatGhs(open.reduce((n, r) => n + r.bal, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Invoice', 'Customer', 'Due date', 'Days past due', curTitle('Open balance')]} right={[4, 5]} rows={rows} />)
      }

      // --------------------------------------------------- Sales and customers
      case 'depositDetail': {
        const depAccounts = Array.from(new Set(live.receipts.map((r) => r.depositAccountId)))
        const methods = Array.from(new Set(live.receipts.map((r) => r.method).filter(Boolean))) as string[]
        const bar = filterBar('depositDetail', {
          dates: true,
          selects: [
            { key: 'a', label: 'Deposited to', options: [{ value: '', label: 'All accounts' }, ...depAccounts.map((id) => ({ value: id, label: accountName(accounts, id) }))] },
            { key: 'b', label: 'Method', options: [{ value: '', label: 'All methods' }, ...methods.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))] },
          ],
          search: 'Number, payer or note…',
        })
        const f = rf('depositDetail')
        const ql = (f.q || '').trim().toLowerCase()
        const scoped = live.receipts.filter((r) => inRf('depositDetail', r.date)
          && (!f.a || r.depositAccountId === f.a)
          && (!f.b || r.method === f.b)
          && (!ql || `${r.number} ${r.receivedFrom || ''} ${r.description || ''}`.toLowerCase().includes(ql)))
        const rows: ReactNode[][] = scoped
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => [
            dFmt(r.date), r.number,
            accountName(accounts, r.depositAccountId),
            r.receivedFrom || '—',
            r.method ? r.method.charAt(0).toUpperCase() + r.method.slice(1) : '—',
            r.description || '—',
            formatGhs(r.amount),
          ])
        if (!rows.length) return withFilters(bar, <Empty title="No deposits" desc="Posted receipts appear here with the account they were banked to." />)
        rows.push(['', '', '', '', '', <b>Total</b>, <b>{formatGhs(scoped.reduce((n, r) => n + r.amount, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'No.', 'Deposited to', 'Received from', 'Method', 'Description', curTitle('Amount')]} right={[6]} rows={rows} />)
      }

      case 'incomeByCustomer': {
        const bar = filterBar('incomeByCustomer', { dates: true, search: 'Customer…' })
        const ql = (rf('incomeByCustomer').q || '').trim().toLowerCase()
        const map = new Map<string, { income: number; expense: number }>()
        const bucket = (name: string) => {
          const e = map.get(name) ?? { income: 0, expense: 0 }
          map.set(name, e)
          return e
        }
        for (const r of live.receipts) if ((r.stakeholderClass === 'customer' || !r.stakeholderClass) && inRf('incomeByCustomer', r.date)) {
          bucket(r.receivedFrom || '—').income += r.amount
        }
        for (const pv of live.payments) if (pv.stakeholderClass === 'customer' && inRf('incomeByCustomer', pv.date)) {
          bucket(pv.paidTo || '—').expense += pv.amount
        }
        for (const inv of app.invoices) if (inv.status !== 'cancelled') {
          bucket(invoiceParty(inv)).income += 0 // invoices are recognised through their receipts
        }
        const rows: ReactNode[][] = [...map.entries()]
          .filter(([name, e]) => (Math.abs(e.income) >= 0.005 || Math.abs(e.expense) >= 0.005) && (!ql || name.toLowerCase().includes(ql)))
          .sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense))
          .map(([name, e]) => [
            <span className="font-semibold">{name}</span>,
            formatGhs(e.income), formatGhs(e.expense),
            <span className={`font-semibold ${e.income - e.expense < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatGhs(e.income - e.expense)}</span>,
          ])
        if (!rows.length) return withFilters(bar, <Empty title="No customer activity" desc="Receipts and payments tagged to customers appear here." />)
        const shownNames = new Set([...map.keys()].filter((n2) => !ql || n2.toLowerCase().includes(ql)))
        const tInc = [...map.entries()].filter(([n2]) => shownNames.has(n2)).reduce((n2, [, e]) => n2 + e.income, 0)
        const tExp = [...map.entries()].filter(([n2]) => shownNames.has(n2)).reduce((n2, [, e]) => n2 + e.expense, 0)
        rows.push([<b>Total</b>, <b>{formatGhs(tInc)}</b>, <b>{formatGhs(tExp)}</b>, <b>{formatGhs(tInc - tExp)}</b>])
        return withFilters(bar, <T head={['Customer', curTitle('Income'), curTitle('Expenses'), curTitle('Net income')]} right={[1, 2, 3]} rows={rows} />)
      }

      // ----------------------------------------------------------- What you owe
      case 'apAgingSummary':
      case 'apAgingDetail': {
        const barId = sel
        const bar = filterBar(barId, { asOf: true, search: 'Supplier or bill…' })
        const asOf = rf(barId).to || todayIso
        const ql = (rf(barId).q || '').trim().toLowerCase()
        const openBills = purchases
          .filter((pu) => pu.status !== 'paid')
          .filter((pu) => (pu.date || '').slice(0, 10) <= asOf)
          .filter((pu) => !ql || `${pu.number} ${suppliers.find((x) => x.id === pu.supplierId)?.name || ''}`.toLowerCase().includes(ql))
        if (!openBills.length) return withFilters(bar, <Empty title="No unpaid bills" desc="Outstanding supplier balances appear here." />)
        const daysPast = (d: string) => Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${(d || asOf).slice(0, 10)}T00:00:00`).getTime()) / 86400000)
        const bucketOf = (d: number) => (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4)
        const BUCKETS = ['Current', '1 – 30', '31 – 60', '61 – 90', '91 and over']
        const open = openBills.map((pu) => {
          const d = daysPast(pu.date)
          return { pu, bal: pu.total || 0, days: d, bucket: bucketOf(d), name: suppliers.find((x) => x.id === pu.supplierId)?.name || '—' }
        }).filter((r) => Math.abs(r.bal) >= 0.005)

        if (sel === 'apAgingSummary') {
          const bySup = new Map<string, number[]>()
          for (const r of open) {
            const arr = bySup.get(r.name) ?? [0, 0, 0, 0, 0]
            arr[r.bucket] += r.bal
            bySup.set(r.name, arr)
          }
          const rows: ReactNode[][] = [...bySup.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, arr]) => [
            <span className="font-semibold">{name}</span>,
            ...arr.map((v) => formatGhs(v)),
            <b>{formatGhs(arr.reduce((n, v) => n + v, 0))}</b>,
          ])
          const totals = [0, 1, 2, 3, 4].map((i) => open.filter((r) => r.bucket === i).reduce((n, r) => n + r.bal, 0))
          rows.push([<b>Total</b>, ...totals.map((v) => <b>{formatGhs(v)}</b>), <b>{formatGhs(totals.reduce((n, v) => n + v, 0))}</b>])
          return withFilters(bar, <T head={['Supplier', ...BUCKETS, curTitle('Total')]} right={[1, 2, 3, 4, 5, 6]} rows={rows} />)
        }

        const rows: ReactNode[][] = []
        for (let i = 0; i < BUCKETS.length; i++) {
          const inB = open.filter((r) => r.bucket === i).sort((a, b) => (a.pu.date || '').localeCompare(b.pu.date || ''))
          if (!inB.length) continue
          rows.push([<b className="uppercase">{BUCKETS[i]}</b>, '', '', '', '', ''])
          for (const r of inB) {
            rows.push([
              <span className="pl-4">{dFmt(r.pu.date)}</span>,
              r.pu.number, r.name,
              r.pu.status === 'ordered' ? 'Ordered' : 'Received',
              r.days > 0 ? String(r.days) : '—',
              formatGhs(r.bal),
            ])
          }
          rows.push([<b className="pl-4">{`Total ${BUCKETS[i]}`}</b>, '', '', '', '', <b>{formatGhs(inB.reduce((n, r) => n + r.bal, 0))}</b>])
        }
        rows.push([<b>Total outstanding</b>, '', '', '', '', <b>{formatGhs(open.reduce((n, r) => n + r.bal, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Bill', 'Supplier', 'Status', 'Days past due', curTitle('Open balance')]} right={[4, 5]} rows={rows} />)
      }

      // --------------------------------------------------- Expenses and suppliers
      case 'chequeDetail': {
        const bankIds = Array.from(new Set(cheques.filter((c) => c.direction === 'issued').map((c) => c.bankAccountId)))
        const statuses = Array.from(new Set(cheques.filter((c) => c.direction === 'issued').map((c) => c.status)))
        const bar = filterBar('chequeDetail', {
          dates: true,
          selects: [
            { key: 'a', label: 'Bank account', options: [{ value: '', label: 'All bank accounts' }, ...bankIds.map((id) => ({ value: id, label: banks.find((b2) => b2.id === id)?.name || id }))] },
            { key: 'b', label: 'Status', options: [{ value: '', label: 'All statuses' }, ...statuses.map((st) => ({ value: st, label: st.charAt(0).toUpperCase() + st.slice(1) }))] },
          ],
          search: 'Cheque no., payee or reference…',
        })
        const f = rf('chequeDetail')
        const ql = (f.q || '').trim().toLowerCase()
        const issued = cheques.filter((c) => c.direction === 'issued'
          && inRf('chequeDetail', c.date)
          && (!f.a || c.bankAccountId === f.a)
          && (!f.b || c.status === f.b)
          && (!ql || `${c.number} ${c.party || ''} ${c.referenceNo || ''}`.toLowerCase().includes(ql)))
        if (!issued.length) return withFilters(bar, <Empty title="No cheques written" desc="Cheques issued from the cheque register appear here." />)
        const rows: ReactNode[][] = issued
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((c) => [
            dFmt(c.date), c.number,
            banks.find((b) => b.id === c.bankAccountId)?.name ?? '—',
            c.party || '—',
            c.referenceNo || '—',
            c.clearedDate ? dFmt(c.clearedDate) : '—',
            <Badge tone={c.status === 'cleared' ? 'lime' : c.status === 'issued' ? 'amber' : 'rose'}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Badge>,
            formatGhs(c.amount),
          ])
        rows.push(['', '', '', '', '', '', <b>Total</b>, <b>{formatGhs(issued.reduce((n, c) => n + c.amount, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Cheque no.', 'Bank account', 'Payee', 'Reference', 'Cleared', 'Status', curTitle('Amount')]} right={[7]} rows={rows} />)
      }

      // ------------------------------------------------- Who owes you (extra)
      case 'openInvoices': {
        const bar = filterBar('openInvoices', { asOf: true, search: 'Customer or invoice…' })
        const asOf = rf('openInvoices').to || todayIso
        const ql = (rf('openInvoices').q || '').trim().toLowerCase()
        const paidOf = (id: string) => app.payments.filter((pm) => pm.invoiceId === id).reduce((n, pm) => n + (pm.amount || 0), 0)
        const open = app.invoices
          .filter((inv) => inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue')
          .filter((inv) => (inv.issuedAt || '').slice(0, 10) <= asOf)
          .filter((inv) => !ql || `${inv.number} ${invoiceParty(inv)}`.toLowerCase().includes(ql))
          .map((inv) => ({ inv, bal: (inv.total || 0) - paidOf(inv.id) }))
          .filter((r) => Math.abs(r.bal) >= 0.005)
          .sort((a, b) => (a.inv.dueAt || '').localeCompare(b.inv.dueAt || ''))
        if (!open.length) return withFilters(bar, <Empty title="No open invoices" desc="Unpaid customer invoices appear here." />)
        const days = (due: string) => Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${(due || asOf).slice(0, 10)}T00:00:00`).getTime()) / 86400000)
        const rows: ReactNode[][] = open.map((r) => [
          dFmt((r.inv.issuedAt || '').slice(0, 10)), r.inv.number,
          <span className="font-semibold">{invoiceParty(r.inv)}</span>,
          dFmt((r.inv.dueAt || '').slice(0, 10)),
          days(r.inv.dueAt) > 0 ? <span className="font-semibold text-rose-600">{days(r.inv.dueAt)}</span> : '—',
          formatGhs(r.inv.total || 0), formatGhs(r.bal),
        ])
        rows.push(['', '', '', '', <b>Total</b>, <b>{formatGhs(open.reduce((n, r) => n + (r.inv.total || 0), 0))}</b>, <b>{formatGhs(open.reduce((n, r) => n + r.bal, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Invoice', 'Customer', 'Due date', 'Days overdue', curTitle('Amount'), curTitle('Open balance')]} right={[4, 5, 6]} rows={rows} />)
      }

      case 'customerBalance': {
        const bar = filterBar('customerBalance', { asOf: true, search: 'Customer…' })
        const asOf = rf('customerBalance').to || todayIso
        const ql = (rf('customerBalance').q || '').trim().toLowerCase()
        const paidOf = (id: string) => app.payments.filter((pm) => pm.invoiceId === id).reduce((n, pm) => n + (pm.amount || 0), 0)
        const map = new Map<string, number>()
        for (const inv of app.invoices) {
          if (inv.status === 'paid' || inv.status === 'cancelled') continue
          if ((inv.issuedAt || '').slice(0, 10) > asOf) continue
          const name = invoiceParty(inv)
          if (ql && !name.toLowerCase().includes(ql)) continue
          map.set(name, (map.get(name) ?? 0) + (inv.total || 0) - paidOf(inv.id))
        }
        const list = [...map.entries()].filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1])
        if (!list.length) return withFilters(bar, <Empty title="No customer balances" desc="Customers with an outstanding balance appear here." />)
        const rows: ReactNode[][] = list.map(([name, v]) => [<span className="font-semibold">{name}</span>, formatGhs(v)])
        rows.push([<b>Total</b>, <b>{formatGhs(list.reduce((n, [, v]) => n + v, 0))}</b>])
        return withFilters(bar, <T head={['Customer', curTitle('Balance')]} right={[1]} rows={rows} />)
      }

      case 'collections': {
        const bar = filterBar('collections', { asOf: true, search: 'Customer…' })
        const asOf = rf('collections').to || todayIso
        const ql = (rf('collections').q || '').trim().toLowerCase()
        const paidOf = (id: string) => app.payments.filter((pm) => pm.invoiceId === id).reduce((n, pm) => n + (pm.amount || 0), 0)
        const contact = (name: string) => customers.find((c) => c.name === name)
        const overdue = app.invoices
          .filter((inv) => (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue'))
          .filter((inv) => (inv.dueAt || '').slice(0, 10) < asOf)
          .filter((inv) => !ql || invoiceParty(inv).toLowerCase().includes(ql))
          .map((inv) => ({ inv, bal: (inv.total || 0) - paidOf(inv.id) }))
          .filter((r) => Math.abs(r.bal) >= 0.005)
          .sort((a, b) => (a.inv.dueAt || '').localeCompare(b.inv.dueAt || ''))
        if (!overdue.length) return withFilters(bar, <Empty title="Nothing to collect" desc="Overdue invoices appear here with the customer's contact details." />)
        const days = (due: string) => Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${(due || asOf).slice(0, 10)}T00:00:00`).getTime()) / 86400000)
        const rows: ReactNode[][] = overdue.map((r) => {
          const c = contact(invoiceParty(r.inv))
          return [
            <span className="font-semibold">{invoiceParty(r.inv)}</span>,
            c?.phone || '—', c?.email || '—',
            r.inv.number, dFmt((r.inv.dueAt || '').slice(0, 10)),
            <span className="font-semibold text-rose-600">{days(r.inv.dueAt)}</span>,
            formatGhs(r.bal),
          ]
        })
        rows.push(['', '', '', '', '', <b>Total</b>, <b>{formatGhs(overdue.reduce((n, r) => n + r.bal, 0))}</b>])
        return withFilters(bar, <T head={['Customer', 'Phone', 'Email', 'Invoice', 'Due date', 'Days overdue', curTitle('Open balance')]} right={[5, 6]} rows={rows} />)
      }

      // ------------------------------------------- Sales and customers (extra)
      case 'salesByCustomer': {
        const bar = filterBar('salesByCustomer', { dates: true, search: 'Customer…' })
        const ql = (rf('salesByCustomer').q || '').trim().toLowerCase()
        const map = new Map<string, { count: number; total: number }>()
        for (const inv of app.invoices) {
          if (inv.status === 'cancelled') continue
          const d = (inv.issuedAt || '').slice(0, 10)
          if (!inRf('salesByCustomer', d)) continue
          const name = invoiceParty(inv)
          if (ql && !name.toLowerCase().includes(ql)) continue
          const e = map.get(name) ?? { count: 0, total: 0 }
          e.count += 1
          e.total += inv.total || 0
          map.set(name, e)
        }
        const list = [...map.entries()].sort((a, b) => b[1].total - a[1].total)
        if (!list.length) return withFilters(bar, <Empty title="No sales in this period" desc="Invoices raised to customers appear here." />)
        const rows: ReactNode[][] = list.map(([name, e]) => [<span className="font-semibold">{name}</span>, String(e.count), formatGhs(e.total)])
        rows.push([<b>Total</b>, <b>{list.reduce((n, [, e]) => n + e.count, 0)}</b>, <b>{formatGhs(list.reduce((n, [, e]) => n + e.total, 0))}</b>])
        return withFilters(bar, <T head={['Customer', 'Invoices', curTitle('Sales')]} right={[1, 2]} rows={rows} />)
      }

      case 'txnByCustomer': {
        const bar = filterBar('txnByCustomer', { dates: true, search: 'Customer…' })
        const ql = (rf('txnByCustomer').q || '').trim().toLowerCase()
        type Txn = { name: string; date: string; type: string; no: string; memo: string; amount: number }
        const txns: Txn[] = [
          ...app.invoices.filter((inv) => inv.status !== 'cancelled' && inRf('txnByCustomer', (inv.issuedAt || '').slice(0, 10)))
            .map((inv) => ({ name: invoiceParty(inv), date: (inv.issuedAt || '').slice(0, 10), type: 'Invoice', no: inv.number, memo: (inv.items || [])[0]?.desc || '—', amount: inv.total || 0 })),
          ...live.receipts.filter((r) => (r.stakeholderClass === 'customer' || !r.stakeholderClass) && inRf('txnByCustomer', r.date))
            .map((r) => ({ name: r.receivedFrom || '—', date: r.date, type: 'Receipt', no: r.number, memo: r.description || '—', amount: -r.amount })),
        ].filter((t2) => !ql || t2.name.toLowerCase().includes(ql))
        if (!txns.length) return withFilters(bar, <Empty title="No customer transactions" desc="Invoices and receipts for customers appear here." />)
        const byName = new Map<string, Txn[]>()
        for (const t2 of txns) byName.set(t2.name, [...(byName.get(t2.name) ?? []), t2])
        const rows: ReactNode[][] = []
        for (const [name, list] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          rows.push([<b className="uppercase">{name}</b>, '', '', '', ''])
          for (const t2 of list.sort((a, b) => a.date.localeCompare(b.date))) {
            rows.push([<span className="pl-4">{dFmt(t2.date)}</span>, t2.type, t2.no, t2.memo, formatGhs(t2.amount)])
          }
          rows.push([<b className="pl-4">{`Total ${name}`}</b>, '', '', '', <b>{formatGhs(list.reduce((n, t2) => n + t2.amount, 0))}</b>])
        }
        return withFilters(bar, <T head={['Date', 'Type', 'No.', 'Memo', curTitle('Amount')]} right={[4]} rows={rows} />)
      }

      case 'customerList': {
        const bar = filterBar('customerList', { search: 'Name, phone or email…' })
        const ql = (rf('customerList').q || '').trim().toLowerCase()
        const list = customers.filter((c) => !ql || `${c.name} ${c.email} ${c.phone} ${c.company || ''}`.toLowerCase().includes(ql))
        if (!list.length) return withFilters(bar, <Empty title="No customers" desc="Customers added under Sales → Customers appear here." />)
        const rows: ReactNode[][] = list.map((c) => [
          <span className="font-semibold">{c.name}</span>, c.company || '—', c.phone || '—', c.email || '—',
          c.address || '—', c.category || '—',
          <Badge tone={c.status === 'active' ? 'lime' : 'zinc'}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Badge>,
        ])
        return withFilters(bar, <T head={['Customer', 'Company', 'Phone', 'Email', 'Address', 'Category', 'Status']} rows={rows} />)
      }

      // ------------------------------------------------ What you owe (extra)
      case 'unpaidBills': {
        const bar = filterBar('unpaidBills', { asOf: true, search: 'Supplier or bill…' })
        const asOf = rf('unpaidBills').to || todayIso
        const ql = (rf('unpaidBills').q || '').trim().toLowerCase()
        const nameOf = (id: string) => suppliers.find((x) => x.id === id)?.name || '—'
        const open = purchases
          .filter((pu) => pu.status !== 'paid' && (pu.date || '').slice(0, 10) <= asOf)
          .filter((pu) => !ql || `${pu.number} ${nameOf(pu.supplierId)}`.toLowerCase().includes(ql))
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        if (!open.length) return withFilters(bar, <Empty title="No unpaid bills" desc="Bills you still owe appear here." />)
        const days = (d: string) => Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${(d || asOf).slice(0, 10)}T00:00:00`).getTime()) / 86400000)
        const rows: ReactNode[][] = open.map((pu) => [
          dFmt(pu.date), pu.number, <span className="font-semibold">{nameOf(pu.supplierId)}</span>,
          pu.status === 'ordered' ? 'Ordered' : 'Received',
          days(pu.date) > 0 ? String(days(pu.date)) : '—',
          formatGhs(pu.total || 0),
        ])
        rows.push(['', '', '', '', <b>Total</b>, <b>{formatGhs(open.reduce((n, pu) => n + (pu.total || 0), 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Bill', 'Supplier', 'Status', 'Days outstanding', curTitle('Open balance')]} right={[4, 5]} rows={rows} />)
      }

      case 'supplierBalance': {
        const bar = filterBar('supplierBalance', { asOf: true, search: 'Supplier…' })
        const asOf = rf('supplierBalance').to || todayIso
        const ql = (rf('supplierBalance').q || '').trim().toLowerCase()
        const map = new Map<string, number>()
        for (const pu of purchases) {
          if (pu.status === 'paid' || (pu.date || '').slice(0, 10) > asOf) continue
          const name = suppliers.find((x) => x.id === pu.supplierId)?.name || '—'
          if (ql && !name.toLowerCase().includes(ql)) continue
          map.set(name, (map.get(name) ?? 0) + (pu.total || 0))
        }
        const list = [...map.entries()].filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1])
        if (!list.length) return withFilters(bar, <Empty title="No supplier balances" desc="Suppliers you owe appear here." />)
        const rows: ReactNode[][] = list.map(([name, v]) => [<span className="font-semibold">{name}</span>, formatGhs(v)])
        rows.push([<b>Total</b>, <b>{formatGhs(list.reduce((n, [, v]) => n + v, 0))}</b>])
        return withFilters(bar, <T head={['Supplier', curTitle('Balance')]} right={[1]} rows={rows} />)
      }

      // ------------------------------------- Expenses and suppliers (extra)
      case 'expensesBySupplier': {
        const bar = filterBar('expensesBySupplier', { dates: true, search: 'Supplier…' })
        const ql = (rf('expensesBySupplier').q || '').trim().toLowerCase()
        const map = new Map<string, { count: number; total: number }>()
        const add = (name: string, amount: number) => {
          if (ql && !name.toLowerCase().includes(ql)) return
          const e = map.get(name) ?? { count: 0, total: 0 }
          e.count += 1
          e.total += amount
          map.set(name, e)
        }
        for (const pu of purchases) if (inRf('expensesBySupplier', pu.date)) add(suppliers.find((x) => x.id === pu.supplierId)?.name || '—', pu.total || 0)
        for (const pv of live.payments) if (pv.stakeholderClass === 'supplier' && inRf('expensesBySupplier', pv.date)) add(pv.paidTo || '—', pv.amount)
        const list = [...map.entries()].sort((a, b) => b[1].total - a[1].total)
        if (!list.length) return withFilters(bar, <Empty title="No supplier spend in this period" desc="Bills and supplier payments appear here." />)
        const rows: ReactNode[][] = list.map(([name, e]) => [<span className="font-semibold">{name}</span>, String(e.count), formatGhs(e.total)])
        rows.push([<b>Total</b>, <b>{list.reduce((n, [, e]) => n + e.count, 0)}</b>, <b>{formatGhs(list.reduce((n, [, e]) => n + e.total, 0))}</b>])
        return withFilters(bar, <T head={['Supplier', 'Transactions', curTitle('Total spend')]} right={[1, 2]} rows={rows} />)
      }

      case 'txnBySupplier': {
        const bar = filterBar('txnBySupplier', { dates: true, search: 'Supplier…' })
        const ql = (rf('txnBySupplier').q || '').trim().toLowerCase()
        type Txn = { name: string; date: string; type: string; no: string; memo: string; amount: number }
        const txns: Txn[] = [
          ...purchases.filter((pu) => inRf('txnBySupplier', pu.date)).map((pu) => ({
            name: suppliers.find((x) => x.id === pu.supplierId)?.name || '—', date: pu.date, type: 'Bill', no: pu.number,
            memo: pu.notes || pu.referenceNo || '—', amount: pu.total || 0,
          })),
          ...live.payments.filter((pv) => pv.stakeholderClass === 'supplier' && inRf('txnBySupplier', pv.date)).map((pv) => ({
            name: pv.paidTo || '—', date: pv.date, type: 'Payment', no: pv.number, memo: pv.description || '—', amount: -pv.amount,
          })),
        ].filter((t2) => !ql || t2.name.toLowerCase().includes(ql))
        if (!txns.length) return withFilters(bar, <Empty title="No supplier transactions" desc="Bills and payments to suppliers appear here." />)
        const byName = new Map<string, Txn[]>()
        for (const t2 of txns) byName.set(t2.name, [...(byName.get(t2.name) ?? []), t2])
        const rows: ReactNode[][] = []
        for (const [name, list] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          rows.push([<b className="uppercase">{name}</b>, '', '', '', ''])
          for (const t2 of list.sort((a, b) => a.date.localeCompare(b.date))) {
            rows.push([<span className="pl-4">{dFmt(t2.date)}</span>, t2.type, t2.no, t2.memo, formatGhs(t2.amount)])
          }
          rows.push([<b className="pl-4">{`Total ${name}`}</b>, '', '', '', <b>{formatGhs(list.reduce((n, t2) => n + t2.amount, 0))}</b>])
        }
        return withFilters(bar, <T head={['Date', 'Type', 'No.', 'Memo', curTitle('Amount')]} right={[4]} rows={rows} />)
      }

      case 'supplierList': {
        const bar = filterBar('supplierList', { search: 'Name, contact or email…' })
        const ql = (rf('supplierList').q || '').trim().toLowerCase()
        const list = suppliers.filter((sp) => !ql || `${sp.name} ${sp.contact} ${sp.email} ${sp.phone}`.toLowerCase().includes(ql))
        if (!list.length) return withFilters(bar, <Empty title="No suppliers" desc="Suppliers added under Purchases → Suppliers appear here." />)
        const rows: ReactNode[][] = list.map((sp) => [
          <span className="font-semibold">{sp.name}</span>, sp.contact || '—', sp.phone || '—', sp.email || '—', sp.category || '—',
        ])
        return withFilters(bar, <T head={['Supplier', 'Contact person', 'Phone', 'Email', 'Category']} rows={rows} />)
      }

      // --------------------------------------------------- For my accountant
      case 'txnDetailByAccount': {
        const bar = filterBar('txnDetailByAccount', { dates: true, search: 'Account, voucher or name…' })
        const ql = (rf('txnDetailByAccount').q || '').trim().toLowerCase()
        type Line = { accId: string; date: string; type: string; no: string; name: string; memo: string; debit: number; credit: number }
        const lines: Line[] = []
        for (const r of live.receipts) if (inRf('txnDetailByAccount', r.date)) {
          lines.push({ accId: r.depositAccountId, date: r.date, type: 'Receipt', no: r.number, name: r.receivedFrom || '—', memo: r.description || '—', debit: r.amount, credit: 0 })
          for (const l of r.lines || []) lines.push({ accId: l.accountId, date: r.date, type: 'Receipt', no: r.number, name: r.receivedFrom || '—', memo: l.narration || r.description || '—', debit: 0, credit: l.amount })
        }
        for (const pv of live.payments) if (inRf('txnDetailByAccount', pv.date)) {
          lines.push({ accId: pv.paymentAccountId, date: pv.date, type: 'Payment', no: pv.number, name: pv.paidTo || '—', memo: pv.description || '—', debit: 0, credit: pv.amount })
          for (const l of pv.lines || []) lines.push({ accId: l.accountId, date: pv.date, type: 'Payment', no: pv.number, name: pv.paidTo || '—', memo: l.narration || pv.description || '—', debit: l.amount, credit: 0 })
        }
        for (const j of live.journals) if (inRf('txnDetailByAccount', j.date)) {
          for (const l of j.lines) lines.push({ accId: l.accountId, date: j.date, type: 'Journal', no: j.number, name: j.stakeholder || '—', memo: j.description || '—', debit: l.debit || 0, credit: l.credit || 0 })
        }
        const byAcc = new Map<string, Line[]>()
        const accLabel = (id: string) => {
          const a = accounts.find((x) => x.id === id)
          return a ? `${a.code ? `${a.code} · ` : ''}${a.name}` : accountName(accounts, id)
        }
        for (const l of lines) {
          const label = accLabel(l.accId)
          if (ql && !`${label} ${l.no} ${l.name} ${l.memo}`.toLowerCase().includes(ql)) continue
          byAcc.set(label, [...(byAcc.get(label) ?? []), l])
        }
        if (!byAcc.size) return withFilters(bar, <Empty title="No transactions" desc="Postings for the selected period appear here, grouped by account." />)
        const rows: ReactNode[][] = []
        let gDr = 0
        let gCr = 0
        for (const [label, list] of [...byAcc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          rows.push([<b className="uppercase">{label}</b>, '', '', '', '', '', '', ''])
          let run = 0
          for (const l of list.sort((a, b) => a.date.localeCompare(b.date))) {
            run += l.debit - l.credit
            rows.push([
              <span className="pl-4">{dFmt(l.date)}</span>, l.type, l.no, l.name, l.memo,
              l.debit ? formatGhs(l.debit) : '—', l.credit ? formatGhs(l.credit) : '—', formatGhs(run),
            ])
          }
          const dr = list.reduce((n, l) => n + l.debit, 0)
          const cr = list.reduce((n, l) => n + l.credit, 0)
          gDr += dr
          gCr += cr
          rows.push([<b className="pl-4">{`Total ${label}`}</b>, '', '', '', '', <b>{formatGhs(dr)}</b>, <b>{formatGhs(cr)}</b>, <b>{formatGhs(dr - cr)}</b>])
        }
        rows.push([<b>Grand total</b>, '', '', '', '', <b>{formatGhs(gDr)}</b>, <b>{formatGhs(gCr)}</b>, ''])
        return withFilters(bar, <T head={['Date', 'Type', 'No.', 'Name', 'Memo', curTitle('Debit'), curTitle('Credit'), curTitle('Balance')]} right={[5, 6, 7]} rows={rows} />)
      }

      case 'txnListByDate':
      case 'recentTxns': {
        const id = sel
        const bar = filterBar(id, {
          dates: id === 'txnListByDate',
          selects: [{ key: 'a', label: 'Type', options: [{ value: '', label: 'All types' }, { value: 'Receipt', label: 'Receipts' }, { value: 'Payment', label: 'Payments' }, { value: 'Journal', label: 'Journals' }] }],
          search: 'Number, name or memo…',
        })
        const f = rf(id)
        const ql = (f.q || '').trim().toLowerCase()
        type Row = { date: string; type: string; no: string; name: string; account: string; memo: string; amount: number }
        const txns: Row[] = [
          ...live.receipts.map((r) => ({ date: r.date, type: 'Receipt', no: r.number, name: r.receivedFrom || '—', account: accountName(accounts, r.depositAccountId), memo: r.description || '—', amount: r.amount })),
          ...live.payments.map((pv) => ({ date: pv.date, type: 'Payment', no: pv.number, name: pv.paidTo || '—', account: accountName(accounts, pv.paymentAccountId), memo: pv.description || '—', amount: -pv.amount })),
          ...live.journals.map((j) => ({ date: j.date, type: 'Journal', no: j.number, name: j.stakeholder || '—', account: 'Multiple', memo: j.description || '—', amount: j.lines.reduce((n, l) => n + (l.debit || 0), 0) })),
        ]
          .filter((r) => (id === 'recentTxns' ? true : inRf(id, r.date)))
          .filter((r) => !f.a || r.type === f.a)
          .filter((r) => !ql || `${r.no} ${r.name} ${r.memo}`.toLowerCase().includes(ql))
          .sort((a, b) => (id === 'recentTxns' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
        const shown = id === 'recentTxns' ? txns.slice(0, 25) : txns
        if (!shown.length) return withFilters(bar, <Empty title="No transactions" desc="Receipts, payments and journals appear here." />)
        const rows: ReactNode[][] = shown.map((r) => [
          dFmt(r.date), r.type, r.no, <span className="font-semibold">{r.name}</span>, r.account, r.memo, formatGhs(r.amount),
        ])
        rows.push(['', '', '', '', '', <b>Total</b>, <b>{formatGhs(shown.reduce((n, r) => n + r.amount, 0))}</b>])
        return withFilters(bar, <T head={['Date', 'Type', 'No.', 'Name', 'Account', 'Memo', curTitle('Amount')]} right={[6]} rows={rows} />)
      }

      case 'auditLog': {
        const bar = filterBar('auditLog', { dates: true, search: 'User, action or entity…' })
        const ql = (rf('auditLog').q || '').trim().toLowerCase()
        const list = audit
          .filter((lg) => inRf('auditLog', (lg.createdAt || '').slice(0, 10)))
          .filter((lg) => !ql || `${lg.userId} ${lg.action} ${lg.entity} ${lg.details}`.toLowerCase().includes(ql))
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        if (!list.length) return withFilters(bar, <Empty title="No audit entries" desc="Changes made in the system are recorded here." />)
        const rows: ReactNode[][] = list.slice(0, 200).map((lg) => [
          dFmt((lg.createdAt || '').slice(0, 10)),
          (lg.createdAt || '').slice(11, 16) || '—',
          app.users.find((u) => u.id === lg.userId)?.name || lg.userId,
          <Badge tone={lg.action === 'DELETE' ? 'rose' : lg.action === 'CREATE' ? 'lime' : 'sky'}>{lg.action}</Badge>,
          lg.entity, lg.details,
        ])
        return withFilters(bar, <T head={['Date', 'Time', 'User', 'Action', 'Entity', 'Details']} rows={rows} />)
      }

      // ------------------------------------------------------------- Custom
      case 'customBuilder': {
        // Create / edit a custom report: source, period, columns, grouping.
        const d = cbDraft ?? newCustomDraft()
        const cols = CUSTOM_COLUMNS[d.source]
        const set = (patch: Partial<CustomReport>) => setCbDraft({ ...d, ...patch })
        const toggleCol = (key: string) => set({
          columns: d.columns.includes(key) ? d.columns.filter((c) => c !== key) : [...CUSTOM_COLUMNS[d.source].map((c) => c.key).filter((c) => c === key || d.columns.includes(c))],
        })
        const canSave = d.name.trim().length > 0 && d.columns.length > 0
        return (
          <div className="max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Report name" required>
                <input
                  className="field h-10 w-full"
                  value={d.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. Cash receipts by month"
                />
              </Field>
              <Field label="Data source">
                <Select
                  value={d.source}
                  onChange={(e) => {
                    const src = e.target.value as CustomSource
                    set({ source: src, columns: CUSTOM_COLUMNS[src].map((c) => c.key), groupBy: '' })
                  }}
                >
                  {(Object.keys(SOURCE_LABEL) as CustomSource[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}
                </Select>
              </Field>
              {d.source !== 'accounts' && (
                <>
                  <Field label="From date"><DatePicker value={d.from || ''} onChange={(v) => set({ from: v })} max={d.to || undefined} placeholder="Dated from" /></Field>
                  <Field label="To date"><DatePicker value={d.to || ''} onChange={(v) => set({ to: v })} min={d.from || undefined} placeholder="Dated to" /></Field>
                </>
              )}
              <Field label="Group by">
                <Select value={d.groupBy || ''} onChange={(e) => set({ groupBy: e.target.value as CustomReport['groupBy'] })}>
                  <option value="">No grouping</option>
                  {d.source !== 'accounts' && <option value="month">Month</option>}
                  <option value="account">Account</option>
                  {d.source !== 'accounts' && <option value="party">Stakeholder</option>}
                </Select>
              </Field>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Columns</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {cols.map((c) => (
                  <label key={c.key} className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-[#2e75b6]"
                      checked={d.columns.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canSave}
                onClick={() => {
                  const list = customReports.some((r) => r.id === d.id)
                    ? customReports.map((r) => (r.id === d.id ? d : r))
                    : [...customReports, d]
                  persistCustom(list)
                  setCbDraft(null)
                  setSel(`custom:${d.id}`)
                }}
                className="inline-flex h-10 cursor-pointer items-center rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save and run
              </button>
              <button
                type="button"
                onClick={() => { setCbDraft(null); setSel(null) }}
                className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-5 text-sm font-semibold text-mist transition hover:text-inherit"
              >
                Cancel
              </button>
              {customReports.some((r) => r.id === d.id) && (
                <button
                  type="button"
                  onClick={() => { persistCustom(customReports.filter((r) => r.id !== d.id)); setCbDraft(null); setSel(null) }}
                  className="inline-flex h-10 cursor-pointer items-center rounded-md border border-rose-400 px-5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  Delete report
                </button>
              )}
            </div>
            {!canSave && <p className="mt-2 text-xs text-mist">Give the report a name and keep at least one column.</p>}
          </div>
        )
      }

      default: {
        if (!sel?.startsWith('custom:')) return null
        // ---- run a saved custom report ----
        const def = customReports.find((r) => r.id === sel.slice(7))
        if (!def) return <Empty title="Report not found" desc="This custom report has been deleted." />
        const cols = CUSTOM_COLUMNS[def.source].filter((c) => def.columns.includes(c.key))
        const within = (date: string) => (!def.from || date >= def.from) && (!def.to || date <= def.to)
        const cap2 = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '—')

        type Rec = Record<string, string | number> & { _amount: number; _debit: number; _credit: number; _group: string }
        let recs: Rec[] = []
        if (def.source === 'receipts') {
          recs = live.receipts.filter((r) => within(r.date)).map((r) => ({
            date: dFmt(r.date), number: r.number, party: r.receivedFrom || '—', class: cap2(r.stakeholderClass || ''),
            account: accountName(accounts, r.depositAccountId), method: cap2(r.method || ''), description: r.description || '—',
            amount: r.amount, _amount: r.amount, _debit: r.amount, _credit: 0,
            _group: def.groupBy === 'month' ? r.date.slice(0, 7) : def.groupBy === 'party' ? (r.receivedFrom || '—') : def.groupBy === 'account' ? accountName(accounts, r.depositAccountId) : '',
          }))
        } else if (def.source === 'payments') {
          recs = live.payments.filter((pv) => within(pv.date)).map((pv) => ({
            date: dFmt(pv.date), number: pv.number, party: pv.paidTo || '—', class: cap2(pv.stakeholderClass || ''),
            account: accountName(accounts, pv.paymentAccountId), method: cap2(pv.method || ''), description: pv.description || '—',
            amount: pv.amount, _amount: pv.amount, _debit: 0, _credit: pv.amount,
            _group: def.groupBy === 'month' ? pv.date.slice(0, 7) : def.groupBy === 'party' ? (pv.paidTo || '—') : def.groupBy === 'account' ? accountName(accounts, pv.paymentAccountId) : '',
          }))
        } else if (def.source === 'journals') {
          recs = live.journals.filter((j) => within(j.date)).flatMap((j) => j.lines.map((l) => ({
            date: dFmt(j.date), number: j.number, account: accountName(accounts, l.accountId),
            description: j.description || '—', party: j.stakeholder || '—',
            debit: l.debit || 0, credit: l.credit || 0,
            _amount: (l.debit || 0) - (l.credit || 0), _debit: l.debit || 0, _credit: l.credit || 0,
            _group: def.groupBy === 'month' ? j.date.slice(0, 7) : def.groupBy === 'party' ? (j.stakeholder || '—') : def.groupBy === 'account' ? accountName(accounts, l.accountId) : '',
          })))
        } else {
          recs = accounts.map((a) => {
            const b = bal(all, a.id)
            return {
              code: a.code || '—', name: a.name, type: cap2(a.type || ''),
              accountType: accountName(accounts, a.id) && (a.detailType || cap2(a.type || '')),
              balance: b, _amount: b, _debit: b > 0 ? b : 0, _credit: b < 0 ? -b : 0,
              _group: def.groupBy === 'account' ? cap2(a.type || '') : '',
            } as Rec
          })
        }

        if (!recs.length) {
          return (
            <div>
              {customHeader(def)}
              <Empty title="No data for this report" desc="Adjust the period or data source in Edit report." />
            </div>
          )
        }

        const cell = (r: Rec, key: string) => {
          const col = cols.find((c) => c.key === key)
          const v = r[key]
          if (col?.num) return formatGhs(Number(v) || 0)
          return String(v ?? '—')
        }
        const totalsOf = (list: Rec[]) => cols.map((c) => (c.num
          ? <b>{formatGhs(list.reduce((n, r) => n + (Number(r[c.key]) || 0), 0))}</b>
          : ''))
        const rows: ReactNode[][] = []
        if (def.groupBy) {
          const groups = new Map<string, Rec[]>()
          for (const r of recs) {
            const g = String(r._group || '—')
            groups.set(g, [...(groups.get(g) ?? []), r])
          }
          for (const [g, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const label = def.groupBy === 'month' && /^\d{4}-\d{2}$/.test(g)
              ? new Date(`${g}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              : g
            rows.push([<b className="uppercase">{label}</b>, ...cols.slice(1).map(() => '')])
            for (const r of list) rows.push(cols.map((c, i) => (i === 0 ? <span className="pl-4">{cell(r, c.key)}</span> : cell(r, c.key))))
            rows.push([<b className="pl-4">{`Total ${label}`}</b>, ...totalsOf(list).slice(1)])
          }
        } else {
          for (const r of recs) rows.push(cols.map((c) => cell(r, c.key)))
        }
        rows.push([<b>Grand total</b>, ...totalsOf(recs).slice(1)])
        return (
          <div>
            {customHeader(def)}
            <T head={cols.map((c) => (c.num ? curTitle(c.label) : c.label))} right={cols.map((c, i) => (c.num ? i : -1)).filter((i) => i >= 0)} rows={rows} />
          </div>
        )
      }

      case 'fnotes': {
        /*
         * Notes to the Financial Statements = NOTE 1 Accounting Policies
         * (narrative, from the separate policy register) followed by the
         * EXISTING Notes to Accounts, untouched. Nothing here reads or writes
         * account structure — the two sources are merged at report time only.
         */
        const bar = filterBar('fnotes', {
          selects: [{
            key: 'a',
            label: 'Policy year',
            options: Array.from(new Set([...loadAccountingPolicies().map((p) => p.effectiveYear), year]))
              .sort((x, y2) => y2 - x)
              .map((y2) => ({ value: String(y2), label: String(y2) })),
          }],
          search: 'Policy, account or note…',
        })
        const f = rf('fnotes')
        const ql = (f.q || '').trim().toLowerCase()
        const policyYear = Number(f.a) || year
        const policies = policiesForYear(loadAccountingPolicies(), policyYear)
          .filter((p) => !ql || `${p.code} ${p.title} ${p.text}`.toLowerCase().includes(ql))

        // Section 2 — the existing Notes to Accounts register, in note order.
        const register = loadAccountNotes()
          .filter((n) => n.status !== 'inactive')
          .slice()
          .sort((a, b) => String(a.noteNo).localeCompare(String(b.noteNo), undefined, { numeric: true }))
        const noteRows = register
          .map((n) => {
            const acc = accounts.find((a) => a.id === n.accountId)
            const covered = (n.accountIds || [])
              .map((id) => accounts.find((a) => a.id === id)?.name)
              .filter(Boolean) as string[]
            return {
              no: n.noteNo,
              title: acc?.name || n.name,
              body: [n.description, covered.length ? `Covers: ${covered.join(', ')}` : ''].filter(Boolean).join(' — '),
            }
          })
          .filter((r) => !ql || `${r.no} ${r.title} ${r.body}`.toLowerCase().includes(ql))

        // Fallback for charts with no note register: account descriptions.
        const descriptive = accounts
          .filter((a) => (a.description || a.noteNo || a.detailType || a.bank) && keepAccountRowAt(frPrefs, 0.5, bal(all, a.id)))
          .map((a) => ({
            no: a.noteNo || '',
            title: a.name,
            body: [a.detailType, a.description, a.bank ? `${a.bank}${a.accountNumber ? ` ${a.accountNumber}` : ''}` : ''].filter(Boolean).join(' — '),
          }))
          .filter((r) => !ql || `${r.no} ${r.title} ${r.body}`.toLowerCase().includes(ql))
        const section2 = noteRows.length ? noteRows : descriptive

        const rows: ReactNode[][] = []
        rows.push([<b className="uppercase">{`Note ${POLICY_NOTE_NUMBER} — Accounting policies`}</b>, ''])
        if (policies.length) {
          for (const p of policies) {
            rows.push([
              <span className="pl-4 font-semibold">{p.code} {p.title}</span>,
              <span className="whitespace-pre-line text-justify">{p.text}</span>,
            ])
          }
        } else {
          rows.push([<span className="pl-4 text-mist">No active policies for {policyYear}</span>, <span className="text-mist">Add them under Accounting → Accounting Policies.</span>])
        }
        rows.push([<b className="uppercase">Notes to the accounts</b>, ''])
        for (const r of section2) {
          rows.push([
            <span className="pl-4 font-semibold">{r.no ? `Note ${r.no} — ` : ''}{r.title}</span>,
            r.body || '—',
          ])
        }
        return withFilters(bar, <T head={['Notes to the financial statements', 'Narrative']} rows={rows} />)
      }
      case 'fbud': {
        const years = Array.from(new Set([...budgets.map((b) => b.year), year])).sort((a, b) => b - a)
        const bar = filterBar('fbud', {
          selects: [{ key: 'a', label: 'Year', options: years.map((y2) => ({ value: String(y2), label: String(y2) })) }],
          search: 'Account…',
        })
        const yr = Number(rf('fbud').a) || year
        const ql = (rf('fbud').q || '').trim().toLowerCase()
        const rows = budgets.filter((b) => b.year === yr)
          .filter((b) => !ql || accountName(accounts, b.accountId).toLowerCase().includes(ql))
          .map((b) => {
            const budget = budgetFor(b.accountId, yr)
            const actual = Math.abs(bal(all, b.accountId))
            return [accountName(accounts, b.accountId), formatGhs(budget), formatGhs(actual), formatGhs(budget - actual)]
          })
        return withFilters(bar, rows.length
          ? <T head={['Account', curTitle('Budget'), curTitle('Actual'), curTitle('Remaining')]} right={[1, 2, 3]} rows={rows} />
          : <Empty title="No budgets for this year" desc="Create budgets under Accounting → Budget to see them here." />)
      }
      case 'budgetOverview': {
        const years = Array.from(new Set([...budgets.map((b) => b.year), year])).sort((a, b) => b - a)
        const bar = filterBar('budgetOverview', {
          selects: [{ key: 'a', label: 'Year', options: years.map((y2) => ({ value: String(y2), label: String(y2) })) }],
          search: 'Account…',
        })
        const yr = Number(rf('budgetOverview').a) || year
        const ql = (rf('budgetOverview').q || '').trim().toLowerCase()
        const rows = budgets.filter((b) => b.year === yr)
          .filter((b) => !ql || accountName(accounts, b.accountId).toLowerCase().includes(ql))
          .map((b) => [accountName(accounts, b.accountId), String(b.year), formatGhs(budgetFor(b.accountId, yr))])
        return withFilters(bar, rows.length
          ? <T head={['Account', 'Year', curTitle('Budgeted balance')]} right={[2]} rows={rows} />
          : <Empty title="No budgets" desc="Create budgets under Accounting → Budget to see them here." />)
      }
      case 'plBudgetVsActual': {
        const years = Array.from(new Set([...budgets.map((b) => b.year), year])).sort((a, b) => b - a)
        const bar = filterBar('plBudgetVsActual', {
          selects: [
            { key: 'a', label: 'Year', options: years.map((y2) => ({ value: String(y2), label: String(y2) })) },
            { key: 'b', label: 'Accounts', options: [{ value: '', label: 'Income and expenses' }, { value: 'income', label: 'Income only' }, { value: 'expense', label: 'Expenses only' }] },
          ],
          search: 'Account…',
        })
        const f = rf('plBudgetVsActual')
        const yr = Number(f.a) || year
        const ql = (f.q || '').trim().toLowerCase()
        const map = buildMap((d) => d.slice(0, 4) === String(yr))
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (!f.b || a.type === f.b) && (map.has(a.id) || budgetFor(a.id, yr) > 0))
          .filter((a) => !ql || a.name.toLowerCase().includes(ql))
          .map((a) => {
            const actual = bal(map, a.id)
            const budget = a.type === 'expense' ? -budgetFor(a.id, yr) : budgetFor(a.id, yr)
            return [<span className="font-semibold">{a.name}</span>, formatGhs(budget), formatGhs(actual), formatGhs(actual - budget)]
          })
        return withFilters(bar, rows.length
          ? <T head={['Account', curTitle('Budget'), curTitle('Actual'), curTitle('Variance')]} right={[1, 2, 3]} rows={rows} />
          : <Empty title="No budget data" desc="Create budgets to compare against actuals." />)
      }
      case 'plBudgetPerf': {
        const years = Array.from(new Set([...budgets.map((b) => b.year), year])).sort((a, b) => b - a)
        const bar = filterBar('plBudgetPerf', {
          selects: [
            { key: 'a', label: 'Year', options: years.map((y2) => ({ value: String(y2), label: String(y2) })) },
            { key: 'b', label: 'Accounts', options: [{ value: '', label: 'Income and expenses' }, { value: 'income', label: 'Income only' }, { value: 'expense', label: 'Expenses only' }] },
          ],
          search: 'Account…',
        })
        const f = rf('plBudgetPerf')
        const yr = Number(f.a) || year
        const ql = (f.q || '').trim().toLowerCase()
        const yearMap = buildMap((d) => d.slice(0, 4) === String(yr))
        const monthMap = yr === Number(todayIso.slice(0, 4)) ? month : buildMap((d) => d.slice(0, 7) === `${yr}-12`)
        const rows = accounts
          .filter((a) => (a.type === 'income' || a.type === 'expense') && (!f.b || a.type === f.b) && (monthMap.has(a.id) || yearMap.has(a.id) || budgetFor(a.id, yr) > 0))
          .filter((a) => !ql || a.name.toLowerCase().includes(ql))
          .map((a) => [<span className="font-semibold">{a.name}</span>, formatGhs(bal(monthMap, a.id)), formatGhs(bal(yearMap, a.id)), formatGhs(budgetFor(a.id, yr))])
        return withFilters(bar, rows.length
          ? <T head={['Account', curTitle('This month'), curTitle('Year to date'), curTitle('Annual budget')]} right={[1, 2, 3]} rows={rows} />
          : <Empty title="No budget data" desc="Create budgets to compare against actuals." />)
      }
    }
  }

  const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches))
  /** The selected report's preview, shared by the screen and the print sheet. */
  const previewNode = current ? render() : null
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [exportRows, setExportRows] = useState<ExportRow[]>([])
  useEffect(() => {
    setExportRows(tableToRows(bodyRef.current))
    // Re-scrape after a report regenerates (e.g. Journal Entry's Generate), so
    // the Export buttons appear/refresh with the newly rendered table.
  }, [current?.id, jeApplied])
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
      {/* Header mirrors the Report Viewer: catalog blurb, total report count and a
          "Show all at once" toggle that expands every section of the accordion. */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">All Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          {`Browse the accounting report catalog — clicking a report opens its preview; use “Back to report list” to return. ${totalReports} reports in total.`}
          {!current && (
            <button
              type="button"
              onClick={() => { setShowAll((v) => !v); setOpenSection(showAll ? 'statements' : null) }}
              className="ml-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-line bg-white px-2.5 text-xs font-semibold text-[#1a56b0] transition hover:bg-[#2e75b6] hover:text-white dark:bg-white/[0.04] dark:text-sky-300"
            >
              {showAll ? 'Show compact list' : 'Show all at once'}
            </button>
          )}
        </p>
      </div>
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
      {current && (current.id === 'generalLedger' || current.id === 'subLedger' || current.id === 'ledger' || current.id === 'generalJournal' || current.id === 'checkBalance' || current.id === 'cashBook' || current.id === 'bankBook') ? (
        <div className="card p-5">
          <button type="button" onClick={() => setSel(null)} className="mb-3 block cursor-pointer text-xs text-[#1a56b0] hover:underline dark:text-sky-300">Back to report list</button>
          {previewNode}
        </div>
      ) : current ? (
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
            <div>
              <button type="button" onClick={() => setSel(null)} className="mb-1 block cursor-pointer text-xs text-[#1a56b0] hover:underline dark:text-sky-300">Back to report list</button>
              <h2 className="text-lg font-bold text-[#2e75b6] dark:text-sky-300">{current.label}</h2>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {current.id === 'listAccounts' || current.id === 'reconciliation' || current.id === 'reconSummary' || current.id === 'reconDetail' || current.id === 'la' ? null : current.id === 'tb' ? (
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
                  onClick={() => (current.id === 'journalEntry' ? printJournalEntry() : window.print())}
                  aria-label={`Print ${current.label}`}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-mist transition hover:text-inherit"
                >
                  <Printer className="size-4" /> Print
                </button>
              )}
              {current.id !== 'listAccounts' && current.id !== 'reconciliation' && current.id !== 'reconSummary' && current.id !== 'reconDetail' && exportRows.length > 0 && <ExportButtons filename={`report-${current.id}`} rows={exportRows} compact onPdf={current.id === 'journalEntry' ? printJournalEntry : current.id === 'la' ? printLiquidity : undefined} />}
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
          <div className="card p-4">
            <SearchField value={q} onChange={setQ} placeholder="Search reports…" />
          </div>
          {(() => {
            const t = q.trim().toLowerCase()
            if (!t) return null
            const match = (e: Entry) => e.label.toLowerCase().includes(t) || e.desc.toLowerCase().includes(t)
            const groups: { title: string; items: Entry[] }[] = [
              { title: 'Statements/Ledgers', items: [...STATEMENTS_LEFT, ...STATEMENTS_RIGHT].filter(match) },
              { title: 'Financial Reports', items: [...finLeft, ...finRight].filter(match) },
              { title: 'Analysis', items: ANALYSIS.filter(match) },
              { title: 'Budget', items: BUDGET.filter(match) },
              { title: 'Sales tax', items: SALES_TAX.filter(match) },
              { title: 'Who owes you', items: WHO_OWES_YOU.filter(match) },
              { title: 'Sales and customers', items: SALES_CUSTOMERS.filter(match) },
              { title: 'What you owe', items: WHAT_YOU_OWE.filter(match) },
              { title: 'Expenses and suppliers', items: EXPENSES_SUPPLIERS.filter(match) },
              { title: 'For my accountant', items: FOR_ACCOUNTANT.filter(match) },
              { title: 'Custom Reports', items: customEntries.filter(match) },
            ].filter((g) => g.items.length > 0)
            if (groups.length === 0) return <Empty title="No reports found" desc={`No report matches “${q}”. Try a different search.`} />
            return (
              <div className="space-y-6">
                {groups.map((g) => (
                  <div key={g.title}>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-mist">{g.title}</h3>
                    <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                      {g.items.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
          {!q.trim() && (
            <>
              <Section id="statements" title="Statements/Ledgers" open={showAll || openSection === 'statements'} onToggle={() => { if (showAll) { setShowAll(false); setOpenSection('statements') } else setOpenSection(openSection === 'statements' ? null : 'statements') }}>
                <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                  <div className="space-y-5">{STATEMENTS_LEFT.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                  <div className="space-y-5">{STATEMENTS_RIGHT.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                </div>
              </Section>
              <Section id="financial" title="Financial Reports" open={showAll || openSection === 'financial'} onToggle={() => { if (showAll) { setShowAll(false); setOpenSection('financial') } else setOpenSection(openSection === 'financial' ? null : 'financial') }}>
                <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                  <div className="space-y-5">{finLeft.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                  <div className="space-y-5">{finRight.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                </div>
              </Section>
              <Section id="analysis" title="Analysis" open={showAll || openSection === 'analysis'} onToggle={() => { if (showAll) { setShowAll(false); setOpenSection('analysis') } else setOpenSection(openSection === 'analysis' ? null : 'analysis') }}>
                <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                  <div className="space-y-5">{ANALYSIS.filter((_, i) => i % 2 === 0).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                  <div className="space-y-5">{ANALYSIS.filter((_, i) => i % 2 === 1).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                </div>
              </Section>
              <Section id="budget" title="Budget" open={showAll || openSection === 'budget'} onToggle={() => { if (showAll) { setShowAll(false); setOpenSection('budget') } else setOpenSection(openSection === 'budget' ? null : 'budget') }}>
                <div className="space-y-5">{BUDGET.map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
              </Section>
              <Section
                id="customReports"
                title="Custom Reports"
                open={showAll || openSection === 'customReports'}
                onToggle={() => { if (showAll) { setShowAll(false); setOpenSection('customReports') } else setOpenSection(openSection === 'customReports' ? null : 'customReports') }}
              >
                <div className="space-y-5">
                  {customEntries.length > 0 ? (
                    <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                      <div className="space-y-5">{customEntries.filter((_, i) => i % 2 === 0).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                      <div className="space-y-5">{customEntries.filter((_, i) => i % 2 === 1).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-mist">No custom reports yet — build one from your receipts, payments, journal lines or chart of accounts.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCbDraft(newCustomDraft()); setSel('customBuilder') }}
                    className="inline-flex h-10 cursor-pointer items-center rounded-md bg-[#2e75b6] px-5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    + New custom report
                  </button>
                </div>
              </Section>
              {([
                { id: 'salesTax', title: 'Sales tax', items: SALES_TAX },
                { id: 'whoOwes', title: 'Who owes you', items: WHO_OWES_YOU },
                { id: 'salesCustomers', title: 'Sales and customers', items: SALES_CUSTOMERS },
                { id: 'whatYouOwe', title: 'What you owe', items: WHAT_YOU_OWE },
                { id: 'expensesSuppliers', title: 'Expenses and suppliers', items: EXPENSES_SUPPLIERS },
                { id: 'forAccountant', title: 'For my accountant', items: FOR_ACCOUNTANT },
              ] as const).map((g) => (
                <Section
                  key={g.id}
                  id={g.id}
                  title={g.title}
                  open={showAll || openSection === g.id}
                  onToggle={() => { if (showAll) { setShowAll(false); setOpenSection(g.id) } else setOpenSection(openSection === g.id ? null : g.id) }}
                >
                  <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">
                    <div className="space-y-5">{g.items.filter((_, i) => i % 2 === 0).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                    <div className="space-y-5">{g.items.filter((_, i) => i % 2 === 1).map((e) => (<LinkRow key={e.id} e={e} onPick={pick} />))}</div>
                  </div>
                </Section>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
