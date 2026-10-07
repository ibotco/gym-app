import { useMemo, useState } from 'react'
import { Settings2, Save, Percent, CalendarRange, Wallet, Layers, ShieldCheck, Calculator, HandCoins, CalendarCheck } from 'lucide-react'
import { PageHeader, Button, Field, Input, Switch, StatCard, Badge } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loanSchedule } from '../../../lib/loans'
import { LOAN_STATUS } from './LoanApplicationsPage'
import type { StaffLoanStatus } from '../../../types'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function LoanSettingsPage() {
  const { loanPolicy, setLoanPolicy, loans, loanInstallments } = useApp()
  const toast = useToast()
  const [form, setForm] = useState({
    interestPercent: String(loanPolicy.interestPercent),
    maxMonths: String(loanPolicy.maxMonths),
    maxSalaryMultiple: String(loanPolicy.maxSalaryMultiple),
    allowMultipleActive: loanPolicy.allowMultipleActive,
    payDay: String(loanPolicy.payDay),
    graceDays: String(loanPolicy.graceDays),
    minTenureMonths: String(loanPolicy.minTenureMonths),
    minSalary: String(loanPolicy.minSalary),
    autoDeduct: loanPolicy.autoDeduct,
  })
  // calculator inputs
  const [calc, setCalc] = useState({ salary: '2000', principal: '3000', months: '12' })
  const [err, setErr] = useState('')

  const save = () => {
    const v = {
      interest: Number(form.interestPercent), months: Number(form.maxMonths), mult: Number(form.maxSalaryMultiple),
      payDay: Number(form.payDay), grace: Number(form.graceDays), tenure: Number(form.minTenureMonths), minSal: Number(form.minSalary),
    }
    if (Number.isNaN(v.interest) || v.interest < 0 || v.interest > 100) { setErr('Interest must be between 0 and 100.'); return }
    if (Number.isNaN(v.months) || v.months < 1 || v.months > 60) { setErr('Max term must be 1–60 months.'); return }
    if (Number.isNaN(v.mult) || v.mult < 0.5 || v.mult > 24) { setErr('Salary multiple must be 0.5–24.'); return }
    if (Number.isNaN(v.payDay) || v.payDay < 1 || v.payDay > 28) { setErr('Pay day must be 1–28.'); return }
    if (Number.isNaN(v.grace) || v.grace < 0 || v.grace > 30) { setErr('Grace days must be 0–30.'); return }
    if (Number.isNaN(v.tenure) || v.tenure < 0 || v.tenure > 120) { setErr('Minimum tenure must be 0–120 months.'); return }
    if (Number.isNaN(v.minSal) || v.minSal < 0) { setErr('Minimum salary cannot be negative.'); return }
    setLoanPolicy({
      interestPercent: v.interest, maxMonths: v.months, maxSalaryMultiple: v.mult, allowMultipleActive: form.allowMultipleActive,
      payDay: v.payDay, graceDays: v.grace, minTenureMonths: v.tenure, minSalary: v.minSal, autoDeduct: form.autoDeduct,
    })
    toast.success('Loan policy saved', 'New applications will use these rules.')
    setErr('')
  }

  /* live calculator */
  const c = useMemo(() => {
    const salary = Number(calc.salary) || 0
    const principal = Number(calc.principal) || 0
    const months = Math.max(1, Math.min(Number(calc.months) || 1, 60))
    const cap = salary * (Number(form.maxSalaryMultiple) || 0)
    const sch = loanSchedule(principal, months, Number(form.interestPercent) || 0)
    const overCap = principal > cap
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(28, Number(form.payDay) || 28))
    return { salary, principal, months, cap, sch, overCap, firstDue: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}` }
  }, [calc, form.maxSalaryMultiple, form.interestPercent, form.payDay])

  const portfolio = useMemo(() => {
    const by: Record<StaffLoanStatus, number> = { pending: 0, active: 0, completed: 0, rejected: 0 }
    for (const l of loans) by[l.status]++
    const outstanding = loanInstallments.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
    return { by, outstanding }
  }, [loans, loanInstallments])

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Loan Management</span><span>/</span>
        <span className="font-semibold text-inherit">Loan Settings</span>
      </div>
      <PageHeader
        title="Loan Settings"
        desc="Company loan policy — interest, repayment calendar and eligibility rules applied to every new application."
        actions={<Button onClick={save}><Save className="size-4" /> Save policy</Button>}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Interest rate" value={`${Number(form.interestPercent) || 0}%`} icon={<Percent className="size-4" />} hint="flat per year" />
        <StatCard label="Max term" value={`${Number(form.maxMonths) || 0} mo`} icon={<CalendarRange className="size-4" />} />
        <StatCard label="Active loans" value={String(portfolio.by.active)} icon={<HandCoins className="size-4" />} hint={`${portfolio.by.pending} pending`} />
        <StatCard label="Outstanding" value={ghs(portfolio.outstanding)} icon={<Wallet className="size-4" />} hint="all unpaid installments" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Interest & repayment */}
        <div className="card h-fit p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Settings2 className="size-4 text-lime" /> Interest & repayment</p>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest (% / year, flat)">
                <Input type="number" min={0} max={100} value={form.interestPercent} onChange={(e) => setForm({ ...form, interestPercent: e.target.value })} />
              </Field>
              <Field label="Maximum term (months)">
                <Input type="number" min={1} max={60} value={form.maxMonths} onChange={(e) => setForm({ ...form, maxMonths: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Installment pay day (1–28)">
                <Input type="number" min={1} max={28} value={form.payDay} onChange={(e) => setForm({ ...form, payDay: e.target.value })} />
              </Field>
              <Field label="Grace days before overdue">
                <Input type="number" min={0} max={30} value={form.graceDays} onChange={(e) => setForm({ ...form, graceDays: e.target.value })} />
              </Field>
            </div>
            <Field label="Deduct at source (payroll)">
              <div className="flex h-[42px] items-center gap-2">
                <Switch checked={form.autoDeduct} onChange={(v) => setForm({ ...form, autoDeduct: v })} aria-label="Deduct at source" />
                <span className="text-xs text-mist">{form.autoDeduct ? 'Installments deducted from salary' : 'Staff pay manually'}</span>
              </div>
            </Field>
          </div>
        </div>

        {/* Eligibility */}
        <div className="card h-fit p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><ShieldCheck className="size-4 text-lime" /> Eligibility rules</p>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max principal (× salary)">
                <Input type="number" min={0.5} step={0.5} value={form.maxSalaryMultiple} onChange={(e) => setForm({ ...form, maxSalaryMultiple: e.target.value })} />
              </Field>
              <Field label="Min tenure (months)">
                <Input type="number" min={0} value={form.minTenureMonths} onChange={(e) => setForm({ ...form, minTenureMonths: e.target.value })} />
              </Field>
            </div>
            <Field label="Minimum monthly salary (GHS, 0 = none)">
              <Input type="number" min={0} value={form.minSalary} onChange={(e) => setForm({ ...form, minSalary: e.target.value })} />
            </Field>
            <Field label="Multiple active loans per staff">
              <div className="flex h-[42px] items-center gap-2">
                <Switch checked={form.allowMultipleActive} onChange={(v) => setForm({ ...form, allowMultipleActive: v })} aria-label="Allow multiple active loans" />
                <span className="text-xs text-mist">{form.allowMultipleActive ? 'Allowed' : 'One active loan at a time'}</span>
              </div>
            </Field>
            <p className="rounded-xl border border-line p-2.5 text-[11px] text-mist">
              Rules are enforced on the <span className="font-bold text-inherit">Loan Applications</span> page when an application is submitted.
            </p>
          </div>
        </div>

        {/* Live calculator */}
        <div className="card h-fit p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Calculator className="size-4 text-lime" /> Loan calculator</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Sample salary">
              <Input type="number" min={0} value={calc.salary} onChange={(e) => setCalc({ ...calc, salary: e.target.value })} />
            </Field>
            <Field label="Principal">
              <Input type="number" min={0} value={calc.principal} onChange={(e) => setCalc({ ...calc, principal: e.target.value })} />
            </Field>
            <Field label="Months">
              <Input type="number" min={1} value={calc.months} onChange={(e) => setCalc({ ...calc, months: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3 space-y-1.5 rounded-xl border border-line p-3 text-sm">
            <p className="flex justify-between"><span className="text-mist">Borrowing cap</span><span className="font-bold">{ghs(c.cap)}</span></p>
            <p className="flex justify-between"><span className="text-mist">Total repayable</span><span className="font-bold">{ghs(c.sch.total)}</span></p>
            <p className="flex justify-between"><span className="text-mist">Monthly installment</span><span className="font-extrabold text-lime">{ghs(c.sch.monthly)}</span></p>
            <p className="flex justify-between"><span className="text-mist">First due date</span><span className="font-bold">day {Number(form.payDay) || 28} · {c.firstDue.slice(0, 7)}</span></p>
            {c.overCap && <p className="flex items-center justify-between font-bold text-ember"><span>Exceeds cap by</span><span>{ghs(c.principal - c.cap)}</span></p>}
            {!c.overCap && c.principal > 0 && <p className="text-right font-bold text-lime">✓ Within policy</p>}
          </div>
        </div>

        {/* Portfolio overview */}
        <div className="card h-fit p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Layers className="size-4 text-lime" /> Portfolio by status</p>
          <div className="space-y-2">
            {(Object.keys(LOAN_STATUS) as StaffLoanStatus[]).map((st) => {
              const max = Math.max(1, ...Object.values(portfolio.by))
              return (
                <div key={st} className="flex items-center gap-2">
                  <Badge tone="zinc" className="w-24 justify-center">{LOAN_STATUS[st].label}</Badge>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${(portfolio.by[st] / max) * 100}%`, background: LOAN_STATUS[st].color }} />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-mist">{portfolio.by[st]}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-mist"><CalendarCheck className="size-3.5" /> Installments fall due on day {Number(form.payDay) || 28}; overdue after {Number(form.graceDays) || 0} grace day(s).</p>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-ember">{err}</p>}
    </div>
  )
}
