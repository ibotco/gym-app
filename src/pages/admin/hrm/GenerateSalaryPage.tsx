import { useMemo, useState } from 'react'
import { FileSpreadsheet, Printer, AlertTriangle } from 'lucide-react'
import { PageHeader, Button, Input, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { benefitAmount } from '../../../lib/payroll'
import type { Payslip } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Line { staffUserId: string; basic: number; allowances: number; bonuses: number; deductions: number; net: number }

export function GenerateSalaryPage() {
  const app = useApp()
  const { staff, users, salaryStructures, salaryBenefits, salaryAssignments, payrollAdj, payslips, upsertPayslip, log } = app
  const { user } = useAuth()
  const toast = useToast()
  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [generated, setGenerated] = useState(0)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id

  const lines: Line[] = useMemo(() => {
    const out: Line[] = []
    for (const s of staff) {
      const a = salaryAssignments.find((x) => x.staffUserId === s.userId)
      const st = salaryStructures.find((x) => x.id === a?.structureId)
      if (!st) continue
      const basic = a?.basicOverride ?? st.basic
      let allowances = 0, deductions = 0
      for (const id of st.benefitIds) {
        const b = salaryBenefits.find((x) => x.id === id)
        if (!b) continue
        const amt = benefitAmount(b, basic)
        if (b.kind === 'allowance') allowances += amt
        else deductions += amt
      }
      let bonuses = 0
      for (const adj of payrollAdj.filter((x) => x.staffUserId === s.userId && x.period === period)) {
        if (adj.kind === 'bonus') bonuses += adj.amount
        else deductions += adj.amount
      }
      const net = Math.round((basic + allowances + bonuses - deductions) * 100) / 100
      out.push({ staffUserId: s.userId, basic, allowances: Math.round(allowances * 100) / 100, bonuses, deductions: Math.round(deductions * 100) / 100, net })
    }
    return out.sort((x, y) => staffName(x.staffUserId).localeCompare(staffName(y.staffUserId)))
  }, [staff, salaryAssignments, salaryStructures, salaryBenefits, payrollAdj, period, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const unassigned = staff.length - lines.length
  const totalNet = lines.reduce((s, l) => s + l.net, 0)
  const existingForPeriod = payslips.filter((p) => p.period === period)

  const generate = () => {
    if (!lines.length) { toast.error('No staff with a salary structure assigned.'); return }
    for (const l of lines) {
      const existing = existingForPeriod.find((p) => p.staffUserId === l.staffUserId)
      const rec: Payslip = {
        id: existing?.id || uid('ps'),
        staffUserId: l.staffUserId,
        period,
        basic: l.basic,
        allowances: l.allowances + l.bonuses,
        deductions: l.deductions,
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

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Generate Salary</span>
      </div>
      <PageHeader
        title="Generate Salary"
        desc="Compute payslips for a period from assigned structures, benefits and one-off items — then create draft slips."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Payroll period</p>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="max-w-[170px]" aria-label="Period" />
        </div>
        <div className="text-sm text-mist">
          <p><span className="font-bold text-inherit">{lines.length}</span> staff ready · <span className="font-bold text-inherit">{ghs(totalNet)}</span> total net</p>
          {unassigned > 0 && <p className="flex items-center gap-1 text-amber-500"><AlertTriangle className="size-3.5" /> {unassigned} staff without a structure will be skipped.</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {existingForPeriod.length > 0 && <Badge tone="amber">{existingForPeriod.length} existing slip(s) — will be recalculated</Badge>}
          <ExportButtons filename={`payroll-preview-${period}`} rows={lines.map((l) => ({
            Staff: staffName(l.staffUserId), Basic: l.basic, Allowances: l.allowances, Bonuses: l.bonuses, Deductions: l.deductions, Net: l.net,
          }))} />
          <Button onClick={generate}><FileSpreadsheet className="size-4" /> Generate payslips</Button>
        </div>
      </div>

      {generated > 0 && <p className="mb-3 text-sm font-bold text-lime">✓ {generated} payslips created/updated for {period} — pay them from Salary Payment.</p>}

      {/* Preview */}
      <div className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-3 text-sm font-extrabold">Preview — {period}</p>
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3 text-right">Basic</th>
              <th className="px-3 py-3 text-right">Allowances</th>
              <th className="px-3 py-3 text-right">Bonuses</th>
              <th className="px-3 py-3 text-right">Deductions</th>
              <th className="px-3 py-3 text-right">Net pay</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.staffUserId} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                <td className="px-3 py-2.5 font-bold">{staffName(l.staffUserId)}</td>
                <td className="px-3 py-2.5 text-right">{ghs(l.basic)}</td>
                <td className="px-3 py-2.5 text-right text-lime">+ {ghs(l.allowances)}</td>
                <td className="px-3 py-2.5 text-right text-lime">{l.bonuses ? `+ ${ghs(l.bonuses)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-rose-400">{l.deductions ? `− ${ghs(l.deductions)}` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(l.net)}</td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">Assign salary structures first (Payroll → Assign Salary).</td></tr>}
          </tbody>
          {!!lines.length && (
            <tfoot>
              <tr className="bg-black/[0.02] font-extrabold dark:bg-white/[0.03]">
                <td className="px-3 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.basic, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.allowances, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.bonuses, 0))}</td>
                <td className="px-3 py-2.5 text-right">{ghs(lines.reduce((s, l) => s + l.deductions, 0))}</td>
                <td className="px-3 py-2.5 text-right text-lime">{ghs(totalNet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-mist"><Printer className="size-3" /> Paid slips can be printed as cheques from Payment Cheque.</p>
    </div>
  )
}
