import { useMemo, useState } from 'react'
import { Plus, Printer, Wallet, Hourglass, TrendingUp, HandCoins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea } from '../../../components/ui'
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

interface Form { amount: string; months: string; reason: string; date: string }

export function MyAdvanceSalaryPage() {
  const { staff, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const [advances, setAdvances] = useState<SalaryAdvance[]>(() => loadSalaryAdvances())
  const [editing, setEditing] = useState<Form | null>(null)
  const [err, setErr] = useState('')

  const myStaff = staff.find((s) => s.userId === user?.id)
  const mine = useMemo(
    () => advances.filter((a) => a.staffUserId === user?.id).sort((a, b) => b.date.localeCompare(a.date)),
    [advances, user],
  )
  const persist = (next: SalaryAdvance[]) => { setAdvances(next); saveSalaryAdvances(next) }

  const kpi = useMemo(() => ({
    total: mine.length,
    pending: mine.filter((a) => a.status === 'pending').length,
    outstanding: mine.filter((a) => a.status === 'approved').reduce((s, a) => s + outstandingOf(a), 0),
    recovered: mine.reduce((s, a) => s + (a.status === 'rejected' ? 0 : recoveredOf(a)), 0),
  }), [mine])

  const save = () => {
    if (!editing || !user) return
    const amount = Number(editing.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setErr('Enter an amount greater than zero.'); return }
    const months = Number(editing.months)
    if (!Number.isFinite(months) || months < 1 || months > 24) { setErr('Recovery period must be between 1 and 24 months.'); return }
    if (!editing.reason.trim()) { setErr('Provide a reason for your request.'); return }
    persist([...advances, {
      id: `sa_${uid()}`, staffUserId: user.id, amount, months, reason: editing.reason.trim(),
      date: editing.date, recoveredMonths: 0, status: 'pending', createdAt: todayIso(),
    }])
    log(user.id, 'CREATE', 'Advance Salary', `Requested personal advance of ${ghs(amount)}`)
    toast.success('Application submitted', `${ghs(amount)} over ${months} month${months === 1 ? '' : 's'} — pending approval`)
    setEditing(null); setErr('')
  }

  const exportRows = mine.map((a) => ({
    Date: a.date, Amount: a.amount, 'Monthly deduction': monthlyDeduction(a),
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
        <span className="font-semibold text-inherit">My Application</span>
      </div>
      <PageHeader
        title="My Application"
        desc="Your personal salary advance applications — submit a request and track approvals and payroll recoveries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename="my-advance-salary" rows={exportRows} />
            {myStaff && <Button onClick={() => { setEditing({ amount: '', months: '3', reason: '', date: todayIso() }); setErr('') }}><Plus className="size-4" /> New application</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={HandCoins} label="My applications" value={String(kpi.total)} sub={`${kpi.pending} pending`} />
        <Kpi icon={Hourglass} label="Pending approval" value={String(kpi.pending)} />
        <Kpi icon={Wallet} label="My outstanding balance" value={ghs(kpi.outstanding)} />
        <Kpi icon={TrendingUp} label="Recovered from my pay" value={ghs(kpi.recovered)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 860 }}>
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Advance</th>
              <th className="px-3 py-2.5 text-right">Monthly deduction</th>
              <th className="px-3 py-2.5">Recovery</th>
              <th className="px-3 py-2.5 text-right">Outstanding</th>
              <th className="px-3 py-2.5">Reason</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                <td className="px-4 py-2.5 font-mono text-xs text-mist">{a.date}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{ghs(a.amount)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-rose-400">− {ghs(monthlyDeduction(a))}</td>
                <td className="px-3 py-2.5">
                  <p className="text-xs font-bold">{a.recoveredMonths}/{a.months} months</p>
                  <div className="mt-1 h-1.5 w-20 rounded bg-black/10 dark:bg-white/10">
                    <div className="h-1.5 rounded bg-lime" style={{ width: `${Math.round((a.recoveredMonths / Math.max(1, a.months)) * 100)}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold">{ghs(outstandingOf(a))}</td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-xs text-mist" title={a.reason}>{a.reason}</td>
                <td className="px-3 py-2.5"><Badge tone={ADV_STATUS_META[a.status].tone}>{ADV_STATUS_META[a.status].label}</Badge></td>
              </tr>
            ))}
            {!mine.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-mist">
                {myStaff ? 'You have no salary advance applications yet.' : 'No staff record is linked to your account — contact HR.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="New salary advance application" wide>
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Advance amount (GHS)" required>
              <Input type="number" min={0} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder="e.g. 1500" />
            </Field>
            <Field label="Recovery period (months)" required>
              <Input type="number" min={1} max={24} value={editing.months} onChange={(e) => setEditing({ ...editing, months: e.target.value })} />
            </Field>
            <Field label="Date" required>
              <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Reason" required className="sm:col-span-2">
              <Textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} placeholder="What is this advance for?" />
            </Field>
            {Number(editing.amount) > 0 && Number(editing.months) >= 1 && (
              <p className="text-xs text-mist sm:col-span-2">
                Monthly payroll deduction: <span className="font-bold text-inherit">{ghs(Math.round((Number(editing.amount) / Number(editing.months)) * 100) / 100)}</span> for {editing.months} month{Number(editing.months) === 1 ? '' : 's'}.
              </p>
            )}
            {err && <p className="text-xs font-bold text-rose-500 sm:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Submit application</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
