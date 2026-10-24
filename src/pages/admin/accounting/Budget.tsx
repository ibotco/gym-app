import { useMemo, useState } from 'react'
import { Plus, ChevronRight, Save } from 'lucide-react'
import { PageHeader, Button, Select, Input } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { accountName, ACCOUNT_TYPES } from '../../../lib/accounting'
import type { AccountType } from '../../../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Statement = 'balance' | 'pl'

const STATEMENT_OPTIONS: { id: Statement; label: string; types: AccountType[] }[] = [
  { id: 'balance', label: 'Balance Sheet (reflects ending balance)', types: ['asset', 'liability', 'equity'] },
  { id: 'pl', label: 'Profit & Loss', types: ['income', 'expense'] },
]

export function BudgetPage() {
  const app = useApp()
  const { budgets, accounts, upsertBudget, deleteBudget, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [statement, setStatement] = useState<Statement>('balance')
  const [accountType, setAccountType] = useState('')
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)

  const [extraYears, setExtraYears] = useState<number[]>([])
  const years = useMemo(() => {
    const s = new Set(budgets.map((b) => b.year))
    s.add(new Date().getFullYear())
    extraYears.forEach((y) => s.add(y))
    return Array.from(s).sort((a, b) => b - a)
  }, [budgets, extraYears])

  /** Start a budget for the next fiscal year not yet in the list. */
  const newBudgetYear = () => {
    const next = Math.max(...years) + 1
    setExtraYears((s) => [...s, next])
    setYear(next)
    toast.success(`New ${next} budget started`, 'Enter monthly amounts and Save.')
  }

  const activeStatement = STATEMENT_OPTIONS.find((s) => s.id === statement)!

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return accounts
      .filter((a) => activeStatement.types.includes(a.type))
      .filter((a) => !accountType || a.type === accountType)
      .filter((a) => !ql || `${a.code} ${a.name}`.toLowerCase().includes(ql))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((a) => {
        const budget = budgets.find((b) => b.year === year && b.accountId === a.id)
        return { account: a, months: budget?.months || Array(12).fill(0), budgetId: budget?.id }
      })
  }, [accounts, budgets, year, statement, accountType, q])

  // Column totals
  const totals = useMemo(() => {
    const t = Array(12).fill(0)
    for (const r of rows) r.months.forEach((m, i) => { t[i] += Number(m) || 0 })
    return t
  }, [rows])
  const grandTotal = totals.reduce((s, v) => s + v, 0)

  const setMonth = (accountId: string, budgetId: string | undefined, monthIdx: number, value: string) => {
    const num = Number(value) || 0
    const existing = budgets.find((b) => b.year === year && b.accountId === accountId)
    const months = existing?.months ? [...existing.months] : Array(12).fill(0)
    months[monthIdx] = num
    upsertBudget({
      id: existing?.id || uid('bd'),
      year,
      accountId,
      months,
      notes: existing?.notes,
    })
  }

  const saveAll = () => {
    setSaving(true)
    log(user?.id || 'system', 'UPDATE', 'Budget', `Saved ${year} ${activeStatement.label} budget`)
    toast.success('Budget saved', `${year} · ${rows.length} accounts`)
    window.setTimeout(() => setSaving(false), 500)
  }

  const clearRow = (accountId: string, budgetId: string | undefined) => {
    upsertBudget({ id: budgetId || uid('bd'), year, accountId, months: Array(12).fill(0) })
    toast.success('Row cleared', accountName(accounts, accountId))
  }

  const exportRows = rows.map((r) => ({
    Account: r.account.name,
    ...Object.fromEntries(MONTHS.map((m, i) => [m, r.months[i]])),
    Total: r.months.reduce((s, m) => s + (Number(m) || 0), 0),
  }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><ChevronRight className="size-3.5" /><span className="font-semibold text-inherit">Budget</span>
      </div>
      <PageHeader
        title="Fiscal Year Budget"
        desc="Plan annual budgets per account across twelve months."
        actions={
          <>
            <ExportButtons filename={`budget-${year}`} rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveAll}><Save className="size-4" /> {saving ? 'Saving…' : 'Save'}</Button>}
          </>
        }
      />

      {/* Toolbar — fiscal year · budget · New · Total Accounts */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className="mb-1 block text-xs font-bold">Fiscal Year</label>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <div className="w-full max-w-md">
            <label className="mb-1 block text-xs font-bold">Budget</label>
            <Select value={statement} onChange={(e) => setStatement(e.target.value as Statement)}>
              {STATEMENT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{year} - {s.label}</option>)}
            </Select>
          </div>
          {canManage && (
            <Button className="h-10 bg-[#2c4a77] text-white hover:bg-[#243d63]" onClick={newBudgetYear}>
              <Plus className="size-4" /> New
            </Button>
          )}
          <div className="ml-2">
            <label className="mb-1 block text-xs font-bold">Total Accounts</label>
            <div className="grid h-10 min-w-[220px] place-items-center rounded-xl bg-[#2c4a77] px-6 font-semibold text-white">
              {fmt2(grandTotal)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[230px]">
            <label className="mb-1 block text-xs font-bold">Account type</label>
            <Select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="">All account types</option>
              {ACCOUNT_TYPES.filter((t) => activeStatement.types.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
          <div className="w-full max-w-sm">
            <label className="mb-1 block text-xs font-bold">Search</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="type to search..." className="placeholder:italic placeholder:text-rose-500" />
          </div>
          {canManage && (
            <Button className="h-10 bg-[#2c4a77] text-white hover:bg-[#243d63]" onClick={saveAll}>
              <Save className="size-4" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
          <span className="pb-2.5 text-sm text-mist">Showing {rows.length ? 1 : 0} to {rows.length} of {rows.length} entries</span>
        </div>
      </div>

      {/* Budget grid — Account Name · Total · Jan…Dec */}
      <div className="card overflow-hidden">
        <div className="budget-wrap">
          <table id="budget-grid" className="my-table table table-bordered table-sm table-hover budget-grid datatable dataTable" cellSpacing="0" width="100%">
            <thead>
              <tr>
                <th className="col-account">Account Name</th>
                <th className="col-total">Total</th>
                {MONTHS.map((m) => <th key={m} className="col-month">{m}</th>)}
              </tr>
            </thead>
            <tbody id="budgetBody">
              {rows.map(({ account, months, budgetId }) => {
                const rowTotal = months.reduce((s, m) => s + (Number(m) || 0), 0)
                return (
                  <tr key={account.id} data-account-id={account.id} className="budget-row">
                    <td>
                      <div className="wrap-text font-semibold">{account.name}</div>
                      {canManage && (
                        <div className="row-options">
                          <a href="#" onClick={(e) => { e.preventDefault(); saveAll() }}>Save</a>
                          {' | '}
                          <a href="#" className="text-danger" onClick={(e) => { e.preventDefault(); clearRow(account.id, budgetId) }}>Empty</a>
                        </div>
                      )}
                    </td>
                    <td>
                      <input type="text" inputMode="decimal" readOnly className="row-total total-input" value={rowTotal ? String(rowTotal) : ''} aria-label={`${account.name} total`} />
                    </td>
                    {months.map((m, i) => (
                      <td key={i}>
                        {canManage ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={m === 0 ? '' : m}
                            onChange={(e) => setMonth(account.id, budgetId, i, e.target.value)}
                            className="month-input custom-height-input"
                            aria-label={`${account.name} ${MONTHS[i]}`}
                          />
                        ) : (
                          <span>{fmt2(m)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={MONTHS.length + 2} className="py-8 text-center">No accounts match your filters.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr id="totals-row">
                <td className="label">Totals</td>
                <td id="grand-total">{fmt2(grandTotal)}</td>
                {totals.map((t, i) => <td key={i}>{fmt2(t)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
