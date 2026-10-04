import { useState } from 'react'
import { Plus, Pencil, Trash2, LockKeyhole, LockOpen } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, DatePicker } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { formatDate, uid } from '../../../lib/utils'
import { loadPayrollPeriods, savePayrollPeriods, type PayrollPeriod } from '../../../lib/payrollExtras'

type Form = { id?: string; name: string; start: string; end: string; payDate: string }

export function PayrollPeriodsPage() {
  const { log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [periods, setPeriods] = useState<PayrollPeriod[]>(() => loadPayrollPeriods())
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<PayrollPeriod | null>(null)

  const persist = (next: PayrollPeriod[]) => { setPeriods(next); savePayrollPeriods(next) }
  const sorted = [...periods].sort((a, b) => b.start.localeCompare(a.start))

  const save = () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.start || !editing.end) { toast.error('Name, start and end are required.'); return }
    if (editing.end < editing.start) { toast.error('End date must be on or after the start date.'); return }
    const rec: PayrollPeriod = {
      id: editing.id || uid('pp'), name: editing.name.trim(), start: editing.start, end: editing.end,
      payDate: editing.payDate || editing.end, status: editing.id ? periods.find((p) => p.id === editing.id)?.status || 'open' : 'open',
    }
    persist(editing.id ? periods.map((p) => (p.id === rec.id ? rec : p)) : [...periods, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'PayrollPeriod', `${editing.id ? 'Updated' : 'Created'} period ${rec.name}`)
    toast.success(editing.id ? 'Period updated' : 'Period created')
    setEditing(null)
  }

  const toggle = (p: PayrollPeriod) => {
    persist(periods.map((x) => (x.id === p.id ? { ...x, status: x.status === 'open' ? 'closed' : 'open' } : x)))
    log(user?.id || 'system', 'UPDATE', 'PayrollPeriod', `${p.status === 'open' ? 'Closed' : 'Re-opened'} period ${p.name}`)
    toast.success(p.status === 'open' ? 'Period closed' : 'Period re-opened')
  }

  const doDelete = () => {
    if (!deleting) return
    persist(periods.filter((p) => p.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'PayrollPeriod', `Deleted period ${deleting.name}`)
    toast.success('Period deleted')
    setDeleting(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">Payroll Periods</span></div>
      <PageHeader title="Payroll Periods" desc="Pay cycles with start/end and pay day. Close a period to lock its runs."
        actions={canManage ? <Button onClick={() => setEditing({ name: '', start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10), payDate: '' })}><Plus className="size-4" /> New period</Button> : undefined} />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5">Start</th><th className="px-3 py-2.5">End</th><th className="px-3 py-2.5">Pay day</th><th className="px-3 py-2.5 text-center">Status</th>{canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
            </tr></thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5 font-bold">{p.name}</td>
                  <td className="px-3 py-2.5 text-mist">{formatDate(p.start)}</td>
                  <td className="px-3 py-2.5 text-mist">{formatDate(p.end)}</td>
                  <td className="px-3 py-2.5 text-mist">{formatDate(p.payDate)}</td>
                  <td className="px-3 py-2.5 text-center"><Badge tone={p.status === 'open' ? 'lime' : 'zinc'}>{p.status}</Badge></td>
                  {canManage && (
                    <td className="px-3 py-2.5"><span className="flex justify-end gap-1">
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title={p.status === 'open' ? 'Close period' : 'Re-open period'} onClick={() => toggle(p)}>{p.status === 'open' ? <LockKeyhole className="size-4" /> : <LockOpen className="size-4" />}</button>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setEditing({ id: p.id, name: p.name, start: p.start, end: p.end, payDate: p.payDate })}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>
                    </span></td>
                  )}
                </tr>
              ))}
              {!sorted.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">No payroll periods yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit period' : 'New payroll period'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Period name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. 2026-09" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" required><DatePicker value={editing.start} onChange={(v) => setEditing({ ...editing, start: v })} /></Field>
              <Field label="End" required><DatePicker value={editing.end} onChange={(v) => setEditing({ ...editing, end: v })} /></Field>
            </div>
            <Field label="Pay day"><DatePicker value={editing.payDate} onChange={(v) => setEditing({ ...editing, payDate: v })} /></Field>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>Save period</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete period?">
        {deleting && (<>
          <p className="text-sm text-mist">Delete period <span className="font-semibold text-inherit">{deleting.name}</span>? Existing payslips are kept.</p>
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button></div>
        </>)}
      </Modal>
    </div>
  )
}
