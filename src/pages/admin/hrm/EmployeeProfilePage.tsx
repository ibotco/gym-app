import { useMemo, useState } from 'react'
import { Mail, Phone, Building2, CalendarDays, Wallet, Star, Clock, Printer, Briefcase, GraduationCap } from 'lucide-react'
import { PageHeader, Button, Badge, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { formatDate } from '../../../lib/utils'
import { ATT_STATUS, StatusChip } from './AttendanceDashboard'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
const AVATAR_COLORS = ['#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function EmployeeProfilePage() {
  const { staff, users, branches, staffAttendance, leaves, payslips, reviews, shifts } = useApp()

  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')

  const name = (id: string) => users.find((u) => u.id === id)?.name || id
  const userOf = (id: string) => users.find((u) => u.id === id)

  const ql = q.trim().toLowerCase()
  const directory = useMemo(
    () => staff.filter((s) => !ql || `${name(s.userId)} ${s.title} ${s.department}`.toLowerCase().includes(ql)).sort((a, b) => name(a.userId).localeCompare(name(b.userId))),
    [staff, q, users], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selected = staff.find((s) => s.userId === selectedId) || directory[0]

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)

  const data = useMemo(() => {
    if (!selected) return null
    const uidv = selected.userId
    const att = staffAttendance.filter((a) => a.staffUserId === uidv && a.date.slice(0, 7) === month)
    const attAll = staffAttendance.filter((a) => a.staffUserId === uidv).sort((a, b) => b.date.localeCompare(a.date))
    const leave = leaves.filter((l) => l.staffUserId === uidv).sort((a, b) => b.from.localeCompare(a.from))
    const slips = payslips.filter((p) => p.staffUserId === uidv).sort((a, b) => b.period.localeCompare(a.period))
    const revs = reviews.filter((r) => r.staffUserId === uidv).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    const myShifts = shifts.filter((sh) => sh.staffUserIds.includes(uidv))
    const counts = { present: 0, late: 0, absent: 0, leave: 0 }
    for (const a of att) counts[a.status]++
    const marked = counts.present + counts.late + counts.absent + counts.leave
    return {
      att, attAll, leave, slips, revs, myShifts, counts, marked,
      rate: marked ? Math.round(((counts.present + counts.late) / marked) * 100) : 0,
    }
  }, [selected, staffAttendance, leaves, payslips, reviews, shifts, month])

  if (!selected || !data) {
    return (
      <div>
        <PageHeader title="Employee Profile" desc="Detailed employee profiles with employment, attendance, leave, payroll and performance history." />
        <div className="card p-10 text-center text-mist">No staff records yet.</div>
      </div>
    )
  }

  const u = userOf(selected.userId)
  const branch = branches.find((b) => b.id === (selected.branchId || u?.branchId))
  const color = AVATAR_COLORS[(name(selected.userId).charCodeAt(0) || 0) % AVATAR_COLORS.length]
  const hired = new Date(`${selected.hireDate}T00:00:00`)
  const tenureMonths = Math.max(0, (new Date().getTime() - hired.getTime()) / (30.44 * 86400000))
  const tenure = tenureMonths >= 12 ? `${Math.floor(tenureMonths / 12)} yr ${Math.round(tenureMonths % 12)} mo` : `${Math.round(tenureMonths)} mo`
  const latestReview = data.revs[0]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Account</span><span>/</span>
        <span className="font-semibold text-inherit">Employee Profile</span>
      </div>
      <PageHeader
        title="Employee Profile"
        desc="One complete record per employee — employment, contact, attendance, leave, payroll and performance."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename={`profile-${name(selected.userId).replace(/\s+/g, '-').toLowerCase()}`} rows={[{
              Name: name(selected.userId), Title: selected.title, Department: selected.department, Branch: branch?.name || '',
              Email: u?.email || '', Phone: u?.phone || '', Hired: selected.hireDate, Salary: selected.salary,
              'Leave balance': selected.leaveBalance, 'Attendance rate (month)': `${data.rate}%`,
            }]} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        {/* Directory */}
        <div className="card h-fit overflow-hidden">
          <div className="border-b border-line p-3">
            <SearchField value={q} onChange={setQ} placeholder="Search staff…" />
          </div>
          <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {directory.map((s) => {
              const active = s.userId === selected.userId
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.userId)}
                  className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition ${active ? 'bg-lime/15 ring-1 ring-lime/50' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: AVATAR_COLORS[(name(s.userId).charCodeAt(0) || 0) % AVATAR_COLORS.length] }} data-tip={name(s.userId)}>
                    {initials(name(s.userId))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{name(s.userId)}</span>
                    <span className="block truncate text-[11px] text-mist">{s.title} · {s.department}</span>
                  </span>
                </button>
              )
            })}
            {!directory.length && <p className="p-3 text-sm text-mist">No matches.</p>}
          </div>
        </div>

        {/* Profile */}
        <div className="min-w-0 space-y-4">
          {/* Header card */}
          <div className="card overflow-hidden">
            <div className="h-1.5" style={{ background: color }} />
            <div className="flex flex-wrap items-center gap-4 p-5">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white" style={{ background: color }} data-tip={name(selected.userId)}>
                {initials(name(selected.userId))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-extrabold">{name(selected.userId)}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-mist">
                  <span className="flex items-center gap-1"><Briefcase className="size-3.5" /> {selected.title}</span>
                  <span className="flex items-center gap-1"><Building2 className="size-3.5" /> {selected.department}</span>
                  {branch && <span>{branch.name}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-mist">
                  {u?.email && <a className="flex items-center gap-1 hover:text-lime" href={`mailto:${u.email}`}><Mail className="size-3" /> {u.email}</a>}
                  {u?.phone && <a className="flex items-center gap-1 hover:text-lime" href={`tel:${u.phone}`}><Phone className="size-3" /> {u.phone}</a>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="zinc">{u?.role.replace('_', ' ')}</Badge>
                <Badge tone="lime">{tenure} tenure</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
              <div className="bg-[var(--card,#14171c)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-mist">Salary</p><p className="mt-0.5 font-extrabold text-lime">{ghs(selected.salary)}</p></div>
              <div className="bg-[var(--card,#14171c)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-mist">Leave balance</p><p className="mt-0.5 font-extrabold">{selected.leaveBalance} days</p></div>
              <div className="bg-[var(--card,#14171c)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-mist">Attendance (mo)</p><p className="mt-0.5 font-extrabold">{data.rate}%</p></div>
              <div className="bg-[var(--card,#14171c)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-mist">Last rating</p><p className="mt-0.5 flex items-center justify-center gap-1 font-extrabold">{latestReview ? <><Star className="size-3.5 fill-lime text-lime" /> {latestReview.rating}/5</> : '—'}</p></div>
            </div>
          </div>

          {/* Sections */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Employment */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><GraduationCap className="size-4 text-lime" /> Employment</p>
              <div className="space-y-1.5 text-sm">
                <p className="flex justify-between"><span className="text-mist">Hired</span><span className="font-bold">{formatDate(selected.hireDate)} ({tenure})</span></p>
                <p className="flex justify-between"><span className="text-mist">Department</span><span className="font-bold">{selected.department}</span></p>
                <p className="flex justify-between"><span className="text-mist">Job title</span><span className="font-bold">{selected.title}</span></p>
                <p className="flex justify-between"><span className="text-mist">Branch</span><span className="font-bold">{branch?.name || '—'}</span></p>
                <p className="flex justify-between"><span className="text-mist">Account status</span><Badge tone={u?.status === 'active' ? 'lime' : 'zinc'}>{u?.status}</Badge></p>
                {Object.entries(selected.customFields || {}).map(([k, v]) => (
                  <p key={k} className="flex justify-between"><span className="text-mist">{k}</span><span className="font-bold">{String(v)}</span></p>
                ))}
              </div>
            </div>

            {/* Attendance */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Clock className="size-4 text-lime" /> Attendance — this month</p>
              <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                {(['present', 'late', 'absent', 'leave'] as const).map((st) => (
                  <div key={st} className="rounded-xl border border-line p-2">
                    <p className="text-lg font-extrabold" style={{ color: ATT_STATUS[st].color }}>{data.counts[st]}</p>
                    <p className="text-[10px] font-bold uppercase text-mist">{ATT_STATUS[st].label}</p>
                  </div>
                ))}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${data.rate}%`, background: '#84cc16' }} />
              </div>
              <p className="mt-1 text-[11px] text-mist">{data.rate}% attendance rate · {data.marked} marked day(s)</p>
              <div className="mt-2 space-y-1">
                {data.attAll.slice(0, 4).map((a) => (
                  <p key={a.id} className="flex items-center justify-between text-xs">
                    <span className="text-mist">{formatDate(a.date)}{a.checkIn ? ` · ${a.checkIn}${a.checkOut ? `–${a.checkOut}` : ''}` : ''}</span>
                    <StatusChip status={a.status} />
                  </p>
                ))}
                {!data.attAll.length && <p className="text-xs italic text-mist">No attendance records.</p>}
              </div>
            </div>

            {/* Leave */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CalendarDays className="size-4 text-lime" /> Leave history</p>
              <div className="space-y-1.5">
                {data.leave.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-line p-2 text-xs">
                    <span className="font-bold">{l.type}</span>
                    <span className="text-mist">{formatDate(l.from)} → {formatDate(l.to)}</span>
                    <Badge tone={l.status === 'approved' ? 'lime' : l.status === 'pending' ? 'amber' : 'rose'}>{l.status}</Badge>
                  </div>
                ))}
                {!data.leave.length && <p className="text-xs italic text-mist">No leave requests.</p>}
              </div>
            </div>

            {/* Payroll */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Wallet className="size-4 text-lime" /> Payroll history</p>
              <div className="space-y-1.5">
                {data.slips.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-line p-2 text-xs">
                    <span className="font-bold">{p.period}</span>
                    <span className="text-mist">net {ghs(p.net)}</span>
                    <Badge tone={p.status === 'paid' ? 'lime' : 'amber'}>{p.status}</Badge>
                  </div>
                ))}
                {!data.slips.length && <p className="text-xs italic text-mist">No payslips yet.</p>}
              </div>
            </div>

            {/* Performance */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Star className="size-4 text-lime" /> Performance</p>
              <div className="space-y-1.5">
                {data.revs.slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-xl border border-line p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3 ${i < r.rating ? 'fill-lime text-lime' : 'text-line'}`} />
                        ))}
                      </span>
                      <span className="text-mist">{r.period}</span>
                    </div>
                    {r.strengths && <p className="mt-1 truncate text-mist"><span className="font-bold text-lime">+</span> {r.strengths}</p>}
                  </div>
                ))}
                {!data.revs.length && <p className="text-xs italic text-mist">No reviews yet.</p>}
              </div>
            </div>

            {/* Shifts */}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Clock className="size-4 text-lime" /> Assigned shifts</p>
              <div className="space-y-1.5">
                {data.myShifts.map((sh) => (
                  <div key={sh.id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-xs">
                    <span className="size-2.5 rounded-full" style={{ background: sh.color }} />
                    <span className="font-bold">{sh.name}</span>
                    <span className="text-mist">{sh.startTime}–{sh.endTime}</span>
                    <span className="ml-auto text-[10px] font-bold text-mist">{sh.days.join(' ')}</span>
                  </div>
                ))}
                {!data.myShifts.length && <p className="text-xs italic text-mist">Not assigned to any shift.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
