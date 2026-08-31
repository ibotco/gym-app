import { useState } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import { PageHeader, Button, StatusBadge, Badge, Modal, Field, Input, Select, DatePicker, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import type { LeaveRequest } from '../../../types'

const LEAVE_TYPES = ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other']

export function Leave() {
  const app = useApp()
  const { leaves, staff, users, upsertLeave, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id?: string; staffUserId: string; type: string; from: string; to: string; reason: string } | null>(null)

  const staffName = (uid: string) => users.find((u) => u.id === uid)?.name || uid

  const pending = leaves.filter((l) => l.status === 'pending').length
  const approved = leaves.filter((l) => l.status === 'approved').length

  const openNew = () => setEditing({ staffUserId: staff[0]?.userId || '', type: 'Annual', from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), reason: '' })

  const save = () => {
    if (!editing) return
    if (!editing.staffUserId) { toast.error('Select a staff member.'); return }
    if (!editing.from || !editing.to) { toast.error('Select leave dates.'); return }
    if (editing.to < editing.from) { toast.error('End date must be on or after the start date.'); return }
    const isNew = !editing.id
    const rec: LeaveRequest = {
      id: editing.id || uid('lv'),
      staffUserId: editing.staffUserId,
      from: editing.from,
      to: editing.to,
      type: editing.type,
      status: isNew ? 'pending' : (leaves.find((l) => l.id === editing.id)?.status || 'pending'),
      reason: editing.reason.trim() || undefined,
    }
    upsertLeave(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Leave', `${isNew ? 'Requested' : 'Updated'} leave for ${staffName(rec.staffUserId)}`)
    toast.success(isNew ? 'Leave requested' : 'Leave updated')
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Leave management"
        desc="Track staff leave requests and balances."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New leave request</Button> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total requests" value={String(leaves.length)} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Pending" value={String(pending)} />
        <StatCard label="Approved" value={String(approved)} />
      </div>

      <div className="card mt-4 table-wrap">
        <table className="data">
          <thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {[...leaves].sort((a, b) => b.from.localeCompare(a.from)).map((l) => (
              <tr key={l.id}>
                <td className="font-semibold">{staffName(l.staffUserId)}</td>
                <td>{l.type}</td>
                <td className="text-mist">{formatDate(l.from)}</td>
                <td className="text-mist">{formatDate(l.to)}</td>
                <td className="text-mist">{l.reason || '—'}</td>
                <td><StatusBadge status={l.status} /></td>
                <td className="space-x-2">
                  {l.status === 'pending' && canManage && (
                    <>
                      <Button size="sm" onClick={() => { upsertLeave({ ...l, status: 'approved' }); log(user?.id || 'system', 'UPDATE', 'Leave', `Approved ${staffName(l.staffUserId)}`); toast.success('Approved') }}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => { upsertLeave({ ...l, status: 'rejected' }); toast.success('Rejected') }}>Reject</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit leave' : 'New leave request'}>
        {editing && (
          <div className="grid gap-3">
            <Field label="Staff member">
              <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                {staff.map((s) => {
                  const u = users.find((x) => x.id === s.userId)
                  return <option key={s.id} value={s.userId}>{u?.name}</option>
                })}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><DatePicker value={editing.from} onChange={(v) => setEditing({ ...editing, from: v })} /></Field>
              <Field label="To"><DatePicker value={editing.to} onChange={(v) => setEditing({ ...editing, to: v })} /></Field>
            </div>
            <Field label="Reason"><Input value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} placeholder="Optional" /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Submit request'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
