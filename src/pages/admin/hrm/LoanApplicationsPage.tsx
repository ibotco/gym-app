import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, Wallet, HandCoins, Check, X, CalendarRange } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, StatCard, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { loanSchedule, buildInstallments } from '../../../lib/loans'
import type { StaffLoan, StaffLoanStatus } from '../../../types'

export const LOAN_STATUS: Record<StaffLoanStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  active: { label: 'Active', color: '#0ea5e9' },
  completed: { label: 'Completed', color: '#84cc16' },
  rejected: { label: 'Rejected', color: '#ef4444' },
}
const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function LoanApplicationsPage() {
  const app = useApp()
  const { loans, loanInstallments, loanPolicy, staff, users, upsertLoan, deleteLoan, setLoanInstallments, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; staffUserId: string; principal: string; months: string; purpose: string } | null>(null)
  const [detail, setDetail] = useState<StaffLoan | null>(null)
  const [deleting, setDeleting] = useState<StaffLoan | null>(null)
  const [err, setErr] = useState('')

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const salaryOf = (id: string) => staff.find((s) => s.userId === id)?.salary || 0

  const ql = q.trim().toLowerCase()
  const filtered = useMemo(() => [...loans]
    .filter((l) => (!statusF || l.status === statusF))
    .filter((l) => !ql || `${staffName(l.staffUserId)} ${l.purpose || ''}`.toLowerCase().includes(ql))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)), [loans, q, statusF, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const active = loans.filter((l) => l.status === 'active')
    const outstanding = loanInstallments.filter((i) => i.status === 'pending' && active.some((l) => l.id === i.loanId)).reduce((s, i) => s + i.amount, 0)
    const month = new Date().toISOString().slice(0, 7)
    const dueThisMonth = loanInstallments.filter((i) => i.dueDate.slice(0, 7) === month && i.status === 'pending').reduce((s, i) => s + i.amount, 0)
    return { active: active.length, pending: loans.filter((l) => l.status === 'pending').length, outstanding, dueThisMonth }
  }, [loans, loanInstallments])

  const openNew = () => { setEditing({ id: null, staffUserId: staff[0]?.userId || '', principal: '', months: '6', purpose: '' }); setErr('') }
  const save = () => {
    if (!editing) return
    const principal = Number(editing.principal)
    const months = Number(editing.months)
    if (!editing.staffUserId) { setErr('Select a staff member.'); return }
    if (!principal || principal <= 0) { setErr('Enter a loan amount.'); return }
    if (!months || months < 1) { setErr('Enter a term in months.'); return }
    if (months > loanPolicy.maxMonths) { setErr(`Policy allows at most ${loanPolicy.maxMonths} months.`); return }
    const cap = salaryOf(editing.staffUserId) * loanPolicy.maxSalaryMultiple
    if (principal > cap) { setErr(`Max principal for this salary is ${ghs(cap)} (${loanPolicy.maxSalaryMultiple}× salary).`); return }
    const stRec = staff.find((x) => x.userId === editing.staffUserId)
    if (stRec && loanPolicy.minTenureMonths > 0) {
      const tenure = Math.floor((Date.now() - new Date(`${stRec.hireDate}T00:00:00`).getTime()) / (30.44 * 86400000))
      if (tenure < loanPolicy.minTenureMonths) { setErr(`Requires ${loanPolicy.minTenureMonths} months of service (has ${tenure}).`); return }
    }
    if (loanPolicy.minSalary > 0 && salaryOf(editing.staffUserId) < loanPolicy.minSalary) { setErr(`Minimum salary of ${ghs(loanPolicy.minSalary)} required.`); return }
    if (!loanPolicy.allowMultipleActive && !editing.id && loans.some((l) => l.staffUserId === editing.staffUserId && l.status === 'active')) {
      setErr('This staff member already has an active loan (policy: one at a time).'); return
    }
    const existing = loans.find((l) => l.id === editing.id)
    upsertLoan({
      id: editing.id || uid('ln'),
      staffUserId: editing.staffUserId,
      principal,
      months,
      interestPercent: loanPolicy.interestPercent,
      status: existing?.status || 'pending',
      purpose: editing.purpose.trim() || undefined,
      appliedAt: existing?.appliedAt || new Date().toISOString().slice(0, 10),
      decidedAt: existing?.decidedAt,
    })
    log(user?.id || 'system', existing ? 'UPDATE' : 'CREATE', 'Loan', `${existing ? 'Updated' : 'New loan application from'} ${staffName(editing.staffUserId)}`)
    toast.success(existing ? 'Application updated' : 'Application submitted', staffName(editing.staffUserId))
    setEditing(null)
  }

  const decide = (l: StaffLoan, status: 'active' | 'rejected') => {
    const today = new Date().toISOString().slice(0, 10)
    upsertLoan({ ...l, status, decidedAt: today })
    if (status === 'active') {
      const existing = loanInstallments.filter((i) => i.loanId === l.id)
      if (!existing.length) setLoanInstallments([...loanInstallments, ...buildInstallments({ ...l, status })])
    }
    log(user?.id || 'system', 'UPDATE', 'Loan', `${status === 'active' ? 'Approved' : 'Rejected'} loan for ${staffName(l.staffUserId)}`)
    toast.success(status === 'active' ? 'Loan approved — schedule generated' : 'Loan rejected', staffName(l.staffUserId))
    setDetail(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    deleteLoan(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Loan', `Deleted loan for ${staffName(deleting.staffUserId)}`)
    toast.success('Loan deleted', staffName(deleting.staffUserId))
    setDeleting(null); setDetail(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Loan Management</span><span>/</span>
        <span className="font-semibold text-inherit">Loan Applications</span>
      </div>
      <PageHeader
        title="Loan Applications"
        desc="Staff loan requests — approve to auto-generate the installment schedule, or reject."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New application</Button> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active loans" value={String(stats.active)} icon={<HandCoins className="size-4" />} />
        <StatCard label="Pending review" value={String(stats.pending)} icon={<Wallet className="size-4" />} />
        <StatCard label="Outstanding" value={ghs(stats.outstanding)} icon={<Wallet className="size-4" />} hint="unpaid installments" />
        <StatCard label="Due this month" value={ghs(stats.dueThisMonth)} icon={<CalendarRange className="size-4" />} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search staff or purpose…" className="max-w-xs" />
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[150px]" aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(LOAN_STATUS) as StaffLoanStatus[]).map((s) => <option key={s} value={s}>{LOAN_STATUS[s].label}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename="loan-applications" rows={filtered.map((l) => ({
            Staff: staffName(l.staffUserId), Principal: l.principal, Months: l.months, 'Rate %': l.interestPercent,
            Monthly: loanSchedule(l.principal, l.months, l.interestPercent).monthly, Status: l.status, Applied: l.appliedAt, Purpose: l.purpose || '',
          }))} />
        </div>
      </div>

      {/* Cards, two columns */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((l) => {
          const m = LOAN_STATUS[l.status]
          const sch = loanSchedule(l.principal, l.months, l.interestPercent)
          const insts = loanInstallments.filter((i) => i.loanId === l.id)
          const paid = insts.filter((i) => i.status === 'paid').length
          return (
            <div key={l.id} className="card overflow-hidden transition hover:border-lime/40">
              <div className="h-1" style={{ background: m.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{staffName(l.staffUserId)}</p>
                    <p className="text-xs text-mist">applied {formatDate(l.appliedAt)}{l.purpose ? ` · ${l.purpose}` : ''}</p>
                  </div>
                  <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ borderColor: m.color, color: m.color, background: `${m.color}14` }}>{m.label}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Principal</p><p className="font-extrabold">{ghs(l.principal)}</p></div>
                  <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Term</p><p className="font-extrabold">{l.months} mo</p></div>
                  <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Monthly</p><p className="font-extrabold text-lime">{ghs(sch.monthly)}</p></div>
                </div>
                {insts.length > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${(paid / insts.length) * 100}%`, background: '#84cc16' }} />
                    </div>
                    <p className="mt-1 text-[10px] text-mist">{paid}/{insts.length} installments paid</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <button className="text-xs font-bold text-lime hover:underline" onClick={() => setDetail(l)}>View schedule →</button>
                  {canManage && (
                    <span className="flex items-center gap-1">
                      {l.status === 'pending' && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Approve" onClick={() => decide(l, 'active')}><Check className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Reject" onClick={() => decide(l, 'rejected')}><X className="size-4" /></button>
                        </>
                      )}
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => { setEditing({ id: l.id, staffUserId: l.staffUserId, principal: String(l.principal), months: String(l.months), purpose: l.purpose || '' }); setErr('') }}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(l)}><Trash2 className="size-4" /></button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {!filtered.length && <div className="card col-span-full p-10 text-center text-mist"><HandCoins className="mx-auto mb-2 size-8" /> No loan applications yet.</div>}
      </div>

      {/* Detail modal with schedule */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Loan — ${staffName(detail.staffUserId)}` : ''} wide>
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center text-sm">
              <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Principal</p><p className="font-extrabold">{ghs(detail.principal)}</p></div>
              <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Rate</p><p className="font-extrabold">{detail.interestPercent}%/yr</p></div>
              <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Total repayable</p><p className="font-extrabold">{ghs(loanSchedule(detail.principal, detail.months, detail.interestPercent).total)}</p></div>
              <div className="rounded-xl border border-line p-2"><p className="text-[10px] font-bold uppercase text-mist">Monthly</p><p className="font-extrabold text-lime">{ghs(loanSchedule(detail.principal, detail.months, detail.interestPercent).monthly)}</p></div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="border-b border-line bg-black/[0.02] text-left dark:bg-white/[0.03]"><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Due date</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5">Status</th></tr></thead>
                <tbody>
                  {loanInstallments.filter((i) => i.loanId === detail.id).map((i) => (
                    <tr key={i.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-1.5 text-mist">{i.n}</td>
                      <td className="px-2 py-1.5">{formatDate(i.dueDate)}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{ghs(i.amount)}</td>
                      <td className="px-2 py-1.5"><Badge tone={i.status === 'paid' ? 'lime' : 'amber'}>{i.status === 'paid' ? `paid ${i.paidAt || ''}` : 'pending'}</Badge></td>
                    </tr>
                  ))}
                  {!loanInstallments.some((i) => i.loanId === detail.id) && <tr><td colSpan={4} className="px-2 py-4 text-center text-mist">Schedule generated on approval.</td></tr>}
                </tbody>
              </table>
            </div>
            {canManage && detail.status === 'pending' && (
              <div className="flex gap-2 border-t border-line pt-3">
                <Button onClick={() => decide(detail, 'active')}><Check className="size-4" /> Approve & generate schedule</Button>
                <Button variant="danger" onClick={() => decide(detail, 'rejected')}><X className="size-4" /> Reject</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Application modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit application' : 'New loan application'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Staff member">
              <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                {staff.map((s) => <option key={s.id} value={s.userId}>{staffName(s.userId)} — {ghs(salaryOf(s.userId))}/mo</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Principal (GHS)"><Input type="number" min={0} value={editing.principal} onChange={(e) => setEditing({ ...editing, principal: e.target.value })} placeholder={`max ${ghs(salaryOf(editing.staffUserId) * loanPolicy.maxSalaryMultiple)}`} /></Field>
              <Field label="Term (months)"><Input type="number" min={1} max={loanPolicy.maxMonths} value={editing.months} onChange={(e) => setEditing({ ...editing, months: e.target.value })} /></Field>
            </div>
            {Number(editing.principal) > 0 && Number(editing.months) > 0 && (
              <p className="rounded-xl border border-line p-2 text-xs text-mist">
                At {loanPolicy.interestPercent}% flat: repay <span className="font-bold text-inherit">{ghs(loanSchedule(Number(editing.principal), Number(editing.months), loanPolicy.interestPercent).total)}</span> ≈ <span className="font-bold text-lime">{ghs(loanSchedule(Number(editing.principal), Number(editing.months), loanPolicy.interestPercent).monthly)}/month</span>
              </p>
            )}
            <Field label="Purpose"><Textarea value={editing.purpose} onChange={(e) => setEditing({ ...editing, purpose: e.target.value })} placeholder="please provide description" className="placeholder:italic placeholder:text-rose-400" /></Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Submit application'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete loan?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete this loan for <span className="font-semibold text-inherit">{staffName(deleting.staffUserId)}</span> and its installment schedule?</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
