import { useMemo, useState, type FormEvent } from 'react'
import { CalendarRange, Percent, TrendingUp, Trash2, Users } from 'lucide-react'
import { Badge, Button, Field, Input, MonthYearPicker, MultiSelect, PageHeader, Select, StatCard, Switch, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import {
  currentPayrollPeriod,
  DEFAULT_SALARY_INCREASE_TARGET,
  describeSalaryIncrease,
  formatPayrollPeriod,
  lastAnnualOccurrenceBefore,
  lastAnnualOccurrenceOnOrBefore,
  loadSalaryIncreaseSettings,
  nextPayrollPeriod,
  normalizeSalaryIncreaseTarget,
  sameSalaryIncreaseTarget,
  salaryIncreaseTargetLabel,
  salaryIncreaseTargetMatches,
  saveSalaryIncreaseSettings,
  type AnnualSalaryIncreasePolicy,
  type ManualSalaryIncrease,
  type SalaryIncreaseAmountType,
  type SalaryIncreaseSettings,
  type SalaryIncreaseTarget,
  type SalaryIncreaseTargetScope,
} from '../../../lib/salaryIncreases'

function previousPayrollPeriod(period: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period
  const year = Number(match[1])
  const month = Number(match[2])
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

function validIncreaseAmount(amountType: SalaryIncreaseAmountType, amount: number) {
  return Number.isFinite(amount) && amount > 0 && (amountType !== 'percent' || amount <= 100)
}

export function SalaryIncreaseSettingsPage() {
  const { staff, users, salaryStructures, salaryAssignments, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const currentPeriod = currentPayrollPeriod()
  const [settings, setSettings] = useState<SalaryIncreaseSettings>(() => loadSalaryIncreaseSettings())
  const activePolicy = settings.annualPolicies.find((policy) => !policy.endEffectivePeriod)

  const [annualForm, setAnnualForm] = useState(() => {
    const policy = loadSalaryIncreaseSettings().annualPolicies.find((item) => !item.endEffectivePeriod)
    return {
      enabled: !!policy,
      amountType: policy?.amountType || 'percent' as SalaryIncreaseAmountType,
      amount: policy ? String(policy.amount) : '',
      firstEffectivePeriod: policy?.firstEffectivePeriod || nextPayrollPeriod(),
      target: normalizeSalaryIncreaseTarget(policy?.target),
    }
  })
  const [manualForm, setManualForm] = useState({
    amountType: 'percent' as SalaryIncreaseAmountType,
    amount: '',
    effectivePeriod: nextPayrollPeriod(),
    note: '',
    target: DEFAULT_SALARY_INCREASE_TARGET,
  })

  const activeStaff = useMemo(
    () => staff.filter((record) => users.some((person) => person.id === record.userId && person.status === 'active')),
    [staff, users],
  )
  const assignmentByUser = useMemo(
    () => new Map(salaryAssignments.map((assignment) => [assignment.staffUserId, assignment])),
    [salaryAssignments],
  )
  const targetOptions = useMemo(() => ({
    structure: salaryStructures.map((structure) => ({ value: structure.id, label: structure.name })),
    department: [...new Set(staff.map((record) => record.department).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((department) => ({ value: department, label: department })),
    individual: staff.map((record) => {
      const person = users.find((item) => item.id === record.userId)
      const status = person?.status === 'active' ? '' : ' · inactive'
      return { value: record.userId, label: `${person?.name || record.userId} · ${record.title}${status}` }
    }).sort((a, b) => a.label.localeCompare(b.label)),
  }), [salaryStructures, staff, users])
  const targetOptionsFor = (scope: SalaryIncreaseTargetScope) => scope === 'all' ? [] : targetOptions[scope]
  const matchingActiveStaff = (target: SalaryIncreaseTarget) => activeStaff.filter((record) =>
    salaryIncreaseTargetMatches(target, {
      staffUserId: record.userId,
      department: record.department,
      salaryStructureId: assignmentByUser.get(record.userId)?.structureId,
    }),
  )
  const targetDescription = (target?: SalaryIncreaseTarget) => {
    const normalized = normalizeSalaryIncreaseTarget(target)
    if (normalized.scope === 'all') return 'All active staff'
    const options = targetOptionsFor(normalized.scope)
    const names = normalized.values.map((value) => {
      const option = options.find((item) => item.value === value)
      if (option) return option.label
      return normalized.scope === 'individual' ? users.find((person) => person.id === value)?.name || value : value
    })
    const shown = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
    return `${salaryIncreaseTargetLabel(normalized)}: ${shown || 'No selection'}`
  }
  const scheduledManualCount = settings.manualIncreases.filter((increase) => increase.effectivePeriod > currentPeriod).length

  const persist = (next: SalaryIncreaseSettings) => {
    saveSalaryIncreaseSettings(next)
    setSettings(next)
  }

  const saveAnnualPolicy = () => {
    if (!annualForm.enabled) {
      if (!activePolicy) {
        toast.success('No active annual policy')
        return
      }
      const lastOccurrence = lastAnnualOccurrenceOnOrBefore(activePolicy, currentPeriod)
      const closedThrough = lastOccurrence || previousPayrollPeriod(activePolicy.firstEffectivePeriod)
      const next: SalaryIncreaseSettings = {
        ...settings,
        annualPolicies: settings.annualPolicies.map((policy) => policy.id === activePolicy.id
          ? { ...policy, endEffectivePeriod: closedThrough }
          : policy),
      }
      persist(next)
      log(user?.id || 'system', 'UPDATE', 'Payroll', `Stopped recurring salary increase after ${closedThrough}`)
      toast.success('Annual increase policy stopped', 'Already-effective increases remain part of future salary calculations.')
      return
    }

    const amount = Number(annualForm.amount)
    if (!validIncreaseAmount(annualForm.amountType, amount)) {
      toast.error(annualForm.amountType === 'percent' ? 'Enter a percentage greater than 0 and no more than 100.' : 'Enter a fixed increase greater than zero.')
      return
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(annualForm.firstEffectivePeriod) || annualForm.firstEffectivePeriod < currentPeriod) {
      toast.error('Choose a valid current or future first increase month.')
      return
    }
    if (annualForm.target.scope !== 'all' && !annualForm.target.values.length) {
      toast.error('Select at least one structure, department, or staff member for the policy.')
      return
    }
    if (activePolicy && activePolicy.amountType === annualForm.amountType && activePolicy.amount === amount && activePolicy.firstEffectivePeriod === annualForm.firstEffectivePeriod && sameSalaryIncreaseTarget(activePolicy.target, annualForm.target)) {
      toast.success('Annual increase policy is up to date')
      return
    }

    const annualPolicies = settings.annualPolicies.map((policy) => {
      if (policy.id !== activePolicy?.id) return policy
      const lastOccurrence = lastAnnualOccurrenceBefore(policy, annualForm.firstEffectivePeriod)
      return { ...policy, endEffectivePeriod: lastOccurrence || previousPayrollPeriod(policy.firstEffectivePeriod) }
    })
    const nextPolicy: AnnualSalaryIncreasePolicy = {
      id: uid('sir'),
      amountType: annualForm.amountType,
      amount: Math.round(amount * 100) / 100,
      firstEffectivePeriod: annualForm.firstEffectivePeriod,
      target: normalizeSalaryIncreaseTarget(annualForm.target),
      createdAt: new Date().toISOString(),
    }
    persist({ ...settings, annualPolicies: [...annualPolicies, nextPolicy] })
    log(user?.id || 'system', activePolicy ? 'UPDATE' : 'CREATE', 'Payroll', `Set annual salary increase to ${describeSalaryIncrease(nextPolicy.amountType, nextPolicy.amount)} from ${nextPolicy.firstEffectivePeriod} for ${targetDescription(nextPolicy.target)}`)
    toast.success(activePolicy ? 'Annual increase policy updated' : 'Annual increase policy enabled', `${describeSalaryIncrease(nextPolicy.amountType, nextPolicy.amount)} · first effective ${formatPayrollPeriod(nextPolicy.firstEffectivePeriod)} · ${targetDescription(nextPolicy.target)}`)
  }

  const scheduleManualIncrease = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(manualForm.amount)
    if (!validIncreaseAmount(manualForm.amountType, amount)) {
      toast.error(manualForm.amountType === 'percent' ? 'Enter a percentage greater than 0 and no more than 100.' : 'Enter a fixed increase greater than zero.')
      return
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(manualForm.effectivePeriod) || manualForm.effectivePeriod < currentPeriod) {
      toast.error('Choose a valid current or future increase month.')
      return
    }
    if (manualForm.target.scope !== 'all' && !manualForm.target.values.length) {
      toast.error('Select at least one structure, department, or staff member for the increase.')
      return
    }
    const recipients = matchingActiveStaff(manualForm.target)
    if (!recipients.length) {
      toast.error('No active staff match the selected target.')
      return
    }
    const target = normalizeSalaryIncreaseTarget(manualForm.target)
    const recipientIds = recipients.map((record) => record.userId)
    const increase: ManualSalaryIncrease = {
      id: uid('sir'),
      amountType: manualForm.amountType,
      amount: Math.round(amount * 100) / 100,
      effectivePeriod: manualForm.effectivePeriod,
      staffUserIds: recipientIds,
      target,
      note: manualForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    persist({ ...settings, manualIncreases: [increase, ...settings.manualIncreases] })
    log(user?.id || 'system', 'CREATE', 'Payroll', `Scheduled a ${describeSalaryIncrease(increase.amountType, increase.amount)} salary increase for ${recipientIds.length} active staff from ${increase.effectivePeriod} targeting ${targetDescription(target)}`)
    toast.success('Salary increase scheduled', `${recipientIds.length} active staff · ${targetDescription(target)} · effective ${formatPayrollPeriod(increase.effectivePeriod)}`)
    setManualForm({ ...manualForm, amount: '', effectivePeriod: nextPayrollPeriod(), note: '' })
  }

  const cancelManualIncrease = (increase: ManualSalaryIncrease) => {
    if (increase.effectivePeriod <= currentPeriod) return
    persist({ ...settings, manualIncreases: settings.manualIncreases.filter((item) => item.id !== increase.id) })
    log(user?.id || 'system', 'DELETE', 'Payroll', `Cancelled salary increase scheduled for ${increase.effectivePeriod}`)
    toast.success('Scheduled increase cancelled')
  }

  const annualHistory = [...settings.annualPolicies].sort((a, b) => b.firstEffectivePeriod.localeCompare(a.firstEffectivePeriod))
  const manualHistory = [...settings.manualIncreases].sort((a, b) => b.effectivePeriod.localeCompare(a.effectivePeriod) || b.createdAt.localeCompare(a.createdAt))
  const hasHistory = annualHistory.length > 0 || manualHistory.length > 0

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Salary Increase</span>
      </div>
      <PageHeader
        title="Salary Increase Settings"
        desc="Set annual or one-time raises for all active staff, selected salary structures, departments, or individual employees."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active staff" value={String(activeStaff.length)} icon={<Users className="size-4" />} />
        <StatCard label="Annual policy" value={activePolicy ? 'Active' : 'Off'} icon={<TrendingUp className="size-4" />} />
        <StatCard label="Scheduled one-time raises" value={String(scheduledManualCount)} icon={<CalendarRange className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Annual increase policy</h2>
              <p className="mt-1 text-sm text-mist">Automatically compounds the increase once a year, starting in the selected payroll month.</p>
            </div>
            <Badge tone={activePolicy ? 'lime' : 'zinc'}>{activePolicy ? 'Active' : 'Off'}</Badge>
          </div>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line p-3">
            <div>
              <p className="text-sm font-semibold">Enable annual increases</p>
              <p className="text-xs text-mist">Applies to active staff matching the selected target.</p>
            </div>
            <Switch checked={annualForm.enabled} onChange={(enabled) => setAnnualForm({ ...annualForm, enabled })} aria-label="Enable annual salary increases" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Increase type">
              <Select value={annualForm.amountType} onChange={(event) => setAnnualForm({ ...annualForm, amountType: event.target.value as SalaryIncreaseAmountType })}>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed GHS amount</option>
              </Select>
            </Field>
            <Field label={annualForm.amountType === 'percent' ? 'Annual increase (%)' : 'Annual increase (GHS)'}>
              <Input type="number" min="0.01" max={annualForm.amountType === 'percent' ? 100 : undefined} step="0.01" value={annualForm.amount} onChange={(event) => setAnnualForm({ ...annualForm, amount: event.target.value })} placeholder={annualForm.amountType === 'percent' ? 'e.g. 5' : 'e.g. 300'} />
            </Field>
            <Field label="Applies to">
              <Select value={annualForm.target.scope} onChange={(event) => setAnnualForm({ ...annualForm, target: { scope: event.target.value as SalaryIncreaseTargetScope, values: [] } })}>
                <option value="all">All active staff</option>
                <option value="structure">Salary structure(s)</option>
                <option value="department">Department(s)</option>
                <option value="individual">Individual staff</option>
              </Select>
            </Field>
            {annualForm.target.scope !== 'all' && (
              <Field label={`Select ${salaryIncreaseTargetLabel(annualForm.target).toLowerCase()}`}>
                <MultiSelect
                  options={targetOptionsFor(annualForm.target.scope)}
                  values={annualForm.target.values}
                  onChange={(values) => setAnnualForm({ ...annualForm, target: { ...annualForm.target, values } })}
                  placeholder="Select one or more"
                  aria-label="Annual salary increase targets"
                />
                <p className="mt-1 text-xs text-mist">{matchingActiveStaff(annualForm.target).length} active staff currently match. Only active staff matching this scope receive each annual raise.</p>
              </Field>
            )}
            <Field label="First effective payroll month" className="sm:col-span-2">
              <MonthYearPicker value={annualForm.firstEffectivePeriod} onChange={(firstEffectivePeriod) => setAnnualForm({ ...annualForm, firstEffectivePeriod })} min={currentPeriod} className="w-full" aria-label="First effective payroll month" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-md text-xs leading-relaxed text-mist">
              {annualForm.enabled
                ? `${targetDescription(annualForm.target)} will receive ${annualForm.amount || 'the configured amount'}${annualForm.amountType === 'percent' ? '%' : ' GHS'} each year from ${formatPayrollPeriod(annualForm.firstEffectivePeriod)}. Currently ${matchingActiveStaff(annualForm.target).length} active staff match.`
                : 'Turning off the policy stops future annual raises; increases already effective remain in future payroll calculations.'}
            </p>
            <Button onClick={saveAnnualPolicy}>
              {annualForm.enabled ? (activePolicy ? 'Save annual policy' : 'Enable annual policy') : 'Stop annual increases'}
            </Button>
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold">One-time increase</h2>
            <p className="mt-1 text-sm text-mist">Schedule a fixed or percentage raise for a selected target. Matching active staff are captured now; the increase becomes ongoing from its effective month.</p>
          </div>
          <form className="grid gap-3" onSubmit={scheduleManualIncrease}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Increase type">
                <Select value={manualForm.amountType} onChange={(event) => setManualForm({ ...manualForm, amountType: event.target.value as SalaryIncreaseAmountType })}>
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed GHS amount</option>
                </Select>
              </Field>
              <Field label={manualForm.amountType === 'percent' ? 'Increase (%)' : 'Increase (GHS)'}>
                <Input type="number" min="0.01" max={manualForm.amountType === 'percent' ? 100 : undefined} step="0.01" value={manualForm.amount} onChange={(event) => setManualForm({ ...manualForm, amount: event.target.value })} placeholder={manualForm.amountType === 'percent' ? 'e.g. 5' : 'e.g. 300'} required />
              </Field>
              <Field label="Applies to">
                <Select value={manualForm.target.scope} onChange={(event) => setManualForm({ ...manualForm, target: { scope: event.target.value as SalaryIncreaseTargetScope, values: [] } })}>
                  <option value="all">All active staff</option>
                  <option value="structure">Salary structure(s)</option>
                  <option value="department">Department(s)</option>
                  <option value="individual">Individual staff</option>
                </Select>
              </Field>
              {manualForm.target.scope !== 'all' && (
                <Field label={`Select ${salaryIncreaseTargetLabel(manualForm.target).toLowerCase()}`}>
                  <MultiSelect
                    options={targetOptionsFor(manualForm.target.scope)}
                    values={manualForm.target.values}
                    onChange={(values) => setManualForm({ ...manualForm, target: { ...manualForm.target, values } })}
                    placeholder="Select one or more"
                    aria-label="One-time salary increase targets"
                  />
                  <p className="mt-1 text-xs text-mist">{matchingActiveStaff(manualForm.target).length} active staff currently match. Recipients are fixed when scheduled.</p>
                </Field>
              )}
              <Field label="Effective payroll month" className="sm:col-span-2">
                <MonthYearPicker value={manualForm.effectivePeriod} onChange={(effectivePeriod) => setManualForm({ ...manualForm, effectivePeriod })} min={currentPeriod} className="w-full" aria-label="Effective payroll month" />
              </Field>
            </div>
            <Field label="Reason / note (optional)">
              <Textarea rows={2} value={manualForm.note} onChange={(event) => setManualForm({ ...manualForm, note: event.target.value })} placeholder="Annual review, promotion, market adjustment…" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-xs text-mist">Captures {matchingActiveStaff(manualForm.target).length} currently active staff member(s) matching this target.</p>
              <Button type="submit" disabled={!matchingActiveStaff(manualForm.target).length}><Percent className="size-4" /> Schedule increase</Button>
            </div>
          </form>
        </section>
      </div>

      <div className="card mt-4 p-4">
        <h2 className="font-bold">How salary increases affect payroll</h2>
        <p className="mt-1 text-sm leading-relaxed text-mist">
          Increases are compounded in effective-month order and flow into the basic salary used by Generate Salary, manual payslip defaults, and salary-assignment estimates. Percentage-based benefits recalculate from the increased basic; fixed benefits stay unchanged. Already-generated payslips are preserved and must be regenerated for a changed payroll month.
        </p>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-extrabold">Increase history</h2>
          <Badge tone="zinc">{annualHistory.length + manualHistory.length} record(s)</Badge>
        </div>
        <table className="w-full min-w-[850px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Increase</th>
              <th className="px-3 py-3">Effective</th>
              <th className="px-3 py-3">Target / staff</th>
              <th className="px-3 py-3">Note</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {annualHistory.map((policy) => (
              <tr key={policy.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 font-semibold">Annual policy</td>
                <td className="px-3 py-2.5">{describeSalaryIncrease(policy.amountType, policy.amount)}</td>
                <td className="px-3 py-2.5 text-mist">From {formatPayrollPeriod(policy.firstEffectivePeriod)} · yearly{policy.endEffectivePeriod ? ` through ${formatPayrollPeriod(policy.endEffectivePeriod)}` : ''}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-mist" title={targetDescription(policy.target)}>{targetDescription(policy.target)}</td>
                <td className="px-3 py-2.5 text-mist">—</td>
                <td className="px-3 py-2.5"><Badge tone={policy.endEffectivePeriod ? 'zinc' : 'lime'}>{policy.endEffectivePeriod ? 'Stopped' : 'Active'}</Badge></td>
                <td className="px-3 py-2.5 text-right text-mist">—</td>
              </tr>
            ))}
            {manualHistory.map((increase) => {
              const scheduled = increase.effectivePeriod > currentPeriod
              return (
                <tr key={increase.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 font-semibold">One-time raise</td>
                  <td className="px-3 py-2.5">{describeSalaryIncrease(increase.amountType, increase.amount)}</td>
                  <td className="px-3 py-2.5 text-mist">{formatPayrollPeriod(increase.effectivePeriod)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-mist" title={`${increase.staffUserIds.length} staff · ${targetDescription(increase.target)}`}>{increase.staffUserIds.length} staff · {targetDescription(increase.target)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-mist" title={increase.note}>{increase.note || '—'}</td>
                  <td className="px-3 py-2.5"><Badge tone={scheduled ? 'amber' : 'lime'}>{scheduled ? 'Scheduled' : 'Effective'}</Badge></td>
                  <td className="px-3 py-2.5 text-right">
                    {scheduled ? (
                      <button type="button" className="rounded-lg p-2 text-mist hover:text-ember" aria-label="Cancel scheduled increase" title="Cancel scheduled increase" onClick={() => cancelManualIncrease(increase)}>
                        <Trash2 className="size-4" />
                      </button>
                    ) : <span className="text-mist">—</span>}
                  </td>
                </tr>
              )
            })}
            {!hasHistory && <tr><td colSpan={7} className="px-4 py-10 text-center text-mist">No salary increases have been configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
