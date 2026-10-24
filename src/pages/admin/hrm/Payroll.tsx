import { useMemo, useState } from 'react'
import { Plus, Trash2, Wallet, Eye } from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, MonthYearPicker, Select, StatCard } from '../../../components/ui'
import { PayslipLines } from '../../../components/PayslipLines'
import { StaffListFilters } from '../../../components/StaffListFilters'
import { emptyStaffListFilters, matchesStaffListFilters, matchesStaffUserId, type StaffListFilterValues } from '../../../lib/staffListFilters'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { planLoanSettlement } from '../../../lib/loans'
import { loadSalaryAdvances, planAdvanceSettlement, saveSalaryAdvances } from '../../../lib/advanceSalary'
import { loadSalaryIncreaseSettings, salaryBasicForPeriod } from '../../../lib/salaryIncreases'
import type { Payslip } from '../../../types'

export function Payroll() {
  const app = useApp()
  const { payslips, staff, users, salaryAssignments, loans, loanInstallments, upsertPayslip, upsertLoan, setLoanInstallments, deletePayslip, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{
    id?: string; staffUserId: string; period: string
    basic: string; allowances: string; bonus: string; deductions: string; loan: string; advance: string
  } | null>(null)
  const [deleting, setDeleting] = useState<Payslip | null>(null)
  const [viewing, setViewing] = useState<Payslip | null>(null)
  const [staffFilters, setStaffFilters] = useState<StaffListFilterValues>(emptyStaffListFilters)
  const [salaryIncreaseSettings] = useState(() => loadSalaryIncreaseSettings())

  /** Marking a slip paid settles that individual's loans and advance recoveries. */
  const markStatus = (p: Payslip, status: 'draft' | 'paid') => {
    const paidAt = status === 'paid' ? new Date().toISOString().slice(0, 10) : undefined
    const rec: Payslip = { ...p, status, paidAt }
    upsertPayslip(rec)
    if (status === 'paid') {
      const res = planLoanSettlement(rec, loanInstallments, loans, paidAt)
      if (res.settled) {
        setLoanInstallments(res.installments)
        for (const id of res.completedLoanIds) {
          const loan = loans.find((l) => l.id === id)
          if (loan) upsertLoan({ ...loan, status: 'completed' })
        }
      }
      const advanceResult = planAdvanceSettlement(rec, loadSalaryAdvances())
      if (advanceResult.settled) saveSalaryAdvances(advanceResult.advances)
      if (res.settled || advanceResult.settled) {
        const parts = [
          res.settled ? `${res.settled} loan installment(s) settled` : '',
          advanceResult.settled ? `${advanceResult.settled} salary advance installment(s) recovered` : '',
          res.completedLoanIds.length ? 'loan completed' : '',
          advanceResult.completedAdvanceIds.length ? 'advance recovered in full' : '',
        ].filter(Boolean)
        toast.success('Payslip paid', parts.join(' · '))
        return
      }
    }
    toast.success('Updated')
  }

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const staffSalary = (id: string, period: string) => {
    const record = staff.find((s) => s.userId === id)
    const person = users.find((u) => u.id === id)
    const assignment = salaryAssignments.find((item) => item.staffUserId === id)
    return salaryBasicForPeriod({
      baseBasic: record?.salary || 0,
      staffUserId: id,
      period,
      hireDate: record?.hireDate,
      department: record?.department,
      salaryStructureId: assignment?.structureId,
      active: person?.status === 'active',
      settings: salaryIncreaseSettings,
    })
  }
  const formatPeriod = (value: string) => {
    const [year, month] = value.split('-').map(Number)
    return year && month >= 1 && month <= 12
      ? new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : value
  }

  const visibleStaff = useMemo(() => staff.filter((record) => matchesStaffListFilters(
    record,
    users,
    staffFilters,
  )), [staff, users, staffFilters])
  const filteredPayslips = useMemo(() => payslips.filter((slip) =>
    matchesStaffUserId(slip.staffUserId, staff, users, staffFilters),
  ), [payslips, staff, users, staffFilters])
  const totalNet = filteredPayslips.filter((p) => p.status === 'paid').reduce((s, p) => s + p.net, 0)

  const openNew = () => {
    const first = staff[0]?.userId || ''
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setEditing({ staffUserId: first, period, basic: String(staffSalary(first, period)), allowances: '0', bonus: '0', deductions: '0', loan: '0', advance: '0' })
  }
  const openEdit = (p: Payslip) => setEditing({
    id: p.id, staffUserId: p.staffUserId, period: p.period,
    basic: String(p.basic), allowances: String(p.allowances),
    bonus: String(p.bonus || 0), deductions: String(p.deductions), loan: String(p.loanDeduction || 0), advance: String(p.advanceDeduction || 0),
  })

  const save = () => {
    if (!editing) return
    if (!editing.staffUserId) { toast.error('Select a staff member.'); return }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(editing.period)) { toast.error('Choose a valid payroll month and year.'); return }
    const original = editing.id ? payslips.find((p) => p.id === editing.id) : undefined
    const basic = Number(editing.basic) || 0
    const allowances = Number(editing.allowances) || 0
    const bonus = Number(editing.bonus) || 0
    const deductions = Number(editing.deductions) || 0
    const loan = Number(editing.loan) || 0
    const advance = Number(editing.advance) || 0
    const isNew = !editing.id
    // An untouched slip keeps its itemised lines and recovery links; editing
    // basic, allowances, deductions or advance by hand makes it totals-only.
    const untouched = !!original && original.basic === basic && original.allowances === allowances && original.deductions === deductions && (original.advanceDeduction || 0) === advance
    const rec: Payslip = {
      id: editing.id || uid('ps'),
      staffUserId: editing.staffUserId,
      period: editing.period,
      basic,
      allowances,
      bonus,
      deductions,
      loanDeduction: loan,
      loanInstallments: original?.loanInstallments,
      advanceDeduction: advance,
      advanceRepayments: original?.advanceRepayments,
      items: untouched ? original?.items : undefined,
      net: Math.round((basic + allowances + bonus - deductions - loan - advance) * 100) / 100,
      status: isNew ? 'draft' : (original?.status || 'draft'),
      paidAt: original?.paidAt,
    }
    upsertPayslip(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Payroll', `${isNew ? 'Created' : 'Updated'} payslip for ${staffName(rec.staffUserId)} (${rec.period})`)
    toast.success(isNew ? 'Payslip created' : 'Payslip updated')
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        desc="Generate and track staff payslips."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New payslip</Button> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Payslips" value={String(filteredPayslips.length)} icon={<Wallet className="size-4" />} />
        <StatCard label="Paid net" value={formatGhsExact(totalNet)} />
        <StatCard label="Staff" value={String(visibleStaff.length)} />
      </div>

      <div className="card mb-4 mt-4 p-4">
        <StaffListFilters staff={staff} value={staffFilters} onChange={setStaffFilters} />
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Staff</th><th>Period</th><th>Basic</th><th>Allowances</th><th>Bonus</th><th>Deductions</th><th>Loan</th><th>Advance</th><th>Net</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {[...filteredPayslips].sort((a, b) => b.period.localeCompare(a.period)).map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{staffName(p.staffUserId)}</td>
                <td className="text-mist">{formatPeriod(p.period)}</td>
                <td>{formatGhsExact(p.basic)}</td>
                <td>{formatGhsExact(p.allowances)}</td>
                <td className="text-lime">{p.bonus ? `+${formatGhsExact(p.bonus)}` : '—'}</td>
                <td className="text-ember">-{formatGhsExact(p.deductions)}</td>
                <td className="text-ember">{p.loanDeduction ? `-${formatGhsExact(p.loanDeduction)}` : '—'}</td>
                <td className="text-ember">{p.advanceDeduction ? `-${formatGhsExact(p.advanceDeduction)}` : '—'}</td>
                <td className="font-semibold">{formatGhsExact(p.net)}</td>
                <td>
                  {canManage ? (
                    <Select value={p.status} onChange={(e) => markStatus(p, e.target.value as 'draft' | 'paid')}>
                      <option value="draft">draft</option>
                      <option value="paid">paid</option>
                    </Select>
                  ) : (
                    <StatusBadge status={p.status === 'paid' ? 'paid' : 'pending'} />
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setViewing(p)} title="View payslip" aria-label="View payslip"><Eye className="size-4" /></button>
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(p)} aria-label="Edit"><Wallet className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(p)} aria-label="Delete"><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!filteredPayslips.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-mist">No payslips match the current employee filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit payslip' : 'New payslip'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Staff member">
              <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value, basic: String(staffSalary(e.target.value, editing.period)) })}>
                {staff.map((s) => {
                  const u = users.find((x) => x.id === s.userId)
                  return <option key={s.id} value={s.userId}>{u?.name} · {s.title}</option>
                })}
              </Select>
            </Field>
            <Field label="Payroll period"><MonthYearPicker value={editing.period} onChange={(period) => setEditing({ ...editing, period, basic: editing.id ? editing.basic : String(staffSalary(editing.staffUserId, period)) })} className="w-full" aria-label="Payroll period" /></Field>
            <Field label="Basic salary"><Input type="number" min={0} value={editing.basic} onChange={(e) => setEditing({ ...editing, basic: e.target.value })} /></Field>
            <Field label="Allowances"><Input type="number" min={0} value={editing.allowances} onChange={(e) => setEditing({ ...editing, allowances: e.target.value })} /></Field>
            <Field label="Bonus"><Input type="number" min={0} value={editing.bonus} onChange={(e) => setEditing({ ...editing, bonus: e.target.value })} /></Field>
            <Field label="Deductions"><Input type="number" min={0} value={editing.deductions} onChange={(e) => setEditing({ ...editing, deductions: e.target.value })} /></Field>
            <Field label="Loan deduction" hint="Loan installments are added here automatically when payroll is generated; type a figure only to correct a slip by hand."><Input type="number" min={0} value={editing.loan} onChange={(e) => setEditing({ ...editing, loan: e.target.value })} /></Field>
            <Field label="Advance salary recovery" hint="Approved advances are added by Generate Salary and linked recoveries settle when paid. A new manual slip has no advance link; use Generate Salary for automatic recovery."><Input type="number" min={0} value={editing.advance} onChange={(e) => setEditing({ ...editing, advance: e.target.value })} /></Field>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Net pay</p>
              <p className="font-display text-lg">{formatGhsExact((Number(editing.basic) || 0) + (Number(editing.allowances) || 0) + (Number(editing.bonus) || 0) - (Number(editing.deductions) || 0) - (Number(editing.loan) || 0) - (Number(editing.advance) || 0))}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Create payslip'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Payslip — ${staffName(viewing.staffUserId)} · ${formatPeriod(viewing.period)}` : ''}>
        {viewing && (
          <div className="space-y-3">
            <PayslipLines slip={viewing} />
            <p className="text-xs text-mist">
              {viewing.status === 'paid' ? `Paid${viewing.paidAt ? ` on ${viewing.paidAt}` : ''}` : 'Draft — pay it from Salary Payment.'}
              {!!viewing.loanInstallments?.length && ` · ${viewing.loanInstallments.length} loan installment(s) on this slip`}
            </p>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="outline" onClick={() => window.print()}>Print</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete payslip?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete payslip for {staffName(deleting.staffUserId)} ({formatPeriod(deleting.period)})?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deletePayslip(deleting.id); toast.success('Payslip deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
