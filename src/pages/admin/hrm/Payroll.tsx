import { useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, Select, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import type { Payslip } from '../../../types'

export function Payroll() {
  const app = useApp()
  const { payslips, staff, users, upsertPayslip, deletePayslip, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id?: string; staffUserId: string; period: string; basic: string; allowances: string; deductions: string } | null>(null)
  const [deleting, setDeleting] = useState<Payslip | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const staffSalary = (id: string) => staff.find((s) => s.userId === id)?.salary || 0

  const totalNet = payslips.filter((p) => p.status === 'paid').reduce((s, p) => s + p.net, 0)

  const openNew = () => {
    const first = staff[0]?.userId || ''
    const period = new Date().toISOString().slice(0, 7)
    setEditing({ staffUserId: first, period, basic: String(staffSalary(first)), allowances: '0', deductions: '0' })
  }
  const openEdit = (p: Payslip) => setEditing({ id: p.id, staffUserId: p.staffUserId, period: p.period, basic: String(p.basic), allowances: String(p.allowances), deductions: String(p.deductions) })

  const save = () => {
    if (!editing) return
    if (!editing.staffUserId) { toast.error('Select a staff member.'); return }
    if (!editing.period) { toast.error('Enter a pay period (YYYY-MM).'); return }
    const basic = Number(editing.basic) || 0
    const allowances = Number(editing.allowances) || 0
    const deductions = Number(editing.deductions) || 0
    const isNew = !editing.id
    const rec: Payslip = {
      id: editing.id || uid('ps'),
      staffUserId: editing.staffUserId,
      period: editing.period,
      basic,
      allowances,
      deductions,
      net: basic + allowances - deductions,
      status: isNew ? 'draft' : (payslips.find((p) => p.id === editing.id)?.status || 'draft'),
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
        <StatCard label="Payslips" value={String(payslips.length)} icon={<Wallet className="size-4" />} />
        <StatCard label="Paid net" value={formatGhsExact(totalNet)} />
        <StatCard label="Staff" value={String(staff.length)} />
      </div>

      <div className="card mt-4 table-wrap">
        <table className="data">
          <thead><tr><th>Staff</th><th>Period</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {[...payslips].sort((a, b) => b.period.localeCompare(a.period)).map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{staffName(p.staffUserId)}</td>
                <td className="text-mist">{p.period}</td>
                <td>{formatGhsExact(p.basic)}</td>
                <td>{formatGhsExact(p.allowances)}</td>
                <td className="text-ember">-{formatGhsExact(p.deductions)}</td>
                <td className="font-semibold">{formatGhsExact(p.net)}</td>
                <td>
                  {canManage ? (
                    <Select value={p.status} onChange={(e) => { upsertPayslip({ ...p, status: e.target.value as 'draft' | 'paid', paidAt: e.target.value === 'paid' ? new Date().toISOString().slice(0, 10) : undefined }); toast.success('Updated') }}>
                      <option value="draft">draft</option>
                      <option value="paid">paid</option>
                    </Select>
                  ) : (
                    <StatusBadge status={p.status === 'paid' ? 'paid' : 'pending'} />
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(p)} aria-label="Edit"><Wallet className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(p)} aria-label="Delete"><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit payslip' : 'New payslip'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Staff member">
              <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value, basic: String(staffSalary(e.target.value)) })}>
                {staff.map((s) => {
                  const u = users.find((x) => x.id === s.userId)
                  return <option key={s.id} value={s.userId}>{u?.name} · {s.title}</option>
                })}
              </Select>
            </Field>
            <Field label="Period (YYYY-MM)"><Input value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} placeholder="2026-07" /></Field>
            <Field label="Basic salary"><Input type="number" min={0} value={editing.basic} onChange={(e) => setEditing({ ...editing, basic: e.target.value })} /></Field>
            <Field label="Allowances"><Input type="number" min={0} value={editing.allowances} onChange={(e) => setEditing({ ...editing, allowances: e.target.value })} /></Field>
            <Field label="Deductions"><Input type="number" min={0} value={editing.deductions} onChange={(e) => setEditing({ ...editing, deductions: e.target.value })} /></Field>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Net pay</p>
              <p className="font-display text-lg">{formatGhsExact((Number(editing.basic) || 0) + (Number(editing.allowances) || 0) - (Number(editing.deductions) || 0))}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Create payslip'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete payslip?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete payslip for {staffName(deleting.staffUserId)} ({deleting.period})?</p>
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
