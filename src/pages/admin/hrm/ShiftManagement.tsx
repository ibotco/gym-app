import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Clock, Users, CalendarDays, Printer, ChevronLeft, ChevronRight, Star, PlusCircle, Sparkles, AlertTriangle } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, SearchField, Select } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { WEEKDAYS } from '../../../lib/workShifts'
import { generateShifts, loadShiftPolicies } from '../../../lib/shiftPolicies'
import { holidayNameOn, loadActiveHolidays } from '../../../lib/hrmHolidays'
import type { WorkShift } from '../../../types'

const fmt12 = (t: string) => {
  const [h, m] = (t || '0:0').split(':').map(Number)
  if (Number.isNaN(h)) return t
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${ap}`
}
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

interface Form { name: string; startTime: string; endTime: string; days: string[]; color: string; staffUserIds: string[]; notes: string }
const blank: Form = { name: '', startTime: '08:00', endTime: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], color: '#0ea5e9', staffUserIds: [], notes: '' }

export function ShiftManagement() {
  const { shifts, upsertWorkShift, deleteWorkShift, staff, users, activeCompanyId } = useApp()
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [deleting, setDeleting] = useState<WorkShift | null>(null)
  const [err, setErr] = useState('')
  const [weekStart, setWeekStart] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d })
  const [dayOffs, setDayOffs] = useState<Record<string, 'off'>>(() => { try { return JSON.parse(localStorage.getItem('fitpro_roster_dayoffs_v1') || '{}') as Record<string, 'off'> } catch { return {} } })
  const [bulk, setBulk] = useState<{ shiftId: string; days: string[]; staffIds: string[] } | null>(null)
  const [cellPick, setCellPick] = useState<{ userId: string; day: string; date: string } | null>(null)
  const [genResult, setGenResult] = useState<{ applied: string[]; warnings: string[] } | null>(null)
  useEffect(() => { try { localStorage.setItem('fitpro_roster_dayoffs_v1', JSON.stringify(dayOffs)) } catch { /* ignore */ } }, [dayOffs])

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id

  const shiftOf = (userId: string, day: string) =>
    shifts.find((sh) => sh.days.includes(day) && sh.staffUserIds.includes(userId))

  const openCreate = () => { setEditing({ id: null, form: { ...blank } }); setErr('') }
  const openEdit = (sh: WorkShift) => {
    setEditing({ id: sh.id, form: { name: sh.name, startTime: sh.startTime, endTime: sh.endTime, days: [...sh.days], color: sh.color, staffUserIds: [...sh.staffUserIds], notes: sh.notes || '' } })
    setErr('')
  }
  const save = () => {
    if (!editing) return
    const name = editing.form.name.trim()
    if (!name) { setErr('Shift name is required.'); return }
    if (!editing.form.days.length) { setErr('Pick at least one working day.'); return }
    upsertWorkShift({
      id: editing.id || uid('ws'),
      name,
      startTime: editing.form.startTime,
      endTime: editing.form.endTime,
      days: WEEKDAYS.filter((d) => editing.form.days.includes(d)),
      color: editing.form.color || '#0ea5e9',
      staffUserIds: editing.form.staffUserIds,
      notes: editing.form.notes.trim() || undefined,
    })
    toast.success(editing.id ? 'Shift updated' : 'Shift created', name)
    setEditing(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    deleteWorkShift(deleting.id)
    toast.success('Shift deleted', deleting.name)
    setDeleting(null)
  }
  const toggleAssign = (userId: string) => {
    setEditing((ed) => ed ? {
      ...ed,
      form: {
        ...ed.form,
        staffUserIds: ed.form.staffUserIds.includes(userId) ? ed.form.staffUserIds.filter((x) => x !== userId) : [...ed.form.staffUserIds, userId],
      },
    } : ed)
  }

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }), [weekStart])
  const weekLabel = `${weekDays[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${weekDays[6].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
  const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const holidays = useMemo(() => loadActiveHolidays(activeCompanyId), [activeCompanyId])
  const holidayOn = (iso: string) => holidayNameOn(holidays, iso)
  const abbr = (name: string) => { const w = name.trim().split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join('') : name.slice(0, 2)).toUpperCase() }
  const setOff = (userId: string, date: string, on: boolean) => setDayOffs((m) => { const k = `${userId}|${date}`; const n = { ...m }; if (on) n[k] = 'off'; else delete n[k]; return n })
  const assignShift = (shiftId: string, userId: string, on: boolean) => {
    const sh = shifts.find((x) => x.id === shiftId); if (!sh) return
    upsertWorkShift({ ...sh, staffUserIds: on ? Array.from(new Set([...sh.staffUserIds, userId])) : sh.staffUserIds.filter((x) => x !== userId) })
    toast.success(on ? 'Assigned' : 'Unassigned', `${staffName(userId)} · ${sh.name}`)
  }
  const runGenerate = () => {
    const policies = loadShiftPolicies()
    const active = policies.filter((p) => p.active)
    if (!active.length) { toast.error('No active policies', 'Create and activate a shift policy first.'); return }
    const { assignments, warnings } = generateShifts({ policies, shifts, staff, nameOf: staffName, weekDates: weekDays.map(isoOf), holidayName: holidayOn })
    const applied: string[] = []
    const byShift = new Map<string, string[]>()
    for (const a of assignments) byShift.set(a.shiftId, [...(byShift.get(a.shiftId) || []), a.userId])
    for (const [shiftId, userIds] of byShift) {
      const sh = shifts.find((x) => x.id === shiftId); if (!sh) continue
      const add = userIds.filter((u) => !sh.staffUserIds.includes(u))
      if (!add.length) continue
      upsertWorkShift({ ...sh, staffUserIds: [...sh.staffUserIds, ...add] })
      add.forEach((u) => applied.push(`${staffName(u)} → ${sh.name}`))
    }
    if (!applied.length && !warnings.length) toast.success('Schedule already complete', 'Every active policy is fully staffed.')
    else if (applied.length) toast.success('Shifts generated', `${applied.length} assignment${applied.length === 1 ? '' : 's'} applied.`)
    setGenResult({ applied, warnings })
  }

  const saveBulk = () => {
    if (!bulk) return
    const sh = shifts.find((x) => x.id === bulk.shiftId)
    if (!sh || !bulk.staffIds.length || !bulk.days.length) { toast.error('Pick a shift, at least one day and staff.'); return }
    upsertWorkShift({ ...sh, days: WEEKDAYS.filter((d) => bulk.days.includes(d)), staffUserIds: Array.from(new Set([...sh.staffUserIds, ...bulk.staffIds])) })
    toast.success('Bulk shifts assigned', `${sh.name} · ${bulk.staffIds.length} staff`)
    setBulk(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Employee Attendance</span><span>/</span>
        <span>Shift Management</span><span>/</span>
        <span className="font-semibold text-inherit">Assign Shift</span>
      </div>
      <PageHeader
        title="Assign Shift"
        desc="Define work shifts, assign staff manually or let active shift policies generate the schedule automatically."
        actions={canManage ? (
          <span className="flex items-center gap-2">
            <Button variant="outline" onClick={runGenerate}><Sparkles className="size-4" /> Generate Shifts</Button>
            <Button onClick={openCreate}><Plus className="size-4" /> New shift</Button>
          </span>
        ) : undefined}
      />

      {/* Shift cards — two equal columns from md */}
      <div className="grid gap-4 md:grid-cols-2">
        {shifts.map((sh) => (
          <div key={sh.id} className="card overflow-hidden transition hover:border-lime/40">
            <div className="h-1" style={{ background: sh.color }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-bold"><span className="size-2.5 rounded-full" style={{ background: sh.color }} /> {sh.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-mist"><Clock className="size-3.5" /> {fmt12(sh.startTime)} – {fmt12(sh.endTime)}</p>
                </div>
                <span className="rounded px-2 py-0.5 font-mono text-[11px] font-bold" style={{ background: `${sh.color}22`, color: sh.color }}>{sh.color}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="rounded-md px-2 py-0.5 text-[10px] font-extrabold" style={sh.days.includes(d) ? { background: sh.color, color: '#fff' } : { background: 'rgba(127,127,127,0.12)', color: '#94a3b8' }}>
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-mist"><Users className="size-3.5" /> Assigned staff ({sh.staffUserIds.length})</p>
                <div className="flex flex-wrap gap-1">
                  {sh.staffUserIds.slice(0, 6).map((id) => (
                    <span key={id} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold">
                      <span className="size-1.5 rounded-full" style={{ background: sh.color }} /> {staffName(id)}
                    </span>
                  ))}
                  {sh.staffUserIds.length > 6 && <span className="text-[10px] font-bold text-mist">+{sh.staffUserIds.length - 6} more</span>}
                  {!sh.staffUserIds.length && <span className="text-[11px] italic text-mist">No staff assigned yet.</span>}
                </div>
              </div>
              {canManage && (
                <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(sh)}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(sh)}><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!shifts.length && <div className="card col-span-full p-10 text-center text-mist"><CalendarDays className="mx-auto mb-2 size-8" /> No shifts defined yet.</div>}
      </div>

      {/* Weekly roster */}
      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            {canManage && <Button variant="danger" onClick={() => setBulk({ shiftId: shifts[0]?.id || '', days: [...(shifts[0]?.days || [])], staffIds: [] })}><Plus className="size-4" /> Assign Bulk Shifts</Button>}
            <ExportButtons filename="weekly-roster" rows={staff.flatMap((st) => weekDays.map((d, di) => { const sh = shiftOf(st.userId, WEEKDAYS[di]); return { Employee: staffName(st.userId), Date: isoOf(d), Assignment: dayOffs[`${st.userId}|${isoOf(d)}`] ? 'Day Off' : sh ? `${sh.name} ${sh.startTime}-${sh.endTime}` : '' } }))} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {shifts.map((sh) => (
              <span key={sh.id} className="rounded px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: sh.color }} title={sh.name}>{abbr(sh.name)} : {sh.name}</span>
            ))}
            <span className="ml-1 flex items-center gap-1 text-[10px] font-extrabold text-zinc-700 dark:text-zinc-200"><Star className="size-3 fill-red-600 text-red-600" /> : Holiday</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })} className="grid size-8 place-items-center rounded-md border border-line hover:bg-black/5 dark:hover:bg-white/5" aria-label="Previous week"><ChevronLeft className="size-4" /></button>
          <div className="rounded-md border border-line px-4 py-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{weekLabel}</div>
          <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })} className="grid size-8 place-items-center rounded-md border border-line hover:bg-black/5 dark:hover:bg-white/5" aria-label="Next week"><ChevronRight className="size-4" /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.03] dark:bg-white/[0.04]">
                <th className="w-60 px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-mist">Employee</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="px-2 py-2 text-left align-top">
                    <span className="flex items-start gap-2">
                      <span className="text-lg font-extrabold leading-6 text-zinc-800 dark:text-zinc-100">{d.getDate()}</span>
                      <span className="text-[9px] font-extrabold uppercase leading-tight tracking-wide text-mist">
                        {d.toLocaleDateString('en-GB', { weekday: 'long' })}<br />{d.toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      {holidayOn(isoOf(d)) && (
                        <span title={`Holiday: ${holidayOn(isoOf(d))}`} className="mt-0.5"><Star className="size-3.5 fill-red-600 text-red-600" /></span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((st) => (
                <tr key={st.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-500/15 text-[10px] font-extrabold text-mist" data-tip={staffName(st.userId)}>{initials(staffName(st.userId))}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span className="max-w-[150px] truncate">{staffName(st.userId)}</span>
                          {user?.id === st.userId && <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] font-extrabold text-white">It's you</span>}
                        </span>
                        <span className="block truncate text-[10px] text-mist">{st.title || st.department}</span>
                      </span>
                    </span>
                  </td>
                  {weekDays.map((d, i) => {
                    const day = WEEKDAYS[i]
                    const iso = isoOf(d)
                    const sh = shiftOf(st.userId, day)
                    const off = dayOffs[`${st.userId}|${iso}`]
                    return (
                      <td key={i} className="px-1.5 py-2 align-middle">
                        {off ? (
                          <button type="button" onClick={() => canManage && setCellPick({ userId: st.userId, day, date: iso })} className="w-full rounded-md bg-zinc-200 px-2 py-3.5 text-[10px] font-extrabold text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600" title="Day Off — click to change">Day Off</button>
                        ) : sh ? (
                          <button type="button" onClick={() => canManage && setCellPick({ userId: st.userId, day, date: iso })} className="block w-full rounded-md px-2 py-1.5 text-left text-white hover:opacity-90" style={{ background: sh.color }} title={`${sh.name} · ${sh.startTime} – ${sh.endTime} — click to change`}>
                            <span className="block truncate text-[10px] font-extrabold">{sh.name}</span>
                            <span className="block text-[9px] font-semibold opacity-90">{sh.startTime} – {sh.endTime}</span>
                          </button>
                        ) : (
                          <button type="button" onClick={() => canManage && setCellPick({ userId: st.userId, day, date: iso })} className="grid h-11 w-full place-items-center rounded-md border border-line bg-zinc-50 text-red-600 hover:bg-red-50 dark:bg-zinc-800/60 dark:hover:bg-zinc-700" aria-label={`Assign ${staffName(st.userId)} on ${day}`} title="Assign shift">
                            <PlusCircle className="size-4" />
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {!staff.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-mist">No staff records.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-mist">
          <span>Click a + cell (or an assigned block) to assign, unassign or mark a day off. Bulk-assign from the red button above.</span>
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
        </div>
      </div>

      {/* Cell assign picker */}
      <Modal open={!!cellPick} onClose={() => setCellPick(null)} title={cellPick ? `${staffName(cellPick.userId)} — ${cellPick.day} ${cellPick.date.slice(8)}` : ''}>
        {cellPick && (
          <div className="space-y-2">
            {holidayOn(cellPick.date) && (
              <p className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-1.5 text-[12px] font-semibold"><Star className="size-3.5 fill-red-600 text-red-600" /> {holidayOn(cellPick.date)} — public holiday (HR Admin).</p>
            )}
            {shifts.filter((sh) => sh.days.includes(cellPick.day)).map((sh) => {
              const on = sh.staffUserIds.includes(cellPick.userId)
              return (
                <button key={sh.id} onClick={() => { assignShift(sh.id, cellPick.userId, !on); setCellPick(null) }} className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: sh.color }} /> {sh.name} <span className="text-[11px] font-normal text-mist">{sh.startTime} – {sh.endTime}</span></span>
                  <span className="text-[11px] font-extrabold" style={{ color: on ? '#dc2626' : '#16a34a' }}>{on ? 'Unassign' : 'Assign'}</span>
                </button>
              )
            })}
            {!shifts.some((sh) => sh.days.includes(cellPick.day)) && <p className="text-sm text-mist">No shifts run on {cellPick.day}.</p>}
            <button onClick={() => { setOff(cellPick.userId, cellPick.date, !dayOffs[`${cellPick.userId}|${cellPick.date}`]); setCellPick(null) }} className="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">
              {dayOffs[`${cellPick.userId}|${cellPick.date}`] ? 'Remove day off' : 'Mark as Day Off'}
            </button>
          </div>
        )}
      </Modal>

      {/* Bulk assign */}
      <Modal open={!!bulk} onClose={() => setBulk(null)} title="Assign Bulk Shifts" wide>
        {bulk && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shift" required>
                <Select value={bulk.shiftId} onChange={(e) => { const sh = shifts.find((x) => x.id === e.target.value); setBulk({ ...bulk, shiftId: e.target.value, days: sh ? [...sh.days] : [] }) }}>
                  {shifts.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                </Select>
              </Field>
              <Field label="Days">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = bulk.days.includes(d)
                    return (
                      <button key={d} onClick={() => setBulk({ ...bulk, days: on ? bulk.days.filter((x) => x !== d) : [...bulk.days, d] })} className="rounded-lg border-2 border-zinc-400 px-2.5 py-1 text-xs font-extrabold transition" style={on ? { background: '#16a34a', borderColor: '#16a34a', color: '#fff' } : undefined}>{d}</button>
                    )
                  })}
                </div>
              </Field>
            </div>
            <Field label={`Staff (${bulk.staffIds.length})`}>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {staff.map((st) => (
                  <label key={st.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                    <input type="checkbox" checked={bulk.staffIds.includes(st.userId)} onChange={() => setBulk({ ...bulk, staffIds: bulk.staffIds.includes(st.userId) ? bulk.staffIds.filter((x) => x !== st.userId) : [...bulk.staffIds, st.userId] })} className="accent-[#c8f542]" />
                    <span className="font-semibold">{staffName(st.userId)}</span>
                    <span className="text-[11px] text-mist">{st.title || st.department}</span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={saveBulk}>Assign shifts</Button>
              <Button variant="ghost" onClick={() => setBulk(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Shift form modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit shift' : 'New shift'} wide>
        {editing && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shift name" required><Input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} placeholder="e.g. Morning" /></Field>
              <Field label="Colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.form.color} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, color: e.target.value } })} className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1" aria-label="Shift colour" />
                  <Input value={editing.form.color} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, color: e.target.value } })} className="font-mono" />
                </div>
              </Field>
              <Field label="Start time"><Input type="time" value={editing.form.startTime} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, startTime: e.target.value } })} /></Field>
              <Field label="End time"><Input type="time" value={editing.form.endTime} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, endTime: e.target.value } })} /></Field>
            </div>
            <Field label="Working days">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = editing.form.days.includes(d)
                  return (
                    <button key={d} onClick={() => setEditing({ ...editing, form: { ...editing.form, days: on ? editing.form.days.filter((x) => x !== d) : [...editing.form.days, d] } })}
                      className="rounded-lg border-2 px-3 py-1.5 text-xs font-extrabold transition"
                      style={{ borderColor: editing.form.color, background: on ? editing.form.color : 'transparent', color: on ? '#fff' : undefined }}>
                      {d}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label={`Assigned staff (${editing.form.staffUserIds.length})`}>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {staff.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                    <input type="checkbox" checked={editing.form.staffUserIds.includes(s.userId)} onChange={() => toggleAssign(s.userId)} className="accent-[#c8f542]" />
                    <span className="font-semibold">{staffName(s.userId)}</span>
                    <span className="text-[11px] text-mist">{s.department}</span>
                  </label>
                ))}
                {!staff.length && <p className="p-2 text-sm text-mist">No staff records.</p>}
              </div>
            </Field>
            <Field label="Notes"><Input value={editing.form.notes} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, notes: e.target.value } })} placeholder="Optional" /></Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>{editing.id ? 'Save changes' : 'Create shift'}</Button>
              {editing && <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete shift?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.name}</span> ({deleting.staffUserIds.length} assigned)? This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Generation report */}
      <Modal open={!!genResult} onClose={() => setGenResult(null)} title="Shift generation report" wide>
        {genResult && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-2 font-extrabold">Applied assignments ({genResult.applied.length})</p>
              {genResult.applied.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {genResult.applied.map((a) => <span key={a} className="rounded-full bg-green-600/15 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:text-green-400">{a}</span>)}
                </div>
              ) : <p className="text-mist">Nothing new to apply — existing assignments already satisfy the active policies.</p>}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-extrabold"><AlertTriangle className="size-4 text-amber-500" /> Warnings ({genResult.warnings.length})</p>
              {genResult.warnings.length ? (
                <ul className="space-y-1.5">
                  {genResult.warnings.map((w, i) => <li key={i} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[12px]">{w}</li>)}
                </ul>
              ) : <p className="text-mist">No violations — all policies satisfied.</p>}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setGenResult(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
