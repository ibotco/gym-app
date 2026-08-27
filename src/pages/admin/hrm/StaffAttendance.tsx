import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Clock, UserCheck, UserX, CalendarClock } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker, StatCard, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import type { StaffAttendance, StaffAttendanceStatus } from '../../../types'

const STATUSES: { id: StaffAttendanceStatus; label: string }[] = [
  { id: 'present', label: 'Present' },
  { id: 'late', label: 'Late' },
  { id: 'absent', label: 'Absent' },
  { id: 'leave', label: 'On leave' },
]

function tone(status: StaffAttendanceStatus): 'lime' | 'amber' | 'rose' | 'sky' {
  if (status === 'present') return 'lime'
  if (status === 'late') return 'amber'
  if (status === 'absent') return 'rose'
  return 'sky'
}

export function StaffAttendance() {
  const app = useApp()
  const { staffAttendance, staff, users, branches, upsertStaffAttendance, deleteStaffAttendance, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id?: string; staffUserId: string; date: string; checkIn: string; checkOut: string; status: StaffAttendanceStatus; branchId: string; notes: string } | null>(null)
  const [deleting, setDeleting] = useState<StaffAttendance | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id

  const today = new Date().toISOString().slice(0, 10)
  const todays = staffAttendance.filter((a) => a.date === today)
  const presentToday = todays.filter((a) => a.status === 'present' || a.status === 'late').length

  // Attendance summary per staff (this month)
  const summary = useMemo(() => {
    const month = today.slice(0, 7)
    return staff.map((s) => {
      const recs = staffAttendance.filter((a) => a.staffUserId === s.userId && a.date.slice(0, 7) === month)
      return {
        userId: s.userId,
        name: staffName(s.userId),
        present: recs.filter((r) => r.status === 'present').length,
        late: recs.filter((r) => r.status === 'late').length,
        absent: recs.filter((r) => r.status === 'absent').length,
        leave: recs.filter((r) => r.status === 'leave').length,
      }
    })
  }, [staff, staffAttendance, today])

  const openNew = () => setEditing({ staffUserId: staff[0]?.userId || '', date: today, checkIn: '08:00', checkOut: '17:00', status: 'present', branchId: 'br_airport', notes: '' })
  const openEdit = (a: StaffAttendance) => setEditing({ id: a.id, staffUserId: a.staffUserId, date: a.date, checkIn: a.checkIn || '', checkOut: a.checkOut || '', status: a.status, branchId: a.branchId || '', notes: a.notes || '' })

  const save = () => {
    if (!editing) return
    if (!editing.staffUserId) { toast.error('Select a staff member.'); return }
    if (!editing.date) { toast.error('Select a date.'); return }
    const isNew = !editing.id
    const rec: StaffAttendance = {
      id: editing.id || uid('sa'),
      staffUserId: editing.staffUserId,
      date: editing.date,
      checkIn: editing.status === 'present' || editing.status === 'late' ? (editing.checkIn || undefined) : undefined,
      checkOut: editing.status === 'present' || editing.status === 'late' ? (editing.checkOut || undefined) : undefined,
      status: editing.status,
      branchId: editing.branchId || undefined,
      notes: editing.notes.trim() || undefined,
    }
    upsertStaffAttendance(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Staff Attendance', `${isNew ? 'Recorded' : 'Updated'} ${staffName(rec.staffUserId)} — ${rec.status} (${rec.date})`)
    toast.success(isNew ? 'Attendance recorded' : 'Attendance updated', staffName(rec.staffUserId))
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Staff attendance"
        desc="Track staff check-in/out, lateness, and absences."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> Record attendance</Button> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff today" value={`${presentToday}/${staff.length}`} icon={<UserCheck className="size-4" />} />
        <StatCard label="Late today" value={String(todays.filter((a) => a.status === 'late').length)} icon={<Clock className="size-4" />} />
        <StatCard label="Absent today" value={String(todays.filter((a) => a.status === 'absent').length)} icon={<UserX className="size-4" />} />
        <StatCard label="On leave today" value={String(todays.filter((a) => a.status === 'leave').length)} icon={<CalendarClock className="size-4" />} />
      </div>

      {/* Monthly summary */}
      <h2 className="font-display mt-8 text-xl">This month's summary</h2>
      <div className="card mt-3 table-wrap">
        <table className="data">
          <thead><tr><th>Staff</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th></tr></thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.userId}>
                <td className="font-semibold">{s.name}</td>
                <td><Badge tone="lime">{s.present}</Badge></td>
                <td><Badge tone="amber">{s.late}</Badge></td>
                <td><Badge tone="rose">{s.absent}</Badge></td>
                <td><Badge tone="sky">{s.leave}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Records */}
      <h2 className="font-display mt-8 text-xl">Records</h2>
      <div className="card mt-3 table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Staff</th><th>Check-in</th><th>Check-out</th><th>Branch</th><th>Status</th><th>Notes</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {[...staffAttendance].sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
              <tr key={a.id}>
                <td className="text-mist">{formatDate(a.date)}</td>
                <td className="font-semibold">{staffName(a.staffUserId)}</td>
                <td>{a.checkIn || '—'}</td>
                <td>{a.checkOut || '—'}</td>
                <td className="text-mist">{branches.find((b) => b.id === a.branchId)?.name || '—'}</td>
                <td><Badge tone={tone(a.status)}>{a.status}</Badge></td>
                <td className="text-mist">{a.notes || '—'}</td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(a)} aria-label="Edit"><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(a)} aria-label="Delete"><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!staffAttendance.length && <Empty title="No attendance records yet" />}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit attendance' : 'Record attendance'}>
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
            <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as StaffAttendanceStatus })}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            {(editing.status === 'present' || editing.status === 'late') && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check-in"><Input type="time" value={editing.checkIn} onChange={(e) => setEditing({ ...editing, checkIn: e.target.value })} /></Field>
                <Field label="Check-out"><Input type="time" value={editing.checkOut} onChange={(e) => setEditing({ ...editing, checkOut: e.target.value })} /></Field>
              </div>
            )}
            <Field label="Branch">
              <Select value={editing.branchId} onChange={(e) => setEditing({ ...editing, branchId: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Notes"><Input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Optional" /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save' : 'Record'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete record?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete attendance for {staffName(deleting.staffUserId)} on {formatDate(deleting.date)}?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteStaffAttendance(deleting.id); toast.success('Record deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
