import { useMemo, useState } from 'react'
import { Printer, UserCheck, Wallet, Trash2 } from 'lucide-react'
import { PageHeader, Button, Select, Input, SearchField, Badge } from '../../../components/ui'
import { StaffListFilters } from '../../../components/StaffListFilters'
import { emptyStaffListFilters, matchesStaffListFilters, type StaffListFilterValues } from '../../../lib/staffListFilters'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { structureEstimate } from '../../../lib/payroll'
import { currentPayrollPeriod, loadSalaryIncreaseSettings, salaryBasicForPeriod } from '../../../lib/salaryIncreases'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AssignSalaryPage() {
  const { staff, users, salaryStructures, salaryBenefits, salaryAssignments, upsertSalaryAssignment, deleteSalaryAssignment } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [staffFilters, setStaffFilters] = useState<StaffListFilterValues>(emptyStaffListFilters)
  const [salaryIncreaseSettings] = useState(() => loadSalaryIncreaseSettings())
  const payrollPeriod = currentPayrollPeriod()

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const ql = q.trim().toLowerCase()
  const rows = useMemo(() => staff.filter((record) =>
    matchesStaffListFilters(record, users, staffFilters)
      && (!ql || `${staffName(record.userId)} ${record.employeeNumber || ''}`.toLowerCase().includes(ql))
  ), [staff, q, staffFilters, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const assignmentFor = (userId: string) => salaryAssignments.find((a) => a.staffUserId === userId)

  const netFor = (userId: string) => {
    const a = assignmentFor(userId)
    const st = salaryStructures.find((x) => x.id === a?.structureId)
    if (!st) return null
    const record = staff.find((item) => item.userId === userId)
    const person = users.find((item) => item.id === userId)
    const effectiveBasic = salaryBasicForPeriod({
      baseBasic: a?.basicOverride ?? st.basic,
      staffUserId: userId,
      period: payrollPeriod,
      hireDate: record?.hireDate,
      department: record?.department,
      salaryStructureId: a?.structureId,
      active: person?.status === 'active',
      settings: salaryIncreaseSettings,
    })
    // The structure's own fixed amounts decide the figure, not the benefit defaults.
    return structureEstimate(st, salaryBenefits, effectiveBasic).net
  }

  const setStructure = (userId: string, structureId: string) => {
    const existing = assignmentFor(userId)
    if (!structureId) {
      if (existing) { deleteSalaryAssignment(existing.id); toast.success('Structure removed', staffName(userId)) }
      return
    }
    upsertSalaryAssignment({ id: existing?.id || uid('sa'), staffUserId: userId, structureId, basicOverride: existing?.basicOverride })
    toast.success('Structure assigned', `${staffName(userId)} → ${salaryStructures.find((s) => s.id === structureId)?.name}`)
  }
  const setOverride = (userId: string, value: string) => {
    const existing = assignmentFor(userId)
    if (!existing) return
    upsertSalaryAssignment({ ...existing, basicOverride: value ? Number(value) : undefined })
  }

  const assignedCount = staff.filter((s) => assignmentFor(s.userId)).length

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Assign Salary</span>
      </div>
      <PageHeader
        title="Assign Salary"
        desc={`Attach a salary structure to each staff member — ${assignedCount} of ${staff.length} assigned. Estimates include increases effective this payroll month.`}
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search staff…" className="max-w-xs" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename="salary-assignments" rows={rows.map((s) => {
            const a = assignmentFor(s.userId)
            const st = salaryStructures.find((x) => x.id === a?.structureId)
            return { Staff: staffName(s.userId), 'Staff ID / Employee No.': s.employeeNumber || s.id, Department: s.department, 'Employee status': users.find((u) => u.id === s.userId)?.status || '', Structure: st?.name || '—', Basic: a?.basicOverride ?? st?.basic ?? '', 'Estimated net': netFor(s.userId) ?? '' }
          })} />
        </div>
      </div>
      <div className="card mb-4 p-4">
        <StaffListFilters staff={staff} value={staffFilters} onChange={setStaffFilters} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Structure</th>
              <th className="px-3 py-3">Basic override</th>
              <th className="px-3 py-3 text-right">Estimated net</th>
              <th className="px-3 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const a = assignmentFor(s.userId)
              const net = netFor(s.userId)
              return (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                  <td className="px-3 py-2.5 font-bold">{staffName(s.userId)}</td>
                  <td className="px-3 py-2.5 text-mist">{s.department}</td>
                  <td className="px-3 py-2.5">
                    <Select value={a?.structureId || ''} onChange={(e) => setStructure(s.userId, e.target.value)} className="max-w-[190px]" aria-label="Salary structure">
                      <option value="">— Not assigned —</option>
                      {salaryStructures.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number" min={0} disabled={!a}
                      value={a?.basicOverride ?? ''}
                      onChange={(e) => setOverride(s.userId, e.target.value)}
                      placeholder={a ? 'use structure basic' : '—'}
                      className="max-w-[130px]"
                      aria-label="Basic override"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-lime">{net !== null ? ghs(net) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    {a ? <Badge tone="lime"><UserCheck className="size-3" /> Assigned</Badge> : <Badge tone="zinc"><Wallet className="size-3" /> Unassigned</Badge>}
                  </td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">No staff found.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-mist"><Trash2 className="size-3" /> Pick “— Not assigned —” to remove a structure. Overrides apply per staff member only.</p>
    </div>
  )
}
