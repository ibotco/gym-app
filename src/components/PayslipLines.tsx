import type { Payslip } from '../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * The itemised body of a payslip — what the individual actually receives, line
 * by line: basic, allowances, their bonus, then every deduction, loan repayment
 * and salary-advance recovery, and the net pay at the foot.
 *
 * Slips written by Generate Salary carry `items` (one line per allowance, bonus,
 * deduction, loan installment and advance installment). Older slips and hand-made
 * ones carry only the totals, so the same layout is built from those instead.
 */
export function PayslipLines({ slip, showTotals = true }: { slip: Payslip; showTotals?: boolean }) {
  const bonus = slip.bonus || 0
  const loan = slip.loanDeduction || 0
  const advance = slip.advanceDeduction || 0
  const items = slip.items || []

  const earnings = items.filter((i) => i.kind === 'earning')
  const deductionLines = items.filter((i) => i.kind === 'deduction')

  const gross = Math.round((slip.basic + slip.allowances + bonus) * 100) / 100
  const totalDeductions = Math.round((slip.deductions + loan + advance) * 100) / 100

  const row = (label: string, amount: number, kind: 'earning' | 'deduction' | 'plain', bold = false, key?: string) => (
    <p key={key ?? label} className={`flex items-center justify-between gap-2 ${bold ? 'font-bold' : ''}`}>
      <span className="text-mist">{label}</span>
      <span className={kind === 'earning' ? 'font-semibold text-lime' : kind === 'deduction' ? 'font-semibold text-rose-400' : 'font-semibold'}>
        {kind === 'earning' ? '+ ' : kind === 'deduction' ? '− ' : ''}{ghs(amount)}
      </span>
    </p>
  )

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1 rounded-xl border border-line p-3">
        {row('Basic salary', slip.basic, 'plain')}

        {/* Allowances, then any bonus — itemised when the slip has the lines. */}
        {earnings.length ? (
          earnings.map((i, n) => row(i.label, i.amount, 'earning', false, `${i.label}-${n}`))
        ) : (
          <>
            {slip.allowances > 0 && row('Allowances', slip.allowances, 'earning')}
            {bonus > 0 && row('Bonus', bonus, 'earning')}
          </>
        )}

        {showTotals && (
          <p className="flex items-center justify-between border-t border-line pt-1">
            <span className="text-mist">Total earnings</span>
            <span className="font-bold">{ghs(gross)}</span>
          </p>
        )}
      </div>

      <div className="space-y-1 rounded-xl border border-line p-3">
        {deductionLines.length ? (
          deductionLines.map((i, n) => (
            <p key={`${i.label}-${n}`} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-mist">
                {i.label}
                {i.loanId && <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-white/10">loan</span>}
                {i.advanceId && <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-white/10">advance</span>}
              </span>
              <span className="font-semibold text-rose-400">− {ghs(i.amount)}</span>
            </p>
          ))
        ) : (
          <>
            {slip.deductions > 0 && row('Deductions', slip.deductions, 'deduction')}
            {loan > 0 && row('Loan repayment', loan, 'deduction')}
            {advance > 0 && row('Salary advance repayment', advance, 'deduction')}
          </>
        )}
        {showTotals && (
          <p className="flex items-center justify-between border-t border-line pt-1">
            <span className="text-mist">Total deductions</span>
            <span className="font-bold text-rose-400">{ghs(totalDeductions)}</span>
          </p>
        )}
      </div>

      <p className="flex items-center justify-between rounded-xl border border-line bg-black/[0.02] px-3 py-2 text-base font-extrabold dark:bg-white/[0.03]">
        <span>Net pay</span>
        <span className="text-lime">{ghs(slip.net)}</span>
      </p>
    </div>
  )
}
