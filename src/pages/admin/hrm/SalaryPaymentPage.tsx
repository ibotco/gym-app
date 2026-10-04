import { useMemo, useState } from 'react'
import { Printer, Banknote, CheckCheck, Trash2 } from 'lucide-react'
import { PageHeader, Button, Input, Select, Badge, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function SalaryPaymentPage() {
  const { payslips, users, upsertPayslip, deletePayslip, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [statusF, setStatusF] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<string | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const rows = useMemo(() => [...payslips]
    .filter((p) => (!period || p.period === period) && (!statusF || p.status === statusF))
    .sort((a, b) => b.period.localeCompare(a.period)), [payslips, period, statusF])

  const totals = useMemo(() => ({
    net: rows.reduce((s, p) => s + p.net, 0),
    paid: rows.filter((p) => p.status === 'paid').reduce((s, p) => s + p.net, 0),
    draft: rows.filter((p) => p.status === 'draft').reduce((s, p) => s + p.net, 0),
  }), [rows])

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSelected = rows.length > 0 && rows.every((p) => selected.includes(p.id))

  const markPaid = (ids: string[]) => {
    const today = new Date().toISOString().slice(0, 10)
    for (const id of ids) {
      const p = payslips.find((x) => x.id === id)
      if (p && p.status !== 'paid') {
        upsertPayslip({ ...p, status: 'paid', paidAt: today })
      }
    }
    log(user?.id || 'system', 'UPDATE', 'Payroll', `Marked ${ids.length} payslip(s) paid`)
    toast.success('Marked as paid', `${ids.length} payslip(s)`)
    setSelected([])
  }
  const remove = (id: string) => {
    deletePayslip(id)
    log(user?.id || 'system', 'DELETE', 'Payroll', 'Deleted payslip')
    toast.success('Payslip deleted')
    setDetail(null)
  }

  const detailSlip = payslips.find((p) => p.id === detail)

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="max-w-[170px]" aria-label="Period" />
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[150px]" aria-label="Status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </Select>
        <Badge tone="zinc">Net {ghs(totals.net)}</Badge>
        <Badge tone="lime">Paid {ghs(totals.paid)}</Badge>
        <Badge tone="amber">Outstanding {ghs(totals.draft)}</Badge>
        <div className="ml-auto flex items-center gap-2">
          {canManage && selected.length > 0 && (
            <Button onClick={() => markPaid(selected)}><CheckCheck className="size-4" /> Pay selected ({selected.length})</Button>
          )}
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename={`salary-payment-${period}`} rows={rows.map((p) => ({
            Staff: staffName(p.staffUserId), Period: p.period, Basic: p.basic, Allowances: p.allowances, Deductions: p.deductions, Net: p.net, Status: p.status, 'Paid at': p.paidAt || '',
          }))} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              {canManage && (
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="accent-[#c8f542]" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((p) => p.id))} aria-label="Select all" />
                </th>
              )}
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3">Period</th>
              <th className="px-3 py-3 text-right">Basic</th>
              <th className="px-3 py-3 text-right">Allow.</th>
              <th className="px-3 py-3 text-right">Deduct.</th>
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
                <td className="px-3 py-2.5 text-right font-extrabold text-lime">{ghs(p.net)}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={p.status === 'paid' ? 'lime' : 'amber'}>{p.status === 'paid' && p.paidAt ? `paid ${p.paidAt}` : 'draft'}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center justify-end gap-1">
                    {canManage && p.status === 'draft' && (
                      <Button size="sm" onClick={() => markPaid([p.id])}><Banknote className="size-3.5" /> Pay</Button>
                    )}
                    {canManage && (
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDetail(p.id)}><Trash2 className="size-4" /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-10 text-center text-mist">No payslips for this period — run Generate Salary first.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <Modal open={!!detailSlip} onClose={() => setDetail(null)} title={detailSlip ? `Payslip — ${staffName(detailSlip.staffUserId)}` : ''}>
        {detailSlip && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-line p-3">
              <p className="flex justify-between"><span className="text-mist">Period</span><span className="font-bold">{detailSlip.period}</span></p>
              <p className="flex justify-between"><span className="text-mist">Basic</span><span className="font-bold">{ghs(detailSlip.basic)}</span></p>
              <p className="flex justify-between"><span className="text-mist">Allowances + bonuses</span><span className="font-bold text-lime">+ {ghs(detailSlip.allowances)}</span></p>
              <p className="flex justify-between"><span className="text-mist">Deductions</span><span className="font-bold text-rose-400">− {ghs(detailSlip.deductions)}</span></p>
              <p className="mt-1 flex justify-between border-t border-line pt-1 text-base font-extrabold"><span>Net pay</span><span className="text-lime">{ghs(detailSlip.net)}</span></p>
            </div>
            <p className="text-xs text-mist">Status: {detailSlip.status}{detailSlip.paidAt ? ` on ${detailSlip.paidAt}` : ''}</p>
            {canManage && (
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                {detailSlip.status === 'draft' && <Button onClick={() => { markPaid([detailSlip.id]); setDetail(null) }}><Banknote className="size-4" /> Mark paid</Button>}
                <Button variant="danger" onClick={() => remove(detailSlip.id)}><Trash2 className="size-4" /> Delete</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
