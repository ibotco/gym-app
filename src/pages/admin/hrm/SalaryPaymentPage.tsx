import { useMemo, useState } from 'react'
import { Banknote, Check, CheckCheck, Printer, Trash2 } from 'lucide-react'
import { PageHeader, Button, MonthYearPicker, Select, Badge, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { StaffListFilters } from '../../../components/StaffListFilters'
import { emptyStaffListFilters, matchesStaffUserId, type StaffListFilterValues } from '../../../lib/staffListFilters'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { PayslipLines } from '../../../components/PayslipLines'
import { planLoanSettlement } from '../../../lib/loans'
import { loadSalaryAdvances, planAdvanceSettlement, saveSalaryAdvances } from '../../../lib/advanceSalary'
import type { Payslip } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatSalaryMonth = (period: string) => {
  const [year, month] = period.split('-').map(Number)
  if (!year || month < 1 || month > 12) return period
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function SalaryPaymentPage() {
  const {
    payslips, users, staff, paymentModes, loans, loanInstallments,
    upsertPayslip, upsertLoan, setLoanInstallments, deletePayslip, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [statusF, setStatusF] = useState('')
  const [staffFilters, setStaffFilters] = useState<StaffListFilterValues>(emptyStaffListFilters)
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<string | null>(null)
  const [paymentQueue, setPaymentQueue] = useState<string[]>([])
  const [paymentQueueTotal, setPaymentQueueTotal] = useState(0)
  const [clearSelectionAfterPay, setClearSelectionAfterPay] = useState(false)
  const [payVia, setPayVia] = useState('')
  const [paymentError, setPaymentError] = useState('')

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const rows = useMemo(() => [...payslips]
    .filter((p) => (!period || p.period === period) && (!statusF || p.status === statusF))
    .filter((p) => matchesStaffUserId(p.staffUserId, staff, users, staffFilters))
    .sort((a, b) => b.period.localeCompare(a.period)), [payslips, period, statusF, staff, users, staffFilters])
  const activePaymentModes = useMemo(() => paymentModes.filter((mode) => mode.status === 'active'), [paymentModes])

  const totals = useMemo(() => ({
    net: rows.reduce((s, p) => s + p.net, 0),
    paid: rows.filter((p) => p.status === 'paid').reduce((s, p) => s + p.net, 0),
    draft: rows.filter((p) => p.status === 'draft').reduce((s, p) => s + p.net, 0),
  }), [rows])

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const selectableRows = rows.filter((p) => p.status === 'draft')
  const allSelected = selectableRows.length > 0 && selectableRows.every((p) => selected.includes(p.id))
  const selectedDraftIds = selectableRows.filter((p) => selected.includes(p.id)).map((p) => p.id)

  /**
   * Paying a salary settles that individual's carried loan installments and
   * salary advance recoveries. Loan installments are marked paid, a fully
   * repaid loan is completed, and advances advance their recovery count once.
   */
  const settleLoans = (slips: Payslip[], today: string) => {
    let installments = loanInstallments
    let settled = 0
    const completed: string[] = []
    for (const slip of slips) {
      const res = planLoanSettlement(slip, installments, loans, today)
      installments = res.installments
      settled += res.settled
      completed.push(...res.completedLoanIds)
    }
    if (settled) setLoanInstallments(installments)
    for (const id of completed) {
      const loan = loans.find((l) => l.id === id)
      if (loan) upsertLoan({ ...loan, status: 'completed' })
    }
    return { settled, completed: completed.length }
  }

  /** Recover the salary advances carried by the paid slips, once per person/month. */
  const settleAdvances = (slips: Payslip[]) => {
    let advances = loadSalaryAdvances()
    let settled = 0
    let total = 0
    const completed: string[] = []
    for (const slip of slips) {
      const res = planAdvanceSettlement(slip, advances)
      advances = res.advances
      settled += res.settled
      total += res.total
      completed.push(...res.completedAdvanceIds)
    }
    if (settled) saveSalaryAdvances(advances)
    return { settled, total: Math.round(total * 100) / 100, completed: completed.length }
  }

  const markPaid = (ids: string[], paymentMode: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const justPaid: Payslip[] = []
    for (const id of ids) {
      const p = payslips.find((x) => x.id === id)
      if (p && p.status !== 'paid') {
        const rec = { ...p, status: 'paid' as const, paidAt: today, paidVia: paymentMode }
        upsertPayslip(rec)
        justPaid.push(rec)
      }
    }
    const { settled, completed } = settleLoans(justPaid, today)
    const advances = settleAdvances(justPaid)
    const parts = [
      settled ? `${settled} loan installment(s) settled${completed ? `, ${completed} loan(s) completed` : ''}` : '',
      advances.settled ? `${advances.settled} salary advance installment(s) recovered${advances.completed ? `, ${advances.completed} advance(s) recovered in full` : ''}` : '',
    ].filter(Boolean)
    log(user?.id || 'system', 'UPDATE', 'Payroll', `Marked ${justPaid.length} payslip(s) paid via ${paymentMode}${parts.length ? `, ${parts.join(', ')}` : ''}`)
    toast.success('Marked as paid', `${justPaid.length} payslip(s) via ${paymentMode}${parts.length ? ` · ${parts.join(' · ')}` : ''}`)
  }

  const requestPayment = (ids: string[], clearSelectionOnComplete = false) => {
    const queue = [...new Set(ids)].filter((id) => payslips.some((p) => p.id === id && p.status === 'draft'))
    if (!queue.length) {
      if (clearSelectionOnComplete) toast.error('No unpaid payslips selected')
      return
    }
    setPaymentQueue(queue)
    setPaymentQueueTotal(queue.length)
    setClearSelectionAfterPay(clearSelectionOnComplete)
    setPayVia('')
    setPaymentError('')
  }

  const closePaymentConfirmation = () => {
    setPaymentQueue([])
    setPaymentQueueTotal(0)
    setClearSelectionAfterPay(false)
    setPayVia('')
    setPaymentError('')
  }

  const paymentSlip = paymentQueue.length
    ? payslips.find((p) => p.id === paymentQueue[0] && p.status === 'draft')
    : undefined

  const confirmPayment = () => {
    if (!paymentSlip) {
      closePaymentConfirmation()
      return
    }
    if (!payVia || !activePaymentModes.some((mode) => mode.name === payVia)) {
      setPaymentError('Select an active payment method before confirming.')
      return
    }

    markPaid([paymentSlip.id], payVia)
    setSelected((ids) => ids.filter((id) => id !== paymentSlip.id))
    setPayVia('')
    setPaymentError('')
    if (paymentQueue.length > 1) {
      setPaymentQueue((queue) => queue.slice(1))
      return
    }

    setPaymentQueue([])
    setPaymentQueueTotal(0)
    if (clearSelectionAfterPay) setSelected([])
    setClearSelectionAfterPay(false)
    if (detail === paymentSlip.id) setDetail(null)
  }

  const remove = (id: string) => {
    deletePayslip(id)
    log(user?.id || 'system', 'DELETE', 'Payroll', 'Deleted payslip')
    toast.success('Payslip deleted')
    setDetail(null)
  }

  const detailSlip = payslips.find((p) => p.id === detail)
  const employeeRecord = paymentSlip && staff.find((s) => s.userId === paymentSlip.staffUserId)
  const paymentProgress = paymentQueueTotal > 1 ? paymentQueueTotal - paymentQueue.length + 1 : 0

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Salary Payment</span>
      </div>
      <PageHeader
        title="Salary Payment"
        desc="Review generated payslips and release payments — individually or in bulk."
      />

      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonthYearPicker value={period} onChange={setPeriod} className="w-[320px] max-w-full" aria-label="Payroll period" />
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[150px]" aria-label="Status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </Select>
        <Badge tone="zinc">Net {ghs(totals.net)}</Badge>
        <Badge tone="lime">Paid {ghs(totals.paid)}</Badge>
        <Badge tone="amber">Outstanding {ghs(totals.draft)}</Badge>
        <div className="ml-auto flex items-center gap-2">
          {canManage && selectedDraftIds.length > 0 && (
            <Button onClick={() => requestPayment(selectedDraftIds, true)}><CheckCheck className="size-4" /> Pay selected ({selectedDraftIds.length})</Button>
          )}
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename={`salary-payment-${period}`} rows={rows.map((p) => ({
            Staff: staffName(p.staffUserId), Period: p.period, Basic: p.basic, Allowances: p.allowances, Bonus: p.bonus || 0, Deductions: p.deductions, 'Loan deduction': p.loanDeduction || 0, 'Advance recovery': p.advanceDeduction || 0, Net: p.net, Status: p.status, 'Paid at': p.paidAt || '', 'Paid via': p.paidVia || '',
          }))} />
        </div>
      </div>
      <div className="card mb-4 p-4">
        <StaffListFilters staff={staff} value={staffFilters} onChange={setStaffFilters} />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              {canManage && (
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="accent-[#c8f542]" checked={allSelected} onChange={() => setSelected(allSelected ? [] : selectableRows.map((p) => p.id))} aria-label="Select all unpaid payslips" />
                </th>
              )}
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3">Period</th>
              <th className="px-3 py-3 text-right">Basic</th>
              <th className="px-3 py-3 text-right">Allow.</th>
              <th className="px-3 py-3 text-right">Deduct.</th>
              <th className="px-3 py-3 text-right">Loan</th>
              <th className="px-3 py-3 text-right">Advance</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                {canManage && (
                  <td className="px-3 py-2.5">
                    <input type="checkbox" className="accent-[#c8f542]" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} disabled={p.status === 'paid'} aria-label={`Select ${staffName(p.staffUserId)}`} />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <button className="font-bold hover:text-lime" onClick={() => setDetail(p.id)}>{staffName(p.staffUserId)}</button>
                </td>
                <td className="px-3 py-2.5 text-mist">{p.period}</td>
                <td className="px-3 py-2.5 text-right">{ghs(p.basic)}</td>
                <td className="px-3 py-2.5 text-right text-lime">+ {ghs(p.allowances)}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">− {ghs(p.deductions)}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{p.loanDeduction ? `− ${ghs(p.loanDeduction)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{p.advanceDeduction ? `− ${ghs(p.advanceDeduction)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(p.net)}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={p.status === 'paid' ? 'lime' : 'amber'}>{p.status === 'paid' && p.paidAt ? `paid ${p.paidAt}` : 'draft'}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center justify-end gap-1">
                    {canManage && p.status === 'draft' && (
                      <Button size="sm" onClick={() => requestPayment([p.id])}><Banknote className="size-3.5" /> Pay</Button>
                    )}
                    {canManage && (
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDetail(p.id)}><Trash2 className="size-4" /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-10 text-center text-mist">No payslips match this payroll period and employee selection.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <Modal open={!!detailSlip} onClose={() => setDetail(null)} title={detailSlip ? `Payslip — ${staffName(detailSlip.staffUserId)}` : ''}>
        {detailSlip && (
          <div className="space-y-3 text-sm">
            <p className="flex justify-between rounded-xl border border-line p-3">
              <span className="text-mist">Period</span><span className="font-bold">{detailSlip.period}</span>
            </p>
            <PayslipLines slip={detailSlip} />
            <p className="text-xs text-mist">
              Status: {detailSlip.status}{detailSlip.paidAt ? ` on ${detailSlip.paidAt}` : ''}
              {detailSlip.paidVia ? ` · paid via ${detailSlip.paidVia}` : ''}
              {!!detailSlip.loanInstallments?.length && ` · pays ${detailSlip.loanInstallments.length} loan installment(s)`}
              {!!detailSlip.advanceRepayments?.length && ` · recovers ${detailSlip.advanceRepayments.length} salary advance installment(s)`}
            </p>
            {canManage && (
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                {detailSlip.status === 'draft' && <Button onClick={() => requestPayment([detailSlip.id])}><Banknote className="size-4" /> Mark paid</Button>}
                <Button variant="danger" onClick={() => remove(detailSlip.id)}><Trash2 className="size-4" /> Delete</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Salary payment confirmation — styled like the payslip detail modal. */}
      <Modal
        open={paymentQueue.length > 0}
        onClose={closePaymentConfirmation}
        title={paymentSlip ? `Confirm Salary — ${staffName(paymentSlip.staffUserId)}` : 'Confirm salary payment'}
      >
        {paymentSlip && (
          <div className="space-y-3 text-sm">
            {paymentQueueTotal > 1 && (
              <p className="text-right text-xs font-semibold text-mist">Payment {paymentProgress} of {paymentQueueTotal}</p>
            )}
            <div className="space-y-1 rounded-xl border border-line p-3">
              <p className="flex items-center justify-between gap-3">
                <span className="text-mist">Employee number</span>
                <span className="text-right font-bold">{employeeRecord?.employeeNumber || employeeRecord?.id || '—'}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-mist">Designation</span>
                <span className="text-right font-bold">{employeeRecord?.staffDesignation || employeeRecord?.title || employeeRecord?.department || '—'}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-mist">Salary month</span>
                <span className="text-right font-bold">{formatSalaryMonth(paymentSlip.period)}</span>
              </p>
            </div>

            <PayslipLines slip={paymentSlip} />

            <div>
              <label htmlFor="salary-payment-mode" className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
                Pay Via <span className="text-rose-500">*</span>
              </label>
              <Select
                id="salary-payment-mode"
                value={payVia}
                onChange={(event) => { setPayVia(event.target.value); setPaymentError('') }}
                required
                aria-label="Pay Via"
                aria-invalid={!!paymentError}
                placeholder="Please Select..."
                className="w-full"
              >
                <option value="" disabled>Please Select...</option>
                {activePaymentModes.map((mode) => <option key={mode.id} value={mode.name}>{mode.name}</option>)}
              </Select>
              {activePaymentModes.length === 0 && (
                <p className="mt-1 text-xs text-rose-400">No active payment modes. Add one in Accounting Settings before paying.</p>
              )}
              {paymentError && <p role="alert" className="mt-1 text-xs text-rose-400">{paymentError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="outline" onClick={closePaymentConfirmation}>Cancel</Button>
              <Button onClick={confirmPayment} disabled={!paymentSlip || activePaymentModes.length === 0}>
                Confirm <Check className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
