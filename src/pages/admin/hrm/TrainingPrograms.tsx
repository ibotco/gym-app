import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Printer, Eye, CalendarCheck, CheckCircle2, XCircle,
  GraduationCap, Users, Wallet, Star, ClipboardList, UserPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import {
  loadTrainingPrograms, saveTrainingPrograms, programStats, STATUS_META, TYPE_LABEL,
  nextSession, weeklySessions, addDays, todayIso, ghs,
} from '../../../lib/trainingPrograms'
import type { TrainingProgram } from '../../../types'

interface Form {
  title: string
  type: TrainingProgram['type']
  trainerStaffUserId: string
  externalTrainer: string
  department: string
  location: string
  startDate: string
  endDate: string
  capacity: string
  budget: string
  objectives: string
}

const TYPE_TONE: Record<TrainingProgram['type'], 'sky' | 'violet' | 'amber'> = {
  internal: 'sky', external: 'violet', online: 'amber',
}

export function TrainingPrograms() {
  const { staff, users, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [programs, setPrograms] = useState<TrainingProgram[]>(() => loadTrainingPrograms())
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fType, setFType] = useState('all')
  const [fDept, setFDept] = useState('all')
  const [fTrainer, setFTrainer] = useState('all')
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [err, setErr] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [enrollId, setEnrollId] = useState<string | null>(null)
  const [enrollSel, setEnrollSel] = useState<string[]>([])
  const [enrollQ, setEnrollQ] = useState('')
  const [marking, setMarking] = useState<{ programId: string; sessionId: string; attendees: string } | null>(null)
  const [deleting, setDeleting] = useState<TrainingProgram | null>(null)

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const departments = useMemo(() => Array.from(new Set(staff.map((s) => s.department))).sort(), [staff])
  const persist = (next: TrainingProgram[]) => { setPrograms(next); saveTrainingPrograms(next) }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return programs.filter((p) => {
      if (ql && !`${p.code} ${p.title} ${p.externalTrainer || ''} ${staffName(p.trainerStaffUserId || '')}`.toLowerCase().includes(ql)) return false
      if (fStatus !== 'all' && p.status !== fStatus) return false
      if (fType !== 'all' && p.type !== fType) return false
      if (fDept !== 'all' && p.department !== fDept) return false
      if (fTrainer !== 'all' && p.trainerStaffUserId !== fTrainer) return false
      return true
    })
  }, [programs, q, fStatus, fType, fDept, fTrainer, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const live = programs.filter((p) => p.status !== 'cancelled')
    const stats = programs.map((p) => programStats(p))
    const rated = stats.filter((s) => s.ratingsCount > 0)
    const att = stats.filter((s) => s.heldSessions > 0 && s.enrolled > 0)
    return {
      total: programs.length,
      active: programs.filter((p) => p.status === 'in_progress').length,
      upcoming: programs.filter((p) => p.status === 'scheduled').length,
      completed: programs.filter((p) => p.status === 'completed').length,
      enrolled: live.reduce((s, p) => s + p.enrollments.length, 0),
      held: stats.reduce((s, x) => s + x.heldSessions, 0),
      planned: stats.reduce((s, x) => s + x.totalSessions, 0),
      budget: programs.reduce((s, p) => s + p.budget, 0),
      spent: programs.reduce((s, p) => s + p.spent, 0),
      avgRating: rated.length ? Math.round((rated.reduce((s, x) => s + x.avgRating, 0) / rated.length) * 10) / 10 : 0,
      avgAttendance: att.length ? Math.round(att.reduce((s, x) => s + x.attendancePct, 0) / att.length) : 0,
    }
  }, [programs])

  // ---- create / edit -------------------------------------------------------
  const blank = (): Form => ({
    title: '', type: 'internal', trainerStaffUserId: staff[0]?.userId || '', externalTrainer: '',
    department: 'All departments', location: '', startDate: todayIso(), endDate: addDays(todayIso(), 28),
    capacity: '8', budget: '0', objectives: '',
  })
  const openCreate = () => { setEditing({ id: null, form: blank() }); setErr('') }
  const openEdit = (p: TrainingProgram) => {
    setEditing({
      id: p.id,
      form: {
        title: p.title, type: p.type, trainerStaffUserId: p.trainerStaffUserId || staff[0]?.userId || '',
        externalTrainer: p.externalTrainer || '', department: p.department, location: p.location,
        startDate: p.startDate, endDate: p.endDate, capacity: String(p.capacity), budget: String(p.budget),
        objectives: p.objectives,
      },
    })
    setErr('')
  }

  const saveProgram = () => {
    if (!editing) return
    const f = editing.form
    if (!f.title.trim()) { setErr('Program title is required.'); return }
    if (f.endDate < f.startDate) { setErr('End date must be on or after the start date.'); return }
    const capacity = Number(f.capacity)
    if (!Number.isFinite(capacity) || capacity < 1) { setErr('Capacity must be at least 1.'); return }
    const budget = Number(f.budget) || 0
    const weeks = Math.max(1, Math.round((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (7 * 86400000)) + 1)

    if (editing.id) {
      persist(programs.map((p) => {
        if (p.id !== editing.id) return p
        const datesChanged = p.startDate !== f.startDate || p.endDate !== f.endDate
        const regenerate = datesChanged && !p.sessions.some((s) => s.held)
        return {
          ...p,
          title: f.title.trim(), type: f.type,
          trainerStaffUserId: f.type === 'external' ? undefined : f.trainerStaffUserId,
          externalTrainer: f.type === 'external' ? f.externalTrainer.trim() : undefined,
          department: f.department, location: f.location, startDate: f.startDate, endDate: f.endDate,
          capacity, budget, objectives: f.objectives,
          sessions: regenerate ? weeklySessions(p.id, f.startDate, weeks, ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5', 'Session 6'], 0, []) : p.sessions,
        }
      }))
      toast.success('Program updated', f.title)
      log(user?.id || 'system', 'UPDATE', 'Training', `Updated program ${f.title}`)
    } else {
      const id = `tp_${uid()}`
      const nextNum = programs.length + 1
      const status: TrainingProgram['status'] = f.startDate > todayIso() ? 'scheduled' : 'in_progress'
      persist([
        ...programs,
        {
          id, code: `TRN-${String(nextNum).padStart(3, '0')}`, title: f.title.trim(), type: f.type,
          trainerStaffUserId: f.type === 'external' ? undefined : f.trainerStaffUserId,
          externalTrainer: f.type === 'external' ? f.externalTrainer.trim() : undefined,
          department: f.department, location: f.location, startDate: f.startDate, endDate: f.endDate,
          capacity, budget, spent: 0, status, objectives: f.objectives,
          sessions: weeklySessions(id, f.startDate, weeks, ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5', 'Session 6'], 0, []),
          enrollments: [], createdAt: todayIso(),
        },
      ])
      toast.success('Program created', f.title)
      log(user?.id || 'system', 'CREATE', 'Training', `Created program ${f.title}`)
    }
    setEditing(null)
  }

  // ---- lifecycle actions ----------------------------------------------------
  const setStatus = (id: string, status: TrainingProgram['status'], msg: string) => {
    persist(programs.map((p) => (p.id === id ? { ...p, status } : p)))
    toast.success(msg, programs.find((p) => p.id === id)?.title)
    log(user?.id || 'system', 'UPDATE', 'Training', `${msg}: ${programs.find((p) => p.id === id)?.title}`)
  }
  const removeProgram = () => {
    if (!deleting) return
    persist(programs.filter((p) => p.id !== deleting.id))
    toast.success('Program deleted', deleting.title)
    log(user?.id || 'system', 'DELETE', 'Training', `Deleted program ${deleting.title}`)
    setDeleting(null)
  }
  const saveMarkHeld = () => {
    if (!marking) return
    const attendees = Math.max(0, Number(marking.attendees) || 0)
    persist(programs.map((p) => {
      if (p.id !== marking.programId) return p
      let left = attendees
      const enrollments = p.enrollments.map((e) => {
        if (left > 0) { left -= 1; return { ...e, attended: e.attended + 1 } }
        return e
      })
      return {
        ...p,
        enrollments,
        sessions: p.sessions.map((s) => (s.id === marking.sessionId ? { ...s, held: true, attendees } : s)),
      }
    }))
    toast.success('Session marked as held', `${attendees} attendee${attendees === 1 ? '' : 's'} recorded`)
    log(user?.id || 'system', 'UPDATE', 'Training', `Marked session held (${attendees} attendees) on ${markTarget?.title}`)
    setMarking(null)
  }
  const saveEnroll = () => {
    if (!enrollId) return
    const p = programs.find((x) => x.id === enrollId)
    persist(programs.map((x) => (x.id === enrollId
      ? { ...x, enrollments: [...x.enrollments, ...enrollSel.map((staffUserId) => ({ staffUserId, attended: 0 }))] }
      : x)))
    toast.success('Employees enrolled', `${enrollSel.length} added to ${p?.title || 'program'}`)
    log(user?.id || 'system', 'UPDATE', 'Training', `Enrolled ${enrollSel.length} employee(s) on ${p?.title}`)
    setEnrollId(null); setEnrollSel([]); setEnrollQ('')
  }

  const view = viewId ? programs.find((p) => p.id === viewId) || null : null
  const enrollTarget = enrollId ? programs.find((p) => p.id === enrollId) || null : null
  const markTarget = marking ? programs.find((p) => p.id === marking.programId) || null : null

  const exportRows = filtered.map((p) => {
    const s = programStats(p)
    return {
      Code: p.code, Program: p.title, Type: TYPE_LABEL[p.type],
      Trainer: p.type === 'external' ? p.externalTrainer || '' : staffName(p.trainerStaffUserId || ''),
      Department: p.department, Start: p.startDate, End: p.endDate,
      Sessions: `${s.heldSessions}/${s.totalSessions}`, Enrolled: `${s.enrolled}/${p.capacity}`,
      'Attendance %': s.attendancePct, Rating: s.avgRating || '', Budget: p.budget, Spent: p.spent,
      Status: STATUS_META[p.status].label,
    }
  })

  const Kpi = ({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) => (
    <div className="card flex items-center gap-3 p-4">
      <Icon className="size-5 text-lime" />
      <div className="min-w-0">
        <p className="truncate text-xs text-mist">{label}</p>
        <p className="stat-num text-2xl">{value}</p>
        {sub && <p className="truncate text-[10px] text-mist">{sub}</p>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/hrm" className="hover:text-lime">Human Resource</Link>
        <span>/</span>
        <span>Training</span>
        <span>/</span>
        <span className="font-semibold text-inherit">Training Programs</span>
      </div>
      <PageHeader
        title="Training Programs"
        desc="Plan, schedule and track internal, external and online training programs for your employees."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename="training-programs" rows={exportRows} />
            {canManage && <Button onClick={openCreate}><Plus className="size-4" /> New Program</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={GraduationCap} label="Total programs" value={String(kpi.total)} sub={`${kpi.active} in progress`} />
        <Kpi icon={CalendarCheck} label="Upcoming" value={String(kpi.upcoming)} sub={`${kpi.completed} completed`} />
        <Kpi icon={Users} label="Enrolled employees" value={String(kpi.enrolled)} sub={`avg attendance ${kpi.avgAttendance}%`} />
        <Kpi icon={ClipboardList} label="Sessions" value={`${kpi.held}/${kpi.planned}`} sub="held / planned" />
        <Kpi icon={Wallet} label="Training budget" value={ghs(kpi.budget)} sub={`${ghs(kpi.spent)} spent`} />
        <Kpi icon={Star} label="Avg feedback" value={kpi.avgRating ? `${kpi.avgRating}/5` : '—'} sub="completed programs" />
      </div>

      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2"><SearchField value={q} onChange={setQ} placeholder="Search code, title, trainer…" /></div>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_META) as TrainingProgram['status'][]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
        <Select value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="all">All types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="online">Online</option>
        </Select>
        <Select value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="All departments">All departments (program)</option>
        </Select>
        <Select value={fTrainer} onChange={(e) => setFTrainer(e.target.value)}>
          <option value="all">All trainers</option>
          {staff.map((s) => <option key={s.userId} value={s.userId}>{staffName(s.userId)}</option>)}
        </Select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1080 }}>
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Program</th>
              <th className="px-3 py-2.5">Trainer</th>
              <th className="px-3 py-2.5">Schedule</th>
              <th className="px-3 py-2.5">Sessions</th>
              <th className="px-3 py-2.5">Enrollment</th>
              <th className="px-3 py-2.5 text-center">Att.</th>
              <th className="px-3 py-2.5 text-center">Rating</th>
              <th className="px-3 py-2.5 text-right">Budget</th>
              <th className="px-3 py-2.5">Status</th>
              {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const s = programStats(p)
              return (
                <tr key={p.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-lime/[0.03]" onClick={() => setViewId(p.id)}>
                  <td className="px-3 py-2.5 font-mono text-xs text-mist">{p.code}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-bold">{p.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-mist">
                      <Badge tone={TYPE_TONE[p.type]}>{TYPE_LABEL[p.type]}</Badge>
                      <span>{p.department}</span>
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{p.type === 'external' ? p.externalTrainer : staffName(p.trainerStaffUserId || '')}</td>
                  <td className="px-3 py-2.5 text-xs text-mist">{p.startDate} → {p.endDate}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-bold">{s.heldSessions}/{s.totalSessions}</p>
                    <div className="mt-1 h-1.5 w-16 rounded bg-black/10 dark:bg-white/10">
                      <div className="h-1.5 rounded bg-lime" style={{ width: `${s.progressPct}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-bold">{s.enrolled}/{p.capacity}</p>
                    <div className="mt-1 h-1.5 w-16 rounded bg-black/10 dark:bg-white/10">
                      <div className="h-1.5 rounded bg-sky-400" style={{ width: `${Math.min(100, Math.round((s.enrolled / Math.max(1, p.capacity)) * 100))}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold">{s.heldSessions ? `${s.attendancePct}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold">{s.avgRating ? <span className="inline-flex items-center gap-1"><Star className="size-3 fill-amber-400 text-amber-400" />{s.avgRating}</span> : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold">{ghs(p.budget)}</td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge></td>
                  {canManage && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white" title="View" onClick={() => setViewId(p.id)}><Eye className="size-4" /></button>
                        <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white" title="Edit" onClick={() => openEdit(p)}><Pencil className="size-4" /></button>
                        {p.status === 'in_progress' && nextSession(p) && (
                          <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-lime dark:hover:bg-white/5" title="Mark next session held" onClick={() => { const ns = nextSession(p); if (ns) setMarking({ programId: p.id, sessionId: ns.id, attendees: String(p.enrollments.length) }) }}><CalendarCheck className="size-4" /></button>
                        )}
                        {p.status === 'in_progress' && (
                          <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-lime dark:hover:bg-white/5" title="Complete program" onClick={() => setStatus(p.id, 'completed', 'Program completed')}><CheckCircle2 className="size-4" /></button>
                        )}
                        {(p.status === 'scheduled' || p.status === 'draft') && (
                          <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-rose-500 dark:hover:bg-white/5" title="Cancel program" onClick={() => setStatus(p.id, 'cancelled', 'Program cancelled')}><XCircle className="size-4" /></button>
                        )}
                        <button className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-rose-500 dark:hover:bg-white/5" title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {!filtered.length && (
              <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-10 text-center text-sm text-mist">No training programs match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------ create / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Training Program' : 'New Training Program'} wide>
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Program title" required className="sm:col-span-2">
              <Input value={editing.form.title} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })} placeholder="e.g. Customer Service Excellence" />
            </Field>
            <Field label="Type">
              <Select value={editing.form.type} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, type: e.target.value as TrainingProgram['type'] } })}>
                <option value="internal">Internal trainer</option>
                <option value="external">External provider</option>
                <option value="online">Online course</option>
              </Select>
            </Field>
            {editing.form.type === 'external' ? (
              <Field label="External provider">
                <Input value={editing.form.externalTrainer} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, externalTrainer: e.target.value } })} placeholder="Provider name" />
              </Field>
            ) : (
              <Field label="Internal trainer">
                <Select value={editing.form.trainerStaffUserId} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, trainerStaffUserId: e.target.value } })}>
                  {staff.map((s) => <option key={s.userId} value={s.userId}>{staffName(s.userId)} — {s.department}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Target department">
              <Select value={editing.form.department} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, department: e.target.value } })}>
                <option value="All departments">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Location">
              <Input value={editing.form.location} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, location: e.target.value } })} placeholder="Room / venue / online link" />
            </Field>
            <Field label="Start date" required>
              <Input type="date" value={editing.form.startDate} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, startDate: e.target.value } })} />
            </Field>
            <Field label="End date" required>
              <Input type="date" value={editing.form.endDate} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, endDate: e.target.value } })} />
            </Field>
            <Field label="Capacity">
              <Input type="number" min={1} value={editing.form.capacity} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, capacity: e.target.value } })} />
            </Field>
            <Field label="Budget (GHS)">
              <Input type="number" min={0} value={editing.form.budget} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, budget: e.target.value } })} />
            </Field>
            <Field label="Objectives" className="sm:col-span-2">
              <Input value={editing.form.objectives} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, objectives: e.target.value } })} placeholder="What should this program achieve?" />
            </Field>
            {err && <p className="text-xs font-bold text-rose-500 sm:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveProgram}>{editing.id ? 'Save changes' : 'Create program'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------- detail modal */}
      <Modal open={!!view} onClose={() => setViewId(null)} title={view ? `${view.code} · ${view.title}` : ''} xl>
        {view && (() => {
          const s = programStats(view)
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_META[view.status].tone}>{STATUS_META[view.status].label}</Badge>
                <Badge tone={TYPE_TONE[view.type]}>{TYPE_LABEL[view.type]}</Badge>
                <span className="text-xs text-mist">{view.department} · {view.location || 'No location set'}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="card p-3"><p className="text-[10px] font-bold uppercase text-mist">Schedule</p><p className="mt-1 text-xs font-bold">{view.startDate} → {view.endDate}</p></div>
                <div className="card p-3"><p className="text-[10px] font-bold uppercase text-mist">Trainer</p><p className="mt-1 text-xs font-bold">{view.type === 'external' ? view.externalTrainer : staffName(view.trainerStaffUserId || '')}</p></div>
                <div className="card p-3"><p className="text-[10px] font-bold uppercase text-mist">Attendance</p><p className="mt-1 text-xs font-bold">{s.heldSessions ? `${s.attendancePct}%` : '—'} <span className="text-mist">({s.heldSessions}/{s.totalSessions} sessions)</span></p></div>
                <div className="card p-3"><p className="text-[10px] font-bold uppercase text-mist">Budget</p><p className="mt-1 text-xs font-bold">{ghs(view.spent)} <span className="text-mist">of {ghs(view.budget)}</span></p></div>
              </div>
              {view.objectives && <p className="text-xs text-mist"><span className="font-bold text-inherit">Objectives: </span>{view.objectives}</p>}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-mist">Sessions</h4>
                  {canManage && view.status === 'in_progress' && nextSession(view) && (
                    <Button size="sm" variant="outline" onClick={() => { const ns = nextSession(view); if (ns) setMarking({ programId: view.id, sessionId: ns.id, attendees: String(view.enrollments.length) }) }}>
                      <CalendarCheck className="size-3.5" /> Mark next session held
                    </Button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase text-mist dark:bg-white/[0.03]">
                      <th className="px-3 py-2">Date</th><th className="px-3 py-2">Topic</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Attendees</th>
                    </tr></thead>
                    <tbody>
                      {view.sessions.map((sess) => (
                        <tr key={sess.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-1.5 font-mono">{sess.date}</td>
                          <td className="px-3 py-1.5">{sess.topic}</td>
                          <td className="px-3 py-1.5">{sess.held ? <Badge tone="lime">Held</Badge> : <Badge tone="zinc">Planned</Badge>}</td>
                          <td className="px-3 py-1.5 text-right font-bold">{sess.held ? sess.attendees : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-mist">Enrolled employees ({view.enrollments.length}/{view.capacity})</h4>
                  {canManage && view.status !== 'cancelled' && view.status !== 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => { setEnrollId(view.id); setEnrollSel([]); setEnrollQ('') }}>
                      <UserPlus className="size-3.5" /> Enroll staff
                    </Button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase text-mist dark:bg-white/[0.03]">
                      <th className="px-3 py-2">Employee</th><th className="px-3 py-2">Department</th><th className="px-3 py-2 text-right">Attended</th><th className="px-3 py-2 text-right">Rating</th>
                    </tr></thead>
                    <tbody>
                      {view.enrollments.map((e) => {
                        const st = staff.find((x) => x.userId === e.staffUserId)
                        return (
                          <tr key={e.staffUserId} className="border-b border-line last:border-0">
                            <td className="px-3 py-1.5 font-bold">{staffName(e.staffUserId)}</td>
                            <td className="px-3 py-1.5 text-mist">{st?.department || '—'}</td>
                            <td className="px-3 py-1.5 text-right font-bold">{e.attended}/{s.heldSessions}</td>
                            <td className="px-3 py-1.5 text-right font-bold">{e.rating ? <span className="inline-flex items-center gap-1"><Star className="size-3 fill-amber-400 text-amber-400" />{e.rating}</span> : '—'}</td>
                          </tr>
                        )
                      })}
                      {!view.enrollments.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-mist">No employees enrolled yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setViewId(null)}>Close</Button>
                  <Button variant="outline" onClick={() => { openEdit(view); setViewId(null) }}><Pencil className="size-4" /> Edit</Button>
                  {view.status === 'in_progress' && <Button onClick={() => { setStatus(view.id, 'completed', 'Program completed'); setViewId(null) }}><CheckCircle2 className="size-4" /> Complete</Button>}
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ------------------------------------------------------- enroll modal */}
      <Modal open={!!enrollTarget} onClose={() => setEnrollId(null)} title={`Enroll staff — ${enrollTarget?.title || ''}`} wide>
        {enrollTarget && (
          <div className="space-y-3">
            <SearchField value={enrollQ} onChange={setEnrollQ} placeholder="Search employees…" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {staff
                .filter((s) => !enrollTarget.enrollments.some((e) => e.staffUserId === s.userId))
                .filter((s) => !enrollQ || staffName(s.userId).toLowerCase().includes(enrollQ.toLowerCase()))
                .map((s) => (
                  <label key={s.userId} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      className="accent-[#c8f542]"
                      checked={enrollSel.includes(s.userId)}
                      onChange={(e) => setEnrollSel(e.target.checked ? [...enrollSel, s.userId] : enrollSel.filter((x) => x !== s.userId))}
                    />
                    <span className="font-bold">{staffName(s.userId)}</span>
                    <span className="text-xs text-mist">{s.department} · {s.title}</span>
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEnrollId(null)}>Cancel</Button>
              <Button disabled={!enrollSel.length} onClick={saveEnroll}>Enroll {enrollSel.length || ''} employee{enrollSel.length === 1 ? '' : 's'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------- mark session modal */}
      <Modal open={!!marking} onClose={() => setMarking(null)} title="Mark session as held" narrow>
        {marking && markTarget && (() => {
          const sess = markTarget.sessions.find((x) => x.id === marking.sessionId)
          return (
            <div className="space-y-3">
              <p className="text-sm text-mist">{markTarget.title} — <span className="font-bold text-inherit">{sess?.date}</span> · {sess?.topic}</p>
              <Field label="Attendees" required>
                <Input type="number" min={0} max={markTarget.enrollments.length} value={marking.attendees} onChange={(e) => setMarking({ ...marking, attendees: e.target.value })} />
              </Field>
              <p className="text-[11px] text-mist">{markTarget.enrollments.length} employee{markTarget.enrollments.length === 1 ? ' is' : 's are'} enrolled; attendance updates the first N enrolled employees.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMarking(null)}>Cancel</Button>
                <Button onClick={saveMarkHeld}>Save session</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ------------------------------------------------------- delete modal */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete training program" narrow>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm">Delete <span className="font-bold">{deleting.code} · {deleting.title}</span>? This removes all sessions and enrollments. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Keep</Button>
              <Button variant="danger" onClick={removeProgram}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
