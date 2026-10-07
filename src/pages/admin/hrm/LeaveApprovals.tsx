import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, Zap } from 'lucide-react'
import { PageHeader, Button, Badge, SearchField } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../lib/utils'
import { leaveDays, loadLeaveRules, ruleForRequest, type LeaveApprovalRule } from '../../../lib/leaveExtras'

export function LeaveApprovalsPage() {
  const { leaves, leaveTypes, users, upsertLeave, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canApprove = hasRole('super_admin', 'gym_manager')
  const [q, setQ] = useState('')
  const rules = useMemo(() => loadLeaveRules(), []) as LeaveApprovalRule[]

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const typeName = (id: string) => leaveTypes.find((t) => t.id === id)?.name || id
  const typeColor = (id: string) => leaveTypes.find((t) => t.id === id)?.color || '#71717a'

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return leaves
      .filter((l) => l.status === 'pending')
      .filter((l) => !ql || `${staffName(l.staffUserId)} ${typeName(l.type)} ${l.reason || ''}`.toLowerCase().includes(ql))
      .sort((a, b) => a.from.localeCompare(b.from))
  }, [leaves, q, users, leaveTypes])

  const decide = (id: string, status: 'approved' | 'rejected') => {
    const l = leaves.find((x) => x.id === id)
    if (!l) return
    upsertLeave({ ...l, status })
    log(user?.id || 'system', 'UPDATE', 'Leave', `${status === 'approved' ? 'Approved' : 'Rejected'} leave for ${staffName(l.staffUserId)}`)
    toast.success(status === 'approved' ? 'Leave approved' : 'Leave rejected', `${staffName(l.staffUserId)} · ${typeName(l.type)}`)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span className="font-semibold text-inherit">Leave Approvals</span>
      </div>
      <PageHeader
        title="Leave Approvals"
        desc="Pending requests waiting for a decision. Rules below mark which requests qualify for auto-approval."
        actions={<SearchField value={q} onChange={setQ} placeholder="Search staff, type, reason…" className="w-full sm:w-72" />}
      />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Staff</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Dates</th>
                <th className="px-3 py-2.5 text-right">Days</th><th className="px-3 py-2.5">Reason</th><th className="px-3 py-2.5">Approval rule</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const days = leaveDays(l)
                const rule = ruleForRequest(rules, l, days)
                return (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5 font-bold">{staffName(l.staffUserId)}</td>
                    <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold" style={{ background: `${typeColor(l.type)}22`, color: typeColor(l.type) }}>{typeName(l.type)}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-mist">{formatDate(l.from)} – {formatDate(l.to)}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">{days}</td>
                    <td className="max-w-52 truncate px-3 py-2.5 text-mist">{l.reason || '—'}</td>
                    <td className="px-3 py-2.5">
                      {rule
                        ? <Badge tone={rule.autoApprove ? 'lime' : 'sky'}>{rule.autoApprove && <Zap className="size-3" />} {rule.name}</Badge>
                        : <Badge tone="zinc">No rule</Badge>}
                    </td>
                    <td className="px-3 py-2.5">
                      {canApprove ? (
                        <span className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => decide(l.id, 'approved')}><CheckCircle2 className="size-4" /> Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => decide(l.id, 'rejected')}><XCircle className="size-4 text-ember" /> Reject</Button>
                        </span>
                      ) : <span className="text-mist">—</span>}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-mist">🎉 No pending leave requests.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-mist">
          <span>{rows.length} pending</span>
          <span>{rows.filter((l) => ruleForRequest(rules, l, leaveDays(l))?.autoApprove).length} eligible for auto-approval</span>
        </div>
      </div>
    </div>
  )
}
