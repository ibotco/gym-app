import { useMemo, useState } from 'react'
import { FileSpreadsheet, Printer, AlertTriangle, Plus, Trash2, Gift, MinusCircle, Wallet } from 'lucide-react'
import { PageHeader, Button, Input, MonthYearPicker, Badge, Modal, Field, Select, Textarea } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { StaffListFilters } from '../../../components/StaffListFilters'
import { emptyStaffListFilters, matchesStaffListFilters, type StaffListFilterValues } from '../../../lib/staffListFilters'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { planPayslip, type PlannedPayslip } from '../../../lib/payroll'
import { loadSalaryAdvances } from '../../../lib/advanceSalary'
import { loadSalaryIncreaseSettings, salaryBasicForPeriod } from '../../../lib/salaryIncreases'
import type { PayrollAdjItem, Payslip } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Line extends PlannedPayslip { staffUserId: string }

export function GenerateSalaryPage() {
  const app = useApp()
  const {
    staff, users, salaryStructures, salaryBenefits, salaryAssignments, payrollAdj, payslips,
    loans, loanInstallments, loanPolicy, upsertPayslip, upsertPayrollAdj, deletePayrollAdj, log,
  } = app
  const { user } = useAuth()
  const toast = useToast()
  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [staffFilters, setStaffFilters] = useState<StaffListFilterValues>(emptyStaffListFilters)
  const [generated, setGenerated] = useState(0)
  /** Approved advances are stored with the Advance Salary register and belong to their staff member. */
  const [advances] = useState(() => loadSalaryAdvances())
  const [salaryIncreaseSettings] = useState(() => loadSalaryIncreaseSettings())
  /** The individual whose one-off items are being edited. */
  const [extrasFor, setExtrasFor] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState<{ kind: 'bonus' | 'deduction'; amount: string; note: string }>({ kind: 'bonus', amount: '', note: '' })

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id

  /** This individual's own one-off items for the period, newest first. */
  const oneOffsOf = (staffUserId: string) =>
    payrollAdj.filter((x) => x.staffUserId === staffUserId && x.period === period)

  const allLines: Line[] = useMemo(() => {
    const out: Line[] = []
    for (const s of staff) {
      const a = salaryAssignments.find((x) => x.staffUserId === s.userId)
      const st = salaryStructures.find((x) => x.id === a?.structureId)
      if (!st) continue
      // One individual's pay: their structure, one-offs, loans and approved
      // salary advances — the same planner the payslip itself is stored from.
      const existing = payslips.find((p) => p.staffUserId === s.userId && p.period === period)
      const person = users.find((u) => u.id === s.userId)
      const adjustedBasic = salaryBasicForPeriod({
        baseBasic: a?.basicOverride ?? st.basic,
        staffUserId: s.userId,
        period,
        hireDate: s.hireDate,
        department: s.department,
        salaryStructureId: a?.structureId,
        active: person?.status === 'active',
        settings: salaryIncreaseSettings,
      })
      const plan = planPayslip({
        structure: st,
        benefits: salaryBenefits,
        basicOverride: adjustedBasic,
        oneOffs: oneOffsOf(s.userId),
        advances,
        loans,
        installments: loanInstallments,
        payslips,
        policy: loanPolicy,
        staffUserId: s.userId,
        period,
        keepPayslipId: existing?.id,
      })
      out.push({ staffUserId: s.userId, ...plan })
    }
    return out.sort((x, y) => staffName(x.staffUserId).localeCompare(staffName(y.staffUserId)))
  }, [staff, salaryAssignments, salaryStructures, salaryBenefits, payrollAdj, period, users, advances, loans, loanInstallments, loanPolicy, payslips, salaryIncreaseSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredStaff = useMemo(() => staff.filter((record) => matchesStaffListFilters(
    record,
    users,
    staffFilters,
  )), [staff, users, staffFilters])
  const lines = useMemo(() => allLines.filter((line) => filteredStaff.some((record) => record.userId === line.staffUserId)), [allLines, filteredStaff])
  const unassigned = filteredStaff.length - lines.length
  const totalNet = lines.reduce((s, l) => s + l.net, 0)
  const existingForPeriod = payslips.filter((p) => p.period === period)
  const existingForVisibleLines = lines.filter((line) => existingForPeriod.some((slip) => slip.staffUserId === line.staffUserId)).length

  const generate = () => {
    if (!lines.length) { toast.error('No staff with a salary structure assigned.'); return }
    for (const l of lines) {
      const existing = existingForPeriod.find((p) => p.staffUserId === l.staffUserId)
      const rec: Payslip = {
        id: existing?.id || uid('ps'),
        staffUserId: l.staffUserId,
        period,
        basic: l.basic,
        allowances: l.allowances,
        bonus: l.bonus,
        deductions: l.deductions,
        loanDeduction: l.loanDeduction,
        loanInstallments: l.loanInstallments,
        advanceDeduction: l.advanceDeduction,
        advanceRepayments: l.advanceRepayments,
        items: l.items,
        net: l.net,
        status: existing?.status || 'draft',
        paidAt: existing?.paidAt,
      }
      upsertPayslip(rec)
    }
    log(user?.id || 'system', 'CREATE', 'Payroll', `Generated ${lines.length} payslips for ${period}`)
    toast.success('Payroll generated', `${lines.length} draft payslip(s) for ${period}`)
    setGenerated(lines.length)
  }

  const addExtra = () => {
    if (!extrasFor) return
    const amount = Number(extraForm.amount)
    if (!extraForm.amount || !Number.isFinite(amount) || amount <= 0) { toast.error('Enter an amount greater than zero.'); return }
    upsertPayrollAdj({
      id: uid('pa'),
      staffUserId: extrasFor,
      period,
      kind: extraForm.kind,
      amount: Math.round(amount * 100) / 100,
      note: extraForm.note.trim() || undefined,
    })
    toast.success(extraForm.kind === 'bonus' ? 'Bonus added' : 'Deduction added', `${staffName(extrasFor)} · ${period}`)
    setExtraForm({ kind: extraForm.kind, amount: '', note: '' })
  }

  const extrasStaff = extrasFor ? staffName(extrasFor) : ''
  const extrasLines = extrasFor ? allLines.find((l) => l.staffUserId === extrasFor) : undefined

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Generate Salary</span>
      </div>
      <PageHeader
        title="Generate Salary"
        desc="Compute each employee’s pay from their structure, scheduled salary increases, benefits, approved advances, loans and one-off items — then create draft slips."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Payroll period</p>
          <MonthYearPicker value={period} onChange={setPeriod} className="w-[320px] max-w-full" aria-label="Payroll period" />
        </div>
        <div className="text-sm text-mist">
          <p><span className="font-bold text-inherit">{lines.length}</span> staff ready · <span className="font-bold text-inherit">{ghs(totalNet)}</span> total net</p>
          {unassigned > 0 && <p className="flex items-center gap-1 text-amber-500"><AlertTriangle className="size-3.5" /> {unassigned} staff without a structure will be skipped.</p>}
          {!loanPolicy.autoDeduct && <p className="flex items-center gap-1 text-amber-500"><AlertTriangle className="size-3.5" /> Loan installments are not deducted at source (Loan Settings) — no loan line will be added.</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {existingForVisibleLines > 0 && <Badge tone="amber">{existingForVisibleLines} existing slip(s) — will be recalculated</Badge>}
          <ExportButtons filename={`payroll-preview-${period}`} rows={lines.map((l) => ({
            Staff: staffName(l.staffUserId), Basic: l.basic, Allowances: l.allowances, Bonus: l.bonus, Deductions: l.deductions, Loan: l.loanDeduction, 'Advance recovery': l.advanceDeduction, Net: l.net,
            'One-off items': l.items.filter((i) => i.adjId).map((i) => `${i.label} ${i.kind === 'earning' ? '+' : '−'}${i.amount}`).join('; '),
          }))} />
          <Button onClick={generate}><FileSpreadsheet className="size-4" /> Generate payslips</Button>
        </div>
      </div>
      <div className="card mb-4 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-mist">Filter employees for this payroll run</p>
        <StaffListFilters staff={staff} value={staffFilters} onChange={setStaffFilters} />
      </div>

      {generated > 0 && <p className="mb-3 text-sm font-bold text-lime">✓ {generated} payslips created/updated for {period} — pay them from Salary Payment.</p>}

      {/* Preview */}
      <div className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-3 text-sm font-extrabold">Preview — {period}</p>
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3 text-right">Basic</th>
              <th className="px-3 py-3 text-right">Allowances</th>
              <th className="px-3 py-3 text-right">Bonus</th>
              <th className="px-3 py-3 text-right">Deductions</th>
              <th className="px-3 py-3 text-right">Loan</th>
              <th className="px-3 py-3 text-right">Advance</th>
              <th className="px-3 py-3 text-right">Net pay</th>
              <th className="px-3 py-3 text-right">One-off items</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.staffUserId} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                <td className="px-3 py-2.5 font-bold">{staffName(l.staffUserId)}</td>
                <td className="px-3 py-2.5 text-right">{ghs(l.basic)}</td>
                <td className="px-3 py-2.5 text-right text-lime">+ {ghs(l.allowances)}</td>
                <td className="px-3 py-2.5 text-right text-lime">{l.bonus ? `+ ${ghs(l.bonus)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{l.deductions ? `− ${ghs(l.deductions)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{l.loanDeduction ? `− ${ghs(l.loanDeduction)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{l.advanceDeduction ? `− ${ghs(l.advanceDeduction)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(l.net)}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => { setExtrasFor(l.staffUserId); setExtraForm({ kind: 'bonus', amount: '', note: '' }) }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-mist hover:text-lime"
                    title="Give this individual a bonus or deduction for this period"
                  >
                    <Wallet className="size-3.5" /> {oneOffsOf(l.staffUserId).length ? `${oneOffsOf(l.staffUserId).length} item(s)` : 'Add bonus / deduction'}
                  </button>
                </td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-mist">Assign salary structures first (Payroll → Assign Salary).</td></tr>}
          </tbody>
          {!!lines.length && (
            <tfoot>
              <tr className="bg-black/[0.02] font-extrabold dark:bg-white/[0.03]">
                <td className="px-3 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.basic, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.allowances, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.bonus, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.deductions, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.loanDeduction, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.advanceDeduction, 0))}</td>
                <td className="px-3 py-2.5 text-right text-lime">{ghs(totalNet)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-mist"><Printer className="size-3" /> Paid slips can be printed as cheques from Payment Cheque.</p>

      {/* One-off items for one individual */}
      <Modal open={!!extrasFor} onClose={() => setExtrasFor(null)} title={extrasFor ? `One-off items — ${extrasStaff} · ${period}` : ''}>
        {extrasFor && (
          <div className="space-y-4">
            <p className="text-xs text-mist">
              A bonus here is added to <span className="font-semibold text-inherit">{extrasStaff}</span>'s pay for {period} only, and a deduction is taken from it. Both appear as their own lines on the payslip.
            </p>

            <div className="rounded-xl border border-line p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist">On this payslip</p>
              {extrasLines && (extrasLines.bonus || extrasLines.loanDeduction || extrasLines.advanceDeduction || extrasLines.items.some((i) => i.adjId)) ? (
                <div className="space-y-1 text-sm">
                  {extrasLines.items.filter((i) => i.adjId).map((i, n) => (
                    <p key={n} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mist">
                        {i.kind === 'earning' ? <Gift className="size-3.5 text-lime" /> : <MinusCircle className="size-3.5 text-rose-400" />}
                        {i.label}
                      </span>
                      <span className={i.kind === 'earning' ? 'font-semibold text-lime' : 'font-semibold text-rose-400'}>
                        {i.kind === 'earning' ? '+' : '−'} {ghs(i.amount)}
                      </span>
                    </p>
                  ))}
                  {extrasLines.loanLines.map((ln) => (
                    <p key={ln.installmentId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mist"><MinusCircle className="size-3.5 text-rose-400" /> {ln.label}</span>
                      <span className="font-semibold text-rose-400">− {ghs(ln.amount)}</span>
                    </p>
                  ))}
                  {extrasLines.advanceLines.map((ln) => (
                    <p key={ln.advanceId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mist"><MinusCircle className="size-3.5 text-rose-400" /> {ln.label}</span>
                      <span className="font-semibold text-rose-400">− {ghs(ln.amount)}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-mist">No bonus, deduction, loan or salary-advance repayment on this period's payslip yet.</p>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[130px_1fr]">
              <Field label="Type">
                <Select value={extraForm.kind} onChange={(e) => setExtraForm({ ...extraForm, kind: e.target.value as 'bonus' | 'deduction' })}>
                  <option value="bonus">Bonus</option>
                  <option value="deduction">Deduction</option>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Amount (GHS)" required><Input type="number" min={0} step="0.01" value={extraForm.amount} onChange={(e) => setExtraForm({ ...extraForm, amount: e.target.value })} placeholder="e.g. 250" /></Field>
                <Field label="Note"><Textarea value={extraForm.note} onChange={(e) => setExtraForm({ ...extraForm, note: e.target.value })} placeholder="e.g. August performance bonus" className="placeholder:italic" /></Field>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addExtra}><Plus className="size-4" /> Add {extraForm.kind === 'bonus' ? 'bonus' : 'deduction'}</Button>
            </div>

            <div className="rounded-xl border border-line">
              <p className="border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-mist">Already added for {period}</p>
              {oneOffsOf(extrasFor).length ? (
                <div className="divide-y divide-line">
                  {oneOffsOf(extrasFor).map((adj) => (
                    <div key={adj.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-mist">
                        {adj.kind === 'bonus' ? 'Bonus' : 'Deduction'}{adj.note ? ` — ${adj.note}` : ''}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={adj.kind === 'bonus' ? 'font-semibold text-lime' : 'font-semibold text-rose-400'}>
                          {adj.kind === 'bonus' ? '+' : '−'} {ghs(adj.amount)}
                        </span>
                        <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Remove" aria-label={`Remove ${adj.note || adj.kind}`} onClick={() => { deletePayrollAdj(adj.id); toast.success('Item removed', staffName(extrasFor)) }}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-3 text-sm text-mist">Nothing added for this individual in {period}.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-mist">Net pay with these items</span>
              <span className="font-display text-lg">{ghs(extrasLines?.net ?? 0)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtrasFor(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
