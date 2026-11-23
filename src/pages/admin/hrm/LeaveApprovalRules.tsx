import { useState } from 'react'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { loadLeaveRules, saveLeaveRules, type LeaveApprovalRule } from '../../../lib/leaveExtras'
import { uid } from '../../../lib/utils'

const ROLES = ['super_admin', 'gym_manager', 'company_admin', 'head_office', 'branch_admin']

type Form = { id?: string; name: string; leaveTypeId: string; maxDays: string; autoApprove: boolean; approverRoles: string[]; priority: string; active: boolean }

export function LeaveApprovalRulesPage() {
  const { leaveTypes, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [rules, setRules] = useState<LeaveApprovalRule[]>(() => loadLeaveRules())
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<LeaveApprovalRule | null>(null)

  const typeName = (id: string) => (id ? leaveTypes.find((t) => t.id === id)?.name || id : 'Any type')
  const persist = (next: LeaveApprovalRule[]) => { setRules(next); saveLeaveRules(next) }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Rule name is required.'); return }
    const maxDays = Number(editing.maxDays)
    if (!Number.isFinite(maxDays) || maxDays < 1) { toast.error('Max days must be at least 1.'); return }
    if (!editing.approverRoles.length) { toast.error('Pick at least one approver role.'); return }
    const rec: LeaveApprovalRule = {
      id: editing.id || uid('lr'), name: editing.name.trim(), leaveTypeId: editing.leaveTypeId,
      maxDays, autoApprove: editing.autoApprove, approverRoles: editing.approverRoles,
      priority: Number(editing.priority) || 99, active: editing.active,
    }
    persist(editing.id ? rules.map((r) => (r.id === rec.id ? rec : r)) : [...rules, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'LeaveApprovalRule', `${editing.id ? 'Updated' : 'Created'} rule "${rec.name}"`)
    toast.success(editing.id ? 'Rule updated' : 'Rule created')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    persist(rules.filter((r) => r.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'LeaveApprovalRule', `Deleted rule "${deleting.name}"`)
    toast.success('Rule deleted')
    setDeleting(null)
  }

  const sorted = [...rules].sort((a, b) => a.priority - b.priority)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span>Leave</span><span>/</span><span className="font-semibold text-inherit">Leave Approval Rules</span>
      </div>
      <PageHeader
        title="Leave Approval Rules"
        desc="Evaluate top-down by priority: the first matching active rule decides the approvers and whether short requests auto-approve."
        actions={canManage ? <Button onClick={() => setEditing({ name: '', leaveTypeId: '', maxDays: '2', autoApprove: false, approverRoles: ['gym_manager'], priority: String(rules.length + 1), active: true })}><Plus className="size-4" /> New rule</Button> : undefined}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((r) => (
          <div key={r.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-extrabold">{r.name}</p>
              <Badge tone={r.active ? 'lime' : 'zinc'}>{r.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
            </div>
            <p className="mt-2 text-[12px] text-mist">Applies to <span className="font-bold text-inherit">{typeName(r.leaveTypeId)}</span> up to <span className="font-bold text-inherit">{r.maxDays} day(s)</span>.</p>
            {r.autoApprove && <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-lime"><Zap className="size-3.5" /> Auto-approves matching requests</p>}
            <p className="mt-2 text-[11px] text-mist">Approvers: {r.approverRoles.join(', ')}</p>
            <p className="text-[11px] text-mist">Priority {r.priority}</p>
            {canManage && (
              <div className="mt-auto flex gap-1 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setEditing({ id: r.id, name: r.name, leaveTypeId: r.leaveTypeId, maxDays: String(r.maxDays), autoApprove: r.autoApprove, approverRoles: [...r.approverRoles], priority: String(r.priority), active: r.active })}><Pencil className="size-4" /> Edit</Button>
                <Button variant="ghost" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>
              </div>
            )}
          </div>
        ))}
        {!sorted.length && <div className="card p-10 text-center text-mist md:col-span-2 xl:col-span-3">No approval rules yet.</div>}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit rule' : 'New approval rule'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Rule name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Auto-approve 1-day sick leave" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Leave type">
                <Select value={editing.leaveTypeId} onChange={(e) => setEditing({ ...editing, leaveTypeId: e.target.value })}>
                  <option value="">Any type</option>
                  {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Up to (days)" required><Input type="number" min={1} value={editing.maxDays} onChange={(e) => setEditing({ ...editing, maxDays: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority (lower first)"><Input type="number" min={1} value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} /></Field>
              <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="accent-[#c8f542]" checked={editing.autoApprove} onChange={(e) => setEditing({ ...editing, autoApprove: e.target.checked })} /> Auto-approve
              </label>
            </div>
            <Field label="Approver roles" required>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((role) => {
                  const on = editing.approverRoles.includes(role)
                  return (
                    <button key={role} type="button" onClick={() => setEditing({ ...editing, approverRoles: on ? editing.approverRoles.filter((x) => x !== role) : [...editing.approverRoles, role] })}
                      className={`rounded-lg border-2 px-2.5 py-1 text-[11px] font-extrabold transition ${on ? 'border-lime bg-lime text-black' : 'border-line text-mist'}`}>{role.replace(/_/g, ' ')}</button>
                  )
                })}
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="accent-[#c8f542]" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Rule active
            </label>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>{editing.id ? 'Save rule' : 'Create rule'}</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete rule?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.name}</span>? Pending requests will fall through to the next matching rule.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
