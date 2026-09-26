import { useMemo, useState } from 'react'
import { Printer, UserCheck, Wallet, Trash2 } from 'lucide-react'
import { PageHeader, Button, Select, Input, SearchField, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { benefitAmount } from '../../../lib/payroll'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AssignSalaryPage() {
  const { staff, users, salaryStructures, salaryBenefits, salaryAssignments, upsertSalaryAssignment, deleteSalaryAssignment } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const departments = useMemo(() => [...new Set(staff.map((s) => s.department))].sort(), [staff])
  const ql = q.trim().toLowerCase()
  const rows = useMemo(() => staff.filter((s) => (!dept || s.department === dept) && (!ql || staffName(s.userId).toLowerCase().includes(ql))), [staff, q, dept, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const assignmentFor = (userId: string) => salaryAssignments.find((a) => a.staffUserId === userId)

  const netFor = (userId: string) => {
    const a = assignmentFor(userId)
    const st = salaryStructures.find((x) => x.id === a?.structureId)
    if (!st) return null
    const basic = a?.basicOverride ?? st.basic
    let net = basic
    for (const id of st.benefitIds) {
      const b = salaryBenefits.find((x) => x.id === id)
      if (!b) continue
      net += b.kind === 'allowance' ? benefitAmount(b, basic) : -benefitAmount(b, basic)
    }
    return net
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
        desc={`Attach a salary structure to each staff member — ${assignedCount} of ${staff.length} assigned.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search staff…" className="max-w-xs" />
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="max-w-[190px]" aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename="salary-assignments" rows={staff.map((s) => {
            const a = assignmentFor(s.userId)
            const st = salaryStructures.find((x) => x.id === a?.structureId)
            return { Staff: staffName(s.userId), Department: s.department, Structure: st?.name || '—', Basic: a?.basicOverride ?? st?.basic ?? '', 'Estimated net': netFor(s.userId) ?? '' }
          })} />
        </div>
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
