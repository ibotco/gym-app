import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, CheckCircle2, XCircle, HandCoins, Wallet, Hourglass, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField, Textarea } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import {
  loadSalaryAdvances, saveSalaryAdvances, ADV_STATUS_META, monthlyDeduction,
  outstandingOf, recoveredOf, ghs, todayIso,
} from '../../../lib/advanceSalary'
import type { SalaryAdvance } from '../../../types'

interface Form {
  staffUserId: string
  amount: string
  months: string
  reason: string
  date: string
}

export function AdvanceSalaryPage() {
  const { staff, users, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [advances, setAdvances] = useState<SalaryAdvance[]>(() => loadSalaryAdvances())
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [err, setErr] = useState('')
  const [deleting, setDeleting] = useState<SalaryAdvance | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const deptOf = (id: string) => staff.find((s) => s.userId === id)?.department || '—'
  const persist = (next: SalaryAdvance[]) => { setAdvances(next); saveSalaryAdvances(next) }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return advances
      .filter((a) => {
        if (ql && !`${staffName(a.staffUserId)} ${a.reason} ${a.date}`.toLowerCase().includes(ql)) return false
        if (fStatus !== 'all' && a.status !== fStatus) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [advances, q, fStatus, users, staff]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => ({
    total: advances.length,
    pending: advances.filter((a) => a.status === 'pending').length,
    outstanding: advances.filter((a) => a.status === 'approved').reduce((s, a) => s + outstandingOf(a), 0),
    recovered: advances.reduce((s, a) => s + (a.status === 'rejected' ? 0 : recoveredOf(a)), 0),
    active: advances.filter((a) => a.status === 'approved').length,
  }), [advances])

  const blank = (): Form => ({ staffUserId: staff[0]?.userId || '', amount: '', months: '3', reason: '', date: todayIso() })

  const save = () => {
    if (!editing) return
    const f = editing.form
    const amount = Number(f.amount)
    if (!f.staffUserId) { setErr('Choose an employee.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setErr('Enter an advance amount greater than zero.'); return }
    const months = Number(f.months)
    if (!Number.isFinite(months) || months < 1 || months > 24) { setErr('Recovery period must be between 1 and 24 months.'); return }
    if (!f.reason.trim()) { setErr('Provide a reason for the advance.'); return }

    if (editing.id) {
      persist(advances.map((a) => (a.id === editing.id
        ? { ...a, staffUserId: f.staffUserId, amount, months, reason: f.reason.trim(), date: f.date }
        : a)))
      log(user?.id || 'system', 'UPDATE', 'Advance Salary', `Updated advance of ${ghs(amount)} for ${staffName(f.staffUserId)}`)
      toast.success('Advance updated', staffName(f.staffUserId))
    } else {
      persist([...advances, {
        id: `sa_${uid()}`, staffUserId: f.staffUserId, amount, months, reason: f.reason.trim(),
        date: f.date, recoveredMonths: 0, status: 'pending', createdAt: todayIso(),
      }])
      log(user?.id || 'system', 'CREATE', 'Advance Salary', `Requested advance of ${ghs(amount)} for ${staffName(f.staffUserId)}`)
      toast.success('Advance requested', `${staffName(f.staffUserId)} · ${ghs(amount)}`)
    }
    setEditing(null); setErr('')
  }

  const setStatus = (id: string, status: SalaryAdvance['status'], msg: string) => {
    persist(advances.map((a) => (a.id === id ? { ...a, status } : a)))
    const a = advances.find((x) => x.id === id)
    log(user?.id || 'system', 'UPDATE', 'Advance Salary', `${msg} for ${staffName(a?.staffUserId || '')} (${ghs(a?.amount || 0)})`)
    toast.success(msg, a ? staffName(a.staffUserId) : undefined)
  }

  const recordRecovery = (id: string) => {
    persist(advances.map((a) => {
      if (a.id !== id) return a
      const recoveredMonths = Math.min(a.months, a.recoveredMonths + 1)
      return { ...a, recoveredMonths, status: recoveredMonths >= a.months ? 'recovered' as const : a.status }
    }))
    const a = advances.find((x) => x.id === id)
    log(user?.id || 'system', 'UPDATE', 'Advance Salary', `Recorded payroll deduction for ${staffName(a?.staffUserId || '')}`)
    toast.success('Deduction recorded', a ? `${staffName(a.staffUserId)} · ${ghs(monthlyDeduction(a))}` : undefined)
  }

  const removeAdvance = () => {
    if (!deleting) return
    persist(advances.filter((a) => a.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'Advance Salary', `Deleted advance of ${ghs(deleting.amount)} for ${staffName(deleting.staffUserId)}`)
    toast.success('Advance deleted', staffName(deleting.staffUserId))
    setDeleting(null)
  }

  const exportRows = filtered.map((a) => ({
    Date: a.date, Employee: staffName(a.staffUserId), Department: deptOf(a.staffUserId),
    Amount: a.amount, 'Monthly deduction': monthlyDeduction(a),
    Recovered: `${a.recoveredMonths}/${a.months}`, Outstanding: outstandingOf(a),
    Reason: a.reason, Status: ADV_STATUS_META[a.status].label,
  }))

  const Kpi = ({ icon: Icon, label, value, sub }: { icon: typeof Wallet; label: string; value: string; sub?: string }) => (
    <div className="card flex items-center gap-3 p-4">
      <Icon className="size-5 text-lime" />
      <div className="min-w-0">
        <p className="truncate text-xs text-mist">{label}</p>
        <p className="stat-num text-2xl">{value}</p>
        {sub && <p className="truncate text-[10px] text-mist">{sub}</p>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/hrm" className="hover:text-lime">Human Resource</Link>
        <span>/</span>
        <span>Advance Salary</span>
        <span>/</span>
        <span className="font-semibold text-inherit">Management Application</span>
      </div>
      <PageHeader
        title="Management Application"
        desc="Review, approve and recover staff salary advances through monthly payroll deductions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename="advance-salary" rows={exportRows} />
            {canManage && <Button onClick={() => { setEditing({ id: null, form: blank() }); setErr('') }}><Plus className="size-4" /> New advance</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={HandCoins} label="Total advances" value={String(kpi.total)} sub={`${kpi.active} active`} />
        <Kpi icon={Hourglass} label="Pending approval" value={String(kpi.pending)} />
        <Kpi icon={Wallet} label="Outstanding balance" value={ghs(kpi.outstanding)} sub="approved advances" />
        <Kpi icon={TrendingUp} label="Recovered to date" value={ghs(kpi.recovered)} sub="via payroll deductions" />
      </div>

      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-3">
        <div className="md:col-span-2"><SearchField value={q} onChange={setQ} placeholder="Search employee, reason, date…" /></div>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {(Object.keys(ADV_STATUS_META) as SalaryAdvance['status'][]).map((s) => <option key={s} value={s}>{ADV_STATUS_META[s].label}</option>)}
        </Select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 980 }}>
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-4 py-2.5">Employee</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Advance</th>
              <th className="px-3 py-2.5 text-right">Monthly deduction</th>
              <th className="px-3 py-2.5">Recovery</th>
              <th className="px-3 py-2.5 text-right">Outstanding</th>
              <th className="px-3 py-2.5">Reason</th>
              <th className="px-3 py-2.5">Status</th>
              {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                <td className="px-4 py-2.5">
                  <p className="font-bold">{staffName(a.staffUserId)}</p>
                  <p className="text-[11px] text-mist">{deptOf(a.staffUserId)}</p>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-mist">{a.date}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{ghs(a.amount)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-rose-400">− {ghs(monthlyDeduction(a))}</td>
                <td className="px-3 py-2.5">
                  <p className="text-xs font-bold">{a.recoveredMonths}/{a.months} months</p>
                  <div className="mt-1 h-1.5 w-20 rounded bg-black/10 dark:bg-white/10">
                    <div className="h-1.5 rounded bg-lime" style={{ width: `${Math.round((a.recoveredMonths / Math.max(1, a.months)) * 100)}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold">{ghs(outstandingOf(a))}</td>
                <td className="max-w-[240px] truncate px-3 py-2.5 text-xs text-mist" title={a.reason}>{a.reason}</td>
                <td className="px-3 py-2.5"><Badge tone={ADV_STATUS_META[a.status].tone}>{ADV_STATUS_META[a.status].label}</Badge></td>
                {canManage && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {a.status === 'pending' && (
                        <>
                          <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-lime dark:hover:bg-white/5" title="Approve" onClick={() => setStatus(a.id, 'approved', 'Advance approved')}><CheckCircle2 className="size-4" /></button>
                          <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-rose-500 dark:hover:bg-white/5" title="Reject" onClick={() => setStatus(a.id, 'rejected', 'Advance rejected')}><XCircle className="size-4" /></button>
                        </>
                      )}
                      {a.status === 'approved' && (
                        <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-lime dark:hover:bg-white/5" title="Record payroll deduction" onClick={() => recordRecovery(a.id)}><HandCoins className="size-4" /></button>
                      )}
                      <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white" title="Edit" onClick={() => { setEditing({ id: a.id, form: { staffUserId: a.staffUserId, amount: String(a.amount), months: String(a.months), reason: a.reason, date: a.date } }); setErr('') }}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-rose-500 dark:hover:bg-white/5" title="Delete" onClick={() => setDeleting(a)}><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-10 text-center text-mist">No salary advances match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit salary advance' : 'New salary advance'} wide>
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee" required>
              <Select value={editing.form.staffUserId} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, staffUserId: e.target.value } })}>
                {staff.map((s) => <option key={s.userId} value={s.userId}>{staffName(s.userId)} — {s.department}</option>)}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={editing.form.date} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, date: e.target.value } })} />
            </Field>
            <Field label="Advance amount (GHS)" required>
              <Input type="number" min={0} value={editing.form.amount} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, amount: e.target.value } })} placeholder="e.g. 2000" />
            </Field>
            <Field label="Recovery period (months)" required>
              <Input type="number" min={1} max={24} value={editing.form.months} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, months: e.target.value } })} />
            </Field>
            <Field label="Reason" required className="sm:col-span-2">
              <Textarea value={editing.form.reason} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, reason: e.target.value } })} placeholder="What is this advance for?" />
            </Field>
            {Number(editing.form.amount) > 0 && Number(editing.form.months) >= 1 && (
              <p className="text-xs text-mist sm:col-span-2">
                Monthly payroll deduction: <span className="font-bold text-inherit">{ghs(Math.round((Number(editing.form.amount) / Number(editing.form.months)) * 100) / 100)}</span> for {editing.form.months} month{Number(editing.form.months) === 1 ? '' : 's'}.
              </p>
            )}
            {err && <p className="text-xs font-bold text-rose-500 sm:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save changes' : 'Request advance'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete salary advance" narrow>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm">Delete the {ghs(deleting.amount)} advance for <span className="font-bold">{staffName(deleting.staffUserId)}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Keep</Button>
              <Button variant="danger" onClick={removeAdvance}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
