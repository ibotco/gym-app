import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Banknote, X } from 'lucide-react'
import { PageHeader, Button, Input, Select, Badge } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { amountInWords } from '../../../lib/payroll'
import { formatDate } from '../../../lib/utils'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PaymentChequePage() {
  const { payslips, users } = useApp()
  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [statusF, setStatusF] = useState('')
  const [chequeId, setChequeId] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.toggle('project-sheet-print', !!chequeId)
    return () => document.body.classList.remove('project-sheet-print')
  }, [chequeId])

  const rows = useMemo(() => [...payslips]
    .filter((p) => (!period || p.period === period) && (!statusF || p.status === statusF))
    .sort((a, b) => b.net - a.net), [payslips, period, statusF])

  const slip = payslips.find((p) => p.id === chequeId)
  const payee = slip ? users.find((u) => u.id === slip.staffUserId)?.name || slip.staffUserId : ''

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Payment Cheque</span>
      </div>
      <PageHeader
        title="Payment Cheque"
        desc="Print a bank cheque for any payslip — amount in words, payee and signatories on a clean A4 sheet."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="max-w-[170px]" aria-label="Period" />
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[150px]" aria-label="Status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="draft">Draft</option>
        </Select>
        <span className="text-xs text-mist">{rows.length} payslip(s) in period</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Payee</th><th className="px-3 py-3">Period</th><th className="px-3 py-3 text-right">Net pay</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Cheque</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                <td className="px-3 py-2.5 font-bold">{users.find((u) => u.id === p.staffUserId)?.name || p.staffUserId}</td>
                <td className="px-3 py-2.5 text-mist">{p.period}</td>
                <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(p.net)}</td>
                <td className="px-3 py-2.5"><Badge tone={p.status === 'paid' ? 'lime' : 'amber'}>{p.status}</Badge></td>
                <td className="px-3 py-2.5 text-right">
                  <Button size="sm" variant="soft" onClick={() => setChequeId(p.id)}><Banknote className="size-3.5" /> Cheque</Button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-mist">No payslips for this period.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Cheque sheet */}
      {typeof document !== 'undefined' && createPortal(
        <div className={`project-sheet-layer fixed inset-0 z-[10000] overflow-y-auto bg-black/60 p-4 ${chequeId ? 'block' : 'hidden'}`} role="dialog" aria-modal="true" aria-label="Cheque print preview">
          <div className="mx-auto w-full max-w-4xl py-8">
            <div className="no-print mb-4 flex justify-end gap-2 rounded-xl border border-white/10 bg-zinc-900/90 p-3 backdrop-blur">
              <Button onClick={() => window.print()}><Printer className="size-4" /> Print cheque</Button>
              <Button variant="outline" onClick={() => setChequeId(null)}><X className="size-4" /> Close</Button>
            </div>
            {slip && (
              <section className="report-page">
                <div className="rounded-md border-2 border-black p-6 text-black">
                  <div className="flex items-start justify-between border-b-2 border-black pb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em]">Payroll Payment Cheque</p>
                      <p className="mt-1 text-lg font-extrabold">FitPro Gym Ltd</p>
                    </div>
                    <div className="text-right text-[11px]">
                      <p className="font-bold">No: {slip.id.slice(-6).toUpperCase()}</p>
                      <p>Date: {formatDate(slip.paidAt || new Date().toISOString().slice(0, 10))}</p>
                      <p>Period: {slip.period}</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-5 text-[13px]">
                    <p><span className="font-bold">PAY TO THE ORDER OF: </span><span className="border-b border-black px-2 text-base font-extrabold">{payee}</span></p>
                    <p><span className="font-bold">THE SUM OF: </span><span className="font-semibold">{amountInWords(slip.net)}</span></p>
                    <div className="flex items-center justify-between">
                      <p className="rounded border-2 border-black px-4 py-2 text-xl font-extrabold">{ghs(slip.net)}</p>
                      <p className="text-[11px]">Basic {ghs(slip.basic)} · Allowances +{ghs(slip.allowances)} · Deductions −{ghs(slip.deductions)}</p>
                    </div>
                    <p className="text-[11px]">For salary earned during payroll period {slip.period}. This cheque is valid for 90 days from the date above.</p>
                  </div>
                  <div className="mt-14 flex justify-between gap-10 text-center text-[11px]">
                    <div className="flex-1 border-t border-black pt-1 font-bold">Authorised Signatory</div>
                    <div className="flex-1 border-t border-black pt-1 font-bold">Accountant</div>
                    <div className="flex-1 border-t border-black pt-1 font-bold">Payee Signature</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
