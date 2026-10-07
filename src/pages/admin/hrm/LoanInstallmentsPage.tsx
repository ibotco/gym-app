import { useMemo, useState } from 'react'
import { Printer, Landmark, CheckCheck, Wallet, CalendarClock } from 'lucide-react'
import { PageHeader, Button, Badge, Input, Select, StatCard } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../lib/utils'
import { LOAN_STATUS } from './LoanApplicationsPage'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function LoanInstallmentsPage() {
  const { loans, loanInstallments, users, upsertLoan, upsertLoanInstallment, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [statusF, setStatusF] = useState('')
  const [loanF, setLoanF] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const loanOf = (id: string) => loans.find((l) => l.id === id)

  const rows = useMemo(() => [...loanInstallments]
    .filter((i) => (!month || i.dueDate.slice(0, 7) === month) && (!statusF || i.status === statusF) && (!loanF || i.loanId === loanF))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.n - b.n), [loanInstallments, month, statusF, loanF])

  const stats = useMemo(() => {
    const all = loanInstallments.filter((i) => !month || i.dueDate.slice(0, 7) === month)
    return {
      collected: all.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
      due: all.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
      overdue: loanInstallments.filter((i) => i.status === 'pending' && i.dueDate < now.toISOString().slice(0, 10)).length,
      paidCount: all.filter((i) => i.status === 'paid').length,
    }
  }, [loanInstallments, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const markPaid = (ids: string[]) => {
    const today = new Date().toISOString().slice(0, 10)
    for (const id of ids) {
      const i = loanInstallments.find((x) => x.id === id)
      if (i && i.status !== 'paid') upsertLoanInstallment({ ...i, status: 'paid', paidAt: today })
    }
    // complete loans whose installments are all paid
    for (const l of loans.filter((x) => x.status === 'active')) {
      const insts = loanInstallments.filter((i) => i.loanId === l.id)
      const allPaid = insts.length > 0 && insts.every((i) => i.status === 'paid' || ids.includes(i.id))
      if (allPaid) upsertLoan({ ...l, status: 'completed' })
    }
    log(user?.id || 'system', 'UPDATE', 'Loan', `Recorded ${ids.length} installment payment(s)`)
    toast.success('Installment(s) marked paid', `${ids.length} payment(s)`)
    setSelected([])
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSelected = rows.length > 0 && rows.filter((r) => r.status === 'pending').every((r) => selected.includes(r.id)) && rows.some((r) => r.status === 'pending')

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Loan Management</span><span>/</span>
        <span className="font-semibold text-inherit">Loan Installments</span>
      </div>
      <PageHeader
        title="Loan Installments"
        desc="Repayment schedule across all active loans — record payments as they are deducted or received."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Collected · ${month}`} value={ghs(stats.collected)} icon={<Wallet className="size-4" />} hint={`${stats.paidCount} payment(s)`} />
        <StatCard label={`Still due · ${month}`} value={ghs(stats.due)} icon={<CalendarClock className="size-4" />} />
        <StatCard label="Overdue (all time)" value={String(stats.overdue)} icon={<Landmark className="size-4" />} hint="pending past due date" />
        <StatCard label="Active loans" value={String(loans.filter((l) => l.status === 'active').length)} icon={<Landmark className="size-4" />} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[170px]" aria-label="Month" />
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[140px]" aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </Select>
        <Select value={loanF} onChange={(e) => setLoanF(e.target.value)} className="max-w-[220px]" aria-label="Loan">
          <option value="">All loans</option>
          {loans.map((l) => <option key={l.id} value={l.id}>{staffName(l.staffUserId)} · {ghs(l.principal)}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {canManage && selected.length > 0 && (
            <Button onClick={() => markPaid(selected)}><CheckCheck className="size-4" /> Record paid ({selected.length})</Button>
          )}
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename={`loan-installments-${month}`} rows={rows.map((i) => {
            const l = loanOf(i.loanId)
            return { Staff: l ? staffName(l.staffUserId) : '', '#': i.n, 'Due date': i.dueDate, Amount: i.amount, Status: i.status, 'Paid at': i.paidAt || '' }
          })} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              {canManage && <th className="w-10 px-3 py-3"><input type="checkbox" className="accent-[#c8f542]" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.filter((r) => r.status === 'pending').map((r) => r.id))} aria-label="Select all pending" /></th>}
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3">Loan</th>
              <th className="px-3 py-3">No.</th>
              <th className="px-3 py-3">Due date</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3">Status</th>
              {canManage && <th className="px-3 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const l = loanOf(i.loanId)
              const overdue = i.status === 'pending' && i.dueDate < now.toISOString().slice(0, 10)
              return (
                <tr key={i.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                  {canManage && <td className="px-3 py-2.5"><input type="checkbox" className="accent-[#c8f542]" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} disabled={i.status === 'paid'} aria-label="Select installment" /></td>}
                  <td className="px-3 py-2.5 font-bold">{l ? staffName(l.staffUserId) : '—'}</td>
                  <td className="px-3 py-2.5">
                    {l && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: LOAN_STATUS[l.status].color, color: LOAN_STATUS[l.status].color, background: `${LOAN_STATUS[l.status].color}14` }}>
                        {ghs(l.principal)} · {l.months} mo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-mist">{i.n}</td>
                  <td className={`px-3 py-2.5 ${overdue ? 'font-bold text-ember' : 'text-mist'}`}>{formatDate(i.dueDate)}{overdue ? ' · overdue' : ''}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold">{ghs(i.amount)}</td>
                  <td className="px-3 py-2.5"><Badge tone={i.status === 'paid' ? 'lime' : overdue ? 'rose' : 'amber'}>{i.status === 'paid' ? `paid ${i.paidAt || ''}` : overdue ? 'overdue' : 'pending'}</Badge></td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-right">
                      {i.status === 'pending' && <Button size="sm" onClick={() => markPaid([i.id])}>Record paid</Button>}
                    </td>
                  )}
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-mist">No installments due this month.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-mist">When the last installment of a loan is recorded paid, the loan automatically moves to Completed.</p>
    </div>
  )
}
