import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, SearchField, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { ATT_STATUS, ATT_ORDER, StatusChip } from './AttendanceDashboard'
import type { StaffAttendance, StaffAttendanceStatus } from '../../../types'

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export function MonthlyAttendance() {
  const app = useApp()
  const { staffAttendance, staff, users, upsertStaffAttendance, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ staffUserId: string; name: string; date: string } | null>(null)
  const [form, setForm] = useState<{ status: StaffAttendanceStatus; checkIn: string; checkOut: string; notes: string }>({ status: 'present', checkIn: '08:00', checkOut: '17:00', notes: '' })

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const ql = q.trim().toLowerCase()
  const rows = useMemo(() => staff.filter((s) => !ql || staffName(s.userId).toLowerCase().includes(ql)), [staff, q, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`

  const recAt = (userId: string, day: number) =>
    staffAttendance.find((a) => a.staffUserId === userId && a.date === `${monthPrefix}-${String(day).padStart(2, '0')}`)

  const totals = (userId: string) => {
    const t: Record<StaffAttendanceStatus, number> = { present: 0, late: 0, absent: 0, leave: 0 }
    for (let d = 1; d <= daysInMonth; d++) {
      const r = recAt(userId, d)
      if (r) t[r.status]++
    }
    return t
  }

  const openCell = (userId: string, name: string, day: number) => {
    if (!canManage) return
    const existing = recAt(userId, day)
    setEditing({ staffUserId: userId, name, date: `${monthPrefix}-${String(day).padStart(2, '0')}` })
    setForm({
      status: existing?.status || 'present',
      checkIn: existing?.checkIn || '08:00',
      checkOut: existing?.checkOut || '17:00',
      notes: existing?.notes || '',
    })
  }
  const save = () => {
    if (!editing) return
    const existing = staffAttendance.find((a) => a.staffUserId === editing.staffUserId && a.date === editing.date)
    const rec: StaffAttendance = {
      id: existing?.id || uid('att'),
      staffUserId: editing.staffUserId,
      date: editing.date,
      checkIn: form.checkIn || undefined,
      checkOut: form.checkOut || undefined,
      status: form.status,
      branchId: existing?.branchId,
      notes: form.notes.trim() || undefined,
    }
    upsertStaffAttendance(rec)
    log(user?.id || 'system', existing ? 'UPDATE' : 'CREATE', 'Attendance', `Marked ${editing.name} ${form.status} for ${formatDate(editing.date)}`)
    toast.success('Attendance saved', `${editing.name} · ${formatDate(editing.date)}`)
    setEditing(null)
  }

  const shiftMonth = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Attendance</span><span>/</span>
        <span className="font-semibold text-inherit">Monthly Attendance</span>
      </div>
      <PageHeader
        title="Monthly Attendance"
        desc="Full-month register per staff member. Click any day cell to mark or edit attendance."
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(-1)} title="Previous month"><ChevronLeft className="size-4" /></button>
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>This month</button>
          <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(1)} title="Next month"><ChevronRight className="size-4" /></button>
        </div>
        <p className="text-base font-extrabold">{monthLabel}</p>
        <SearchField value={q} onChange={setQ} placeholder="Search staff…" className="ml-2 max-w-xs" />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            {ATT_ORDER.map((st) => (
              <span key={st} className="flex items-center gap-1 text-[10px] font-semibold text-mist">
                <span className="size-2 rounded-full" style={{ background: ATT_STATUS[st].color }} /> {ATT_STATUS[st].short}
              </span>
            ))}
          </div>
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename={`attendance-${monthPrefix}`} rows={rows.map((s) => {
            const t = totals(s.userId)
            return {
              Staff: staffName(s.userId), Department: s.department, Present: t.present, Late: t.late,
              Absent: t.absent, 'On leave': t.leave, Marked: t.present + t.late + t.absent + t.leave, Days: daysInMonth,
            }
          })} />
        </div>
      </div>

      {/* Matrix */}
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={{ minWidth: `${150 + daysInMonth * 26 + 190}px` }}>
          <thead>
            <tr className="border-b border-line bg-black/[0.02] dark:bg-white/[0.03]">
              <th className="sticky left-0 z-10 bg-[var(--card-bg,#ffffff)] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-[var(--card-bg,#141416)]">Staff</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const wd = new Date(cursor.y, cursor.m, i + 1).getDay()
                const isoD = `${monthPrefix}-${String(i + 1).padStart(2, '0')}`
                return (
                  <th key={i} className={`px-0.5 py-2.5 text-center text-[10px] font-bold ${isoD === today ? 'bg-lime text-black' : wd === 0 || wd === 6 ? 'bg-black/[0.05] text-mist dark:bg-white/[0.05]' : 'text-mist'}`}>
                    {i + 1}
                  </th>
                )
              })}
              <th className="px-2 py-2.5 text-center text-[10px] font-bold" style={{ color: ATT_STATUS.present.color }}>P</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold" style={{ color: ATT_STATUS.late.color }}>L</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold" style={{ color: ATT_STATUS.absent.color }}>A</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold" style={{ color: ATT_STATUS.leave.color }}>V</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const t = totals(s.userId)
              return (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-lime/[0.02]">
                  <td className="sticky left-0 z-10 bg-[var(--card-bg,#ffffff)] px-3 py-1.5 dark:bg-[var(--card-bg,#141416)]">
                    <span className="flex items-center gap-2 font-bold">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-500/15 text-[9px] font-extrabold text-zinc-600 dark:text-mist">{initials(staffName(s.userId))}</span>
                      <span className="max-w-[140px] truncate">{staffName(s.userId)}</span>
                    </span>
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const rec = recAt(s.userId, day)
                    const wd = new Date(cursor.y, cursor.m, day).getDay()
                    const isoD = `${monthPrefix}-${String(day).padStart(2, '0')}`
                    return (
                      <td key={i} className={`px-0.5 py-1.5 text-center ${isoD === today ? 'bg-lime/10' : wd === 0 || wd === 6 ? 'bg-black/[0.04] dark:bg-white/[0.04]' : ''}`}>
                        <button
                          onClick={() => openCell(s.userId, staffName(s.userId), day)}
                          disabled={!canManage}
                          className={`grid size-6 w-full place-items-center rounded text-[10px] font-extrabold text-white transition ${canManage ? 'hover:brightness-110' : 'cursor-default'} ${!rec ? 'opacity-90' : ''}`}
                          style={{ background: rec ? ATT_STATUS[rec.status].color : '#3f3f46' }}
                          title={`${staffName(s.userId)} · ${day} ${monthLabel.split(' ')[0]}${rec ? ` · ${ATT_STATUS[rec.status].label}${rec.checkIn ? ` (${rec.checkIn}–${rec.checkOut || '…'})` : ''}` : ' · not marked'}`}
                        >
                          {rec ? ATT_STATUS[rec.status].short : '·'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-center font-extrabold" style={{ color: ATT_STATUS.present.color }}>{t.present}</td>
                  <td className="px-2 py-1.5 text-center font-extrabold" style={{ color: ATT_STATUS.late.color }}>{t.late}</td>
                  <td className="px-2 py-1.5 text-center font-extrabold" style={{ color: ATT_STATUS.absent.color }}>{t.absent}</td>
                  <td className="px-2 py-1.5 text-center font-extrabold" style={{ color: ATT_STATUS.leave.color }}>{t.leave}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={daysInMonth + 5} className="px-4 py-10 text-center text-mist">No staff found.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-mist">P present · L late · A absent · V on leave · grey dot = not marked · weekends shaded{canManage && ' · click a cell to mark/edit'}.</p>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Mark — ${editing.name} · ${formatDate(editing.date)}` : ''}>
        <div className="grid gap-3">
          <Field label="Status">
            <div className="flex gap-2">
              {ATT_ORDER.map((st) => (
                <button
                  key={st}
                  onClick={() => setForm((f) => ({ ...f, status: st }))}
                  className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition ${form.status === st ? 'text-white' : 'text-mist'}`}
                  style={{ borderColor: ATT_STATUS[st].color, background: form.status === st ? ATT_STATUS[st].color : 'transparent' }}
                >
                  {ATT_STATUS[st].label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in"><Input type="time" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} /></Field>
            <Field label="Check out"><Input type="time" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} /></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></Field>
          <Button onClick={save}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
