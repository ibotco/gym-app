import { useMemo, useState } from 'react'
import { Search, RotateCcw, ChevronRight, Save, Trash2 } from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, uid } from '../../../lib/utils'
import { accountName, budgetTotal, ACCOUNT_TYPES } from '../../../lib/accounting'
import type { Budget, AccountType } from '../../../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

  const years = useMemo(() => {
    const s = new Set(budgets.map((b) => b.year))
    s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
  }, [budgets])

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

      {/* Selectors */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Fiscal Year</label>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-mist">Total Accounts</label>
            <Select value={statement} onChange={(e) => setStatement(e.target.value as Statement)}>
              {STATEMENT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{year} - {s.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist">Account type</label>
            <Select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="">All account types</option>
              {ACCOUNT_TYPES.filter((t) => activeStatement.types.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SearchField value={q} onChange={setQ} placeholder="Search accounts…" className="w-full max-w-sm" />
          <Button variant="outline" onClick={() => { setQ(''); setAccountType('') }}><RotateCcw className="size-4" /> Reset</Button>
        </div>
      </div>

      {/* Matrix */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">{activeStatement.label} <span className="ml-1 text-xs font-normal text-mist">({rows.length} accounts)</span></p>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                {MONTHS.map((m) => <th key={m} className="text-right">{m}</th>)}
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, months, budgetId }) => {
                const rowTotal = months.reduce((s, m) => s + (Number(m) || 0), 0)
                return (
                  <tr key={account.id}>
                    <td>
                      <span className="block font-semibold">{account.name}</span>
                      <span className="block text-xs text-mist">{account.code}</span>
                    </td>
                    {months.map((m, i) => (
                      <td key={i} className="text-right">
                        {canManage ? (
                          <input
                            type="number"
                            value={m === 0 ? '' : m}
                            placeholder="0"
                            onChange={(e) => setMonth(account.id, budgetId, i, e.target.value)}
                            className="field w-24 text-right"
                            aria-label={`${account.name} ${MONTHS[i]}`}
                          />
                        ) : (
                          <span className="text-mist">{formatGhs(m)}</span>
                        )}
                      </td>
                    ))}
                    <td className="text-right font-semibold">{formatGhs(rowTotal)}</td>
                    <td className="whitespace-nowrap">
                      {canManage && (
                        <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Clear row" onClick={() => clearRow(account.id, budgetId)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={MONTHS.length + 3} className="py-8 text-center text-sm text-mist">No accounts match your filters.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-semibold">Totals</td>
                {totals.map((t, i) => <td key={i} className="text-right font-semibold">{formatGhs(t)}</td>)}
                <td className="text-right font-bold text-lime">{formatGhs(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-mist">
        Showing {rows.length} of {accounts.filter((a) => activeStatement.types.includes(a.type)).length} accounts · enter amounts per month; totals update automatically.
      </p>
    </div>
  )
}
