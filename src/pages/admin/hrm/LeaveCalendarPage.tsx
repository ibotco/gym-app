import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Clock, Check, X, CalendarOff } from 'lucide-react'
import { PageHeader, Button, Modal, Badge, Switch, Select, SearchField, StatCard, Segmented } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../lib/utils'
import type { LeaveRequest } from '../../../types'

/* ---------- date helpers (local, ISO 'YYYY-MM-DD') ---------- */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayISO = () => iso(new Date())
/** Inclusive day count between two ISO dates. */
const spanDays = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1

export function LeaveCalendarPage() {
  const { leaves, leaveTypes, staff, users, upsertLeave, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [view, setView] = useState('calendar')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showPending, setShowPending] = useState(true)
  const [detail, setDetail] = useState<LeaveRequest | null>(null)

  const typeDef = (name: string) =>
    leaveTypes.find((t) => t.name === name || t.id === name) || { id: name, name, color: '#94a3b8', paid: true }
  const staffName = (userId: string) => users.find((u) => u.id === userId)?.name || userId
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  /* ----- visible leaves (approved always; pending optional; rejected hidden) ----- */
  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return leaves.filter((l) => {
      if (l.status === 'rejected') return false
      if (l.status === 'pending' && !showPending) return false
      if (typeFilter && l.type !== typeFilter) return false
      if (ql && !staffName(l.staffUserId).toLowerCase().includes(ql)) return false
      return true
    })
  }, [leaves, q, typeFilter, showPending, users]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- month geometry ----- */
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const monthStart = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-01`
  const monthEnd = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])
  const byDate = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {}
    for (const l of visible) {
      for (let d = l.from; d <= l.to; ) {
        if (d >= monthStart && d <= monthEnd) (map[d] ||= []).push(l)
        const next = new Date(`${d}T00:00:00`); next.setDate(next.getDate() + 1); d = iso(next)
        if (d > l.to) break
      }
    }
    return map
  }, [visible, monthStart, monthEnd])

  /* ----- planner rows: staff + anyone else with leaves ----- */
  const plannerRows = useMemo(() => {
    const ids = new Set(staff.map((s) => s.userId))
    for (const l of visible) ids.add(l.staffUserId)
    return [...ids].map((userId) => ({
      userId,
      name: staffName(userId),
      spans: visible
        .filter((l) => l.staffUserId === userId && l.from <= monthEnd && l.to >= monthStart)
        .map((l) => ({
          leave: l,
          startDay: Number((l.from < monthStart ? monthStart : l.from).slice(8, 10)),
          endDay: Number((l.to > monthEnd ? monthEnd : l.to).slice(8, 10)),
        })),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [visible, staff, users, monthStart, monthEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- sidebar + stats ----- */
  const today = todayISO()
  const onLeaveToday = useMemo(
    () => leaves.filter((l) => l.status === 'approved' && l.from <= today && l.to >= today),
    [leaves, today],
  )
  const pending = useMemo(() => leaves.filter((l) => l.status === 'pending'), [leaves])
  const monthStats = useMemo(() => {
    let days = 0
    const who = new Set<string>()
    for (const l of leaves) {
      if (l.status !== 'approved' || l.from > monthEnd || l.to < monthStart) continue
      const s = l.from < monthStart ? monthStart : l.from
      const e = l.to > monthEnd ? monthEnd : l.to
      days += spanDays(s, e)
      who.add(l.staffUserId)
    }
    return { days, staffCount: who.size }
  }, [leaves, monthStart, monthEnd])

  const shiftMonth = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const decide = (l: LeaveRequest, status: 'approved' | 'rejected') => {
    upsertLeave({ ...l, status })
    log(user?.id || 'system', 'UPDATE', 'Leave', `${status === 'approved' ? 'Approved' : 'Rejected'} leave for ${staffName(l.staffUserId)}`)
    toast.success(status === 'approved' ? 'Leave approved' : 'Leave rejected', staffName(l.staffUserId))
    setDetail(null)
  }

  const weekdayOf = (dayNum: number) => new Date(cursor.y, cursor.m, dayNum).getDay()

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Leave Management</span><span>/</span>
        <span className="font-semibold text-inherit">Leave Calendar</span>
      </div>
      <PageHeader
        title="Leave Calendar"
        desc="Organisation-wide view of staff leave — month calendar and staff planner, colour-coded by leave type."
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On leave today" value={String(onLeaveToday.length)} icon={<CalendarOff className="size-4" />} />
        <StatCard label="Pending requests" value={String(pending.length)} icon={<Clock className="size-4" />} hint="awaiting decision" />
        <StatCard label={`Leave days · ${monthLabel.split(' ')[0]}`} value={String(monthStats.days)} icon={<CalendarDays className="size-4" />} hint="approved" />
        <StatCard label="Staff on leave this month" value={String(monthStats.staffCount)} icon={<Users className="size-4" />} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search staff…" className="max-w-xs" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[190px]" aria-label="Filter by leave type">
          <option value="">All leave types</option>
          {leaveTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-xs font-semibold text-mist">
          <Switch checked={showPending} onChange={setShowPending} aria-label="Show pending requests" /> Show pending
        </label>
        <div className="mx-auto"><Segmented value={view} onChange={setView} options={[{ id: 'calendar', label: 'Calendar' }, { id: 'planner', label: 'Staff planner' }]} /></div>
        <Button variant="ghost" onClick={() => window.print()}>Print</Button>
        <ExportButtons filename="leave-calendar" rows={visible.map((l) => ({
          Staff: staffName(l.staffUserId), Type: typeDef(l.type).name, From: l.from, To: l.to,
          Days: spanDays(l.from, l.to), Status: l.status, Reason: l.reason || '',
        }))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* ============ MONTH CALENDAR ============ */}
          {view === 'calendar' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex items-center gap-1">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(-1)} title="Previous month"><ChevronLeft className="size-4" /></button>
                  <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }) }}>Today</button>
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(1)} title="Next month"><ChevronRight className="size-4" /></button>
                </div>
                <p className="text-base font-extrabold">{monthLabel}</p>
                <div className="hidden flex-wrap items-center gap-2 sm:flex">
                  {leaveTypes.slice(0, 4).map((t) => (
                    <span key={t.id} className="flex items-center gap-1 text-[10px] font-semibold text-mist">
                      <span className="size-2 rounded-full" style={{ background: t.color }} /> {t.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-line bg-black/[0.02] dark:bg-white/[0.02]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  const key = iso(d)
                  const inMonth = d.getMonth() === cursor.m
                  const isToday = key === today
                  const dayList = byDate[key] || []
                  return (
                    <div key={key} className={`min-h-[88px] border-b border-r border-line p-1.5 ${inMonth ? '' : 'bg-black/[0.02] opacity-45 dark:bg-white/[0.015]'} ${i % 7 === 6 ? 'border-r-0' : ''} ${i >= 35 ? 'border-b-0' : ''}`}>
                      <span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${isToday ? 'bg-lime text-black' : inMonth ? '' : 'text-mist'}`}>{d.getDate()}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayList.slice(0, 3).map((l) => {
                          const td = typeDef(l.type)
                          return (
                            <button
                              key={l.id}
                              onClick={() => setDetail(l)}
                              className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold text-white transition hover:brightness-110 ${l.status === 'pending' ? 'border border-dashed border-white/70' : ''}`}
                              style={{ background: td.color }}
                              title={`${staffName(l.staffUserId)} · ${td.name}${l.status === 'pending' ? ' (pending)' : ''}`}
                            >
                              <span className="shrink-0 rounded bg-black/25 px-1 text-[9px] font-extrabold">{initials(staffName(l.staffUserId))}</span>
                              <span className="truncate">{staffName(l.staffUserId)}</span>
                            </button>
                          )
                        })}
                        {dayList.length > 3 && <p className="px-1 text-[10px] font-bold text-mist">+{dayList.length - 3} more</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ============ STAFF PLANNER ============ */}
          {view === 'planner' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex items-center gap-1">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-4" /></button>
                  <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }) }}>Today</button>
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => shiftMonth(1)}><ChevronRight className="size-4" /></button>
                </div>
                <p className="text-base font-extrabold">{monthLabel}</p>
                <p className="hidden text-[11px] text-mist sm:block">Weekends shaded · today highlighted</p>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  {/* Day-number header */}
                  <div className="flex border-b border-line">
                    <div className="w-40 shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-mist">Staff</div>
                    <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const wd = weekdayOf(i + 1)
                        const isTodayCol = monthStart.slice(0, 7) === today.slice(0, 7) && i + 1 === Number(today.slice(8, 10))
                        return (
                          <div key={i} className={`px-0.5 py-1.5 text-center text-[10px] font-bold ${isTodayCol ? 'bg-lime text-black' : (wd === 0 || wd === 6) ? 'bg-black/[0.04] text-mist dark:bg-white/[0.04]' : 'text-mist'}`}>
                            {i + 1}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Staff rows */}
                  {plannerRows.map((row) => (
                    <div key={row.userId} className="flex border-b border-line last:border-0 hover:bg-lime/[0.02]">
                      <div className="flex w-40 shrink-0 items-center gap-2 px-3 py-1.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-500/15 text-[10px] font-extrabold text-mist">{initials(row.name)}</span>
                        <span className="truncate text-xs font-bold" title={row.name}>{row.name}</span>
                      </div>
                      <div className="grid flex-1 py-1" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const wd = weekdayOf(i + 1)
                          const isTodayCol = monthStart.slice(0, 7) === today.slice(0, 7) && i + 1 === Number(today.slice(8, 10))
                          return <div key={i} className={isTodayCol ? 'bg-lime/10' : (wd === 0 || wd === 6) ? 'bg-black/[0.04] dark:bg-white/[0.04]' : ''} style={{ gridRow: 1 }} />
                        })}
                        {row.spans.map(({ leave, startDay, endDay }) => {
                          const td = typeDef(leave.type)
                          return (
                            <button
                              key={leave.id}
                              onClick={() => setDetail(leave)}
                              className={`z-10 mx-px flex items-center overflow-hidden rounded-md px-1 text-[10px] font-bold text-white transition hover:brightness-110 ${leave.status === 'pending' ? 'border border-dashed border-white/70' : ''}`}
                              style={{ gridColumn: `${startDay} / ${endDay + 1}`, gridRow: 1, background: td.color, minHeight: 24 }}
                              title={`${row.name} · ${td.name} · ${formatDate(leave.from)} → ${formatDate(leave.to)} (${spanDays(leave.from, leave.to)} days)${leave.status === 'pending' ? ' · pending' : ''}`}
                            >
                              <span className="truncate">{td.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {!plannerRows.length && <p className="p-6 text-center text-sm text-mist">No staff or leave records for this month.</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============ SIDEBAR ============ */}
        <div className="space-y-4">
          {/* On leave today */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CalendarOff className="size-4 text-lime" /> On leave today</p>
            {onLeaveToday.length === 0 && <p className="text-sm text-mist">Everyone is at work today.</p>}
            <div className="space-y-2">
              {onLeaveToday.map((l) => {
                const td = typeDef(l.type)
                return (
                  <button key={l.id} onClick={() => setDetail(l)} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left transition hover:border-lime/50">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: td.color }}>{initials(staffName(l.staffUserId))}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{staffName(l.staffUserId)}</p>
                      <p className="text-[11px] text-mist">{td.name} · back {formatDate(l.to)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pending approvals */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Clock className="size-4 text-amber-400" /> Pending approvals</p>
            {pending.length === 0 && <p className="text-sm text-mist">Nothing waiting for a decision.</p>}
            <div className="space-y-2">
              {pending.slice(0, 6).map((l) => {
                const td = typeDef(l.type)
                return (
                  <div key={l.id} className="rounded-xl border border-line p-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: td.color }} />
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{staffName(l.staffUserId)}</p>
                      <Badge tone="amber">{spanDays(l.from, l.to)}d</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-mist">{td.name} · {formatDate(l.from)} → {formatDate(l.to)}</p>
                    {canManage && (
                      <div className="mt-1.5 flex gap-1.5">
                        <Button size="sm" onClick={() => decide(l, 'approved')}><Check className="size-3.5" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(l, 'rejected')}><X className="size-3.5" /> Reject</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="card p-4">
            <p className="mb-3 text-sm font-extrabold">Leave types</p>
            <div className="space-y-1.5">
              {leaveTypes.map((t) => (
                <button key={t.id} onClick={() => setTypeFilter(typeFilter === t.name ? '' : t.name)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-black/5 dark:hover:bg-white/5 ${typeFilter === t.name ? 'bg-lime/10 font-bold' : ''}`}>
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                  <span className="flex-1 font-semibold">{t.name}</span>
                  <span className="text-[10px] text-mist">{t.daysPerYear ? `${t.daysPerYear}d/yr` : ''}{!t.paid && ' · unpaid'}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-mist">Dashed outline = pending request. Click a type to filter.</p>
          </div>
        </div>
      </div>

      {/* ============ DETAIL MODAL ============ */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Leave request">
        {detail && (() => {
          const td = typeDef(detail.type)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white" style={{ background: td.color }}>{initials(staffName(detail.staffUserId))}</span>
                <div>
                  <p className="text-base font-extrabold">{staffName(detail.staffUserId)}</p>
                  <p className="text-xs text-mist">{formatDate(detail.from)} → {formatDate(detail.to)} · {spanDays(detail.from, detail.to)} day(s)</p>
                </div>
                <span className="ml-auto rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: `${td.color}22`, color: td.color }}>{td.name}</span>
              </div>
              <Badge tone={detail.status === 'approved' ? 'lime' : detail.status === 'pending' ? 'amber' : 'rose'}>{detail.status}</Badge>
              {detail.reason && <p className="rounded-xl border border-line p-3 text-sm text-mist">{detail.reason}</p>}
              {detail.status === 'pending' && canManage && (
                <div className="flex gap-2 border-t border-line pt-3">
                  <Button onClick={() => decide(detail, 'approved')}><Check className="size-4" /> Approve</Button>
                  <Button variant="danger" onClick={() => decide(detail, 'rejected')}><X className="size-4" /> Reject</Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
