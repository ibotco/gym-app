import { useMemo, useState } from 'react'
import { Clock, UserCheck, UserX, CalendarClock, Timer, TrendingUp, Printer } from 'lucide-react'
import { PageHeader, Button, Badge, StatCard, Select, Modal, Field, Input, DatePicker, Switch } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import type { StaffAttendance, StaffAttendanceStatus } from '../../../types'

export const ATT_STATUS: Record<StaffAttendanceStatus, { label: string; short: string; color: string }> = {
  present: { label: 'Present', short: 'P', color: '#22c55e' },
  late: { label: 'Late', short: 'L', color: '#f59e0b' },
  absent: { label: 'Absent', short: 'A', color: '#ef4444' },
  leave: { label: 'On leave', short: 'V', color: '#0ea5e9' },
}
export const ATT_ORDER: StaffAttendanceStatus[] = ['present', 'late', 'absent', 'leave']

export function StatusChip({ status }: { status: StaffAttendanceStatus }) {
  const m = ATT_STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: m.color, color: m.color, background: `${m.color}14` }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
    </span>
  )
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export function AttendanceDashboard() {
  const app = useApp()
  const { staffAttendance, staff, users, upsertStaffAttendance, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [deptFilter, setDeptFilter] = useState('')
  const [marking, setMarking] = useState<{ staffUserId: string; name: string; date: string } | null>(null)
  const [markForm, setMarkForm] = useState<{ status: StaffAttendanceStatus; checkIn: string; checkOut: string; notes: string }>({ status: 'present', checkIn: '08:00', checkOut: '17:00', notes: '' })

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const departments = useMemo(() => [...new Set(staff.map((s) => s.department))].sort(), [staff])
  const roster = useMemo(
    () => staff.filter((s) => !deptFilter || s.department === deptFilter),
    [staff, deptFilter],
  )

  const today = new Date().toISOString().slice(0, 10)
  const todayRec = (userId: string) => staffAttendance.find((a) => a.staffUserId === userId && a.date === today)

  const stats = useMemo(() => {
    const recs = roster.map((s) => todayRec(s.userId)).filter(Boolean) as StaffAttendance[]
    const present = recs.filter((r) => r.status === 'present').length
    const late = recs.filter((r) => r.status === 'late').length
    const leave = recs.filter((r) => r.status === 'leave').length
    const absent = recs.filter((r) => r.status === 'absent').length
    const unmarked = roster.length - recs.length
    const rate = roster.length ? Math.round(((present + late) / roster.length) * 100) : 0
    return { present, late, leave, absent, unmarked, rate }
  }, [roster, staffAttendance, today]) // eslint-disable-line react-hooks/exhaustive-deps

  /* 14-day attendance-rate trend */
  const trend = useMemo(() => {
    const out: { date: string; rate: number; present: number; total: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const isoD = d.toISOString().slice(0, 10)
      const total = roster.length || 1
      const present = staffAttendance.filter((a) => a.date === isoD && (a.status === 'present' || a.status === 'late')).length
      out.push({ date: isoD, rate: Math.round((present / total) * 100), present, total: roster.length })
    }
    return out
  }, [staffAttendance, roster.length])

  const openMark = (userId: string) => {
    setMarking({ staffUserId: userId, name: staffName(userId), date: today })
    setMarkForm({ status: 'present', checkIn: '08:00', checkOut: '17:00', notes: '' })
  }
  const saveMark = () => {
    if (!marking) return
    const existing = todayRec(marking.staffUserId)
    const rec: StaffAttendance = {
      id: existing?.id || uid('att'),
      staffUserId: marking.staffUserId,
      date: marking.date,
      checkIn: markForm.checkIn || undefined,
      checkOut: markForm.checkOut || undefined,
      status: markForm.status,
      branchId: existing?.branchId,
      notes: markForm.notes.trim() || undefined,
    }
    upsertStaffAttendance(rec)
    log(user?.id || 'system', existing ? 'UPDATE' : 'CREATE', 'Attendance', `Marked ${marking.name} ${markForm.status} for ${formatDate(marking.date)}`)
    toast.success(`Marked ${ATT_STATUS[markForm.status].label.toLowerCase()}`, marking.name)
    setMarking(null)
  }

  const unmarked = roster.filter((s) => !todayRec(s.userId))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Attendance</span><span>/</span>
        <span className="font-semibold text-inherit">Dashboard</span>
      </div>
      <PageHeader
        title="Attendance Dashboard"
        desc={`Live view of today's attendance — ${formatDate(today)}.`}
        actions={
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="max-w-[190px]" aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        }
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Attendance rate" value={`${stats.rate}%`} icon={<TrendingUp className="size-4" />} hint="present + late" />
        <StatCard label="Present" value={String(stats.present)} icon={<UserCheck className="size-4" />} />
        <StatCard label="Late" value={String(stats.late)} icon={<Clock className="size-4" />} />
        <StatCard label="On leave" value={String(stats.leave)} icon={<CalendarClock className="size-4" />} />
        <StatCard label="Absent" value={String(stats.absent)} icon={<UserX className="size-4" />} />
        <StatCard label="Unmarked" value={String(stats.unmarked)} icon={<Timer className="size-4" />} hint="awaiting mark" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        {/* Today's roster */}
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-extrabold">Today's roster</p>
            <div className="flex items-center gap-2">
              {ATT_ORDER.map((st) => (
                <span key={st} className="flex items-center gap-1 text-[10px] font-semibold text-mist">
                  <span className="size-2 rounded-full" style={{ background: ATT_STATUS[st].color }} /> {ATT_STATUS[st].label}
                </span>
              ))}
            </div>
          </div>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Staff</th>
                <th className="px-3 py-2.5">Department</th>
                <th className="px-3 py-2.5">Check in</th>
                <th className="px-3 py-2.5">Check out</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const rec = todayRec(s.userId)
                return (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: rec ? ATT_STATUS[rec.status].color : '#64748b' }}>
                          {initials(staffName(s.userId))}
                        </span>
                        {staffName(s.userId)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-mist">{s.department}</td>
                    <td className="px-3 py-2 text-mist">{rec?.checkIn || '—'}</td>
                    <td className="px-3 py-2 text-mist">{rec?.checkOut || '—'}</td>
                    <td className="px-3 py-2">{rec ? <StatusChip status={rec.status} /> : <Badge tone="zinc">Not marked</Badge>}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <Button size="sm" variant={rec ? 'ghost' : 'soft'} onClick={() => openMark(s.userId)}>
                          {rec ? 'Edit mark' : 'Mark'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!roster.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">No staff in this department.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* 14-day trend */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><TrendingUp className="size-4 text-lime" /> 14-day attendance rate</p>
            <div className="flex h-24 items-end gap-1">
              {trend.map((t) => (
                <div key={t.date} className="group relative flex-1">
                  <div className="w-full rounded-t" style={{ height: `${Math.max(4, t.rate * 0.9)}px`, background: t.rate >= 80 ? '#84cc16' : t.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                    {t.date.slice(8)}/{t.date.slice(5, 7)} · {t.rate}%
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-mist">Hover a bar for the day · colour = rate band.</p>
          </div>

          {/* Awaiting mark */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Timer className="size-4 text-amber-400" /> Awaiting mark ({unmarked.length})</p>
            {!unmarked.length && <p className="text-sm text-mist">Everyone is marked for today. 🎉</p>}
            <div className="space-y-2">
              {unmarked.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl border border-line p-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-500/15 text-[10px] font-extrabold text-mist">{initials(staffName(s.userId))}</span>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{staffName(s.userId)}</p>
                  {canManage && (
                    <span className="flex gap-1">
                      <button className="rounded-md px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: ATT_STATUS.present.color }} onClick={() => { openMark(s.userId); setMarkForm((f) => ({ ...f, status: 'present' })) }}>P</button>
                      <button className="rounded-md px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: ATT_STATUS.late.color }} onClick={() => { openMark(s.userId); setMarkForm((f) => ({ ...f, status: 'late' })) }}>L</button>
                      <button className="rounded-md px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: ATT_STATUS.absent.color }} onClick={() => { openMark(s.userId); setMarkForm((f) => ({ ...f, status: 'absent' })) }}>A</button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mark modal */}
      <Modal open={!!marking} onClose={() => setMarking(null)} title={marking ? `Mark attendance — ${marking.name}` : ''}>
        <div className="grid gap-3">
          <Field label="Status">
            <div className="flex gap-2">
              {ATT_ORDER.map((st) => (
                <button
                  key={st}
                  onClick={() => setMarkForm((f) => ({ ...f, status: st }))}
                  className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition ${markForm.status === st ? 'text-white' : 'text-mist'}`}
                  style={{ borderColor: ATT_STATUS[st].color, background: markForm.status === st ? ATT_STATUS[st].color : 'transparent' }}
                >
                  {ATT_STATUS[st].label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in"><Input type="time" value={markForm.checkIn} onChange={(e) => setMarkForm((f) => ({ ...f, checkIn: e.target.value }))} /></Field>
            <Field label="Check out"><Input type="time" value={markForm.checkOut} onChange={(e) => setMarkForm((f) => ({ ...f, checkOut: e.target.value }))} /></Field>
          </div>
          <Field label="Notes"><Input value={markForm.notes} onChange={(e) => setMarkForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></Field>
          <Button onClick={saveMark}>Save mark</Button>
        </div>
      </Modal>
    </div>
  )
}
