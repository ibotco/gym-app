import { useMemo, useState } from 'react'
import { Printer, Star, MessageSquare, Users, Plus, ThumbsUp, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import {
  loadTrainingPrograms, saveTrainingPrograms, feedbackEntries, ratingDistribution,
  averageRating, STATUS_META, todayIso, type FeedbackEntry,
} from '../../../lib/trainingPrograms'
import type { TrainingProgram } from '../../../types'

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-3.5 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-zinc-400/40'}`} />
      ))}
    </span>
  )
}

export function TrainingFeedbackPage() {
  const { staff, users, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [programs, setPrograms] = useState<TrainingProgram[]>(() => loadTrainingPrograms())
  const [q, setQ] = useState('')
  const [fRating, setFRating] = useState('all')
  const [fDept, setFDept] = useState('all')
  const [fProgram, setFProgram] = useState('all')
  const [logging, setLogging] = useState<{ programId: string; staffUserId: string; rating: string; comment: string } | null>(null)
  const [err, setErr] = useState('')

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const deptOf = (id: string) => staff.find((s) => s.userId === id)?.department || '—'
  const persist = (next: TrainingProgram[]) => { setPrograms(next); saveTrainingPrograms(next) }

  const entries = useMemo(() => feedbackEntries(programs), [programs])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (ql && !`${e.programTitle} ${e.programCode} ${staffName(e.staffUserId)} ${e.comment || ''}`.toLowerCase().includes(ql)) return false
      if (fRating !== 'all' && Math.round(e.rating) !== Number(fRating)) return false
      if (fDept !== 'all' && deptOf(e.staffUserId) !== fDept) return false
      if (fProgram !== 'all' && e.programId !== fProgram) return false
      return true
    })
  }, [entries, q, fRating, fDept, fProgram, users, staff]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const dist = ratingDistribution(entries)
    const liveEnrollments = programs.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + p.enrollments.length, 0)
    const perProgram = programs
      .map((p) => ({ p, es: entries.filter((e) => e.programId === p.id) }))
      .filter((x) => x.es.length >= 2)
      .map((x) => ({ title: x.p.title, avg: averageRating(x.es) }))
      .sort((a, b) => b.avg - a.avg)
    return {
      avg: averageRating(entries),
      responses: entries.length,
      eligible: liveEnrollments,
      five: dist[4],
      top: perProgram[0],
      worst: perProgram.length ? perProgram[perProgram.length - 1] : undefined,
      withComment: entries.filter((e) => e.comment).length,
    }
  }, [entries, programs])

  const dist = ratingDistribution(filtered)
  const maxDist = Math.max(1, ...dist)

  const programSummary = useMemo(() => programs
    .map((p) => ({ p, es: entries.filter((e) => e.programId === p.id) }))
    .filter((x) => x.es.length > 0)
    .map((x) => ({ p: x.p, avg: averageRating(x.es), d: ratingDistribution(x.es), n: x.es.length }))
    .sort((a, b) => b.avg - a.avg), [programs, entries])

  const saveFeedback = () => {
    if (!logging) return
    if (!logging.programId || !logging.staffUserId) { setErr('Choose a program and an employee.'); return }
    const rating = Number(logging.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) { setErr('Rating must be between 1 and 5.'); return }
    persist(programs.map((p) => (p.id === logging.programId
      ? {
        ...p,
        enrollments: p.enrollments.map((e) => (e.staffUserId === logging.staffUserId
          ? { ...e, rating, comment: logging.comment.trim() || undefined, feedbackDate: todayIso() }
          : e)),
      }
      : p)))
    log(user?.id || 'system', 'CREATE', 'Training', `Recorded ${rating}-star feedback for ${staffName(logging.staffUserId)} on ${programs.find((p) => p.id === logging.programId)?.title}`)
    toast.success('Feedback recorded', `${staffName(logging.staffUserId)} · ${rating}/5`)
    setLogging(null); setErr('')
  }

  const exportRows = filtered.map((e) => ({
    Date: e.date || '', Employee: staffName(e.staffUserId), Department: deptOf(e.staffUserId),
    Program: `${e.programCode} ${e.programTitle}`, Rating: e.rating, Comment: e.comment || '',
  }))

  const Kpi = ({ icon: Icon, label, value, sub }: { icon: typeof Star; label: string; value: string; sub?: string }) => (
    <div className="card flex items-center gap-3 p-4">
      <Icon className="size-5 text-lime" />
      <div className="min-w-0">
        <p className="truncate text-xs text-mist">{label}</p>
        <p className="stat-num text-2xl">{value}</p>
        {sub && <p className="truncate text-[10px] text-mist">{sub}</p>}
      </div>
    </div>
  )

  const feedbackOptions = programs.filter((p) => p.status !== 'cancelled' && p.status !== 'draft' && p.enrollments.length > 0)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/hrm" className="hover:text-lime">Human Resource</Link>
        <span>/</span>
        <Link to="/admin/hrm/training" className="hover:text-lime">Training</Link>
        <span>/</span>
        <span className="font-semibold text-inherit">Training Feedback</span>
      </div>
      <PageHeader
        title="Training Feedback"
        desc="Ratings and comments collected from employees after training sessions — spot what works and what needs fixing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <ExportButtons filename="training-feedback" rows={exportRows} />
            {canManage && (
              <Button onClick={() => { setLogging({ programId: feedbackOptions[0]?.id || '', staffUserId: '', rating: '5', comment: '' }); setErr('') }}>
                <Plus className="size-4" /> Log feedback
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Star} label="Average rating" value={kpi.avg ? `${kpi.avg}/5` : '—'} sub={`${kpi.responses} responses`} />
        <Kpi icon={Users} label="Response rate" value={kpi.eligible ? `${Math.round((kpi.responses / kpi.eligible) * 100)}%` : '—'} sub={`${kpi.responses} of ${kpi.eligible} enrolled`} />
        <Kpi icon={MessageSquare} label="Written comments" value={String(kpi.withComment)} sub={`${kpi.five} five-star ratings`} />
        <Kpi icon={ThumbsUp} label="Top rated program" value={kpi.top ? `${kpi.top.avg}/5` : '—'} sub={kpi.top?.title} />
        <Kpi icon={AlertTriangle} label="Needs attention" value={kpi.worst ? `${kpi.worst.avg}/5` : '—'} sub={kpi.worst?.title} />
      </div>

      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2"><SearchField value={q} onChange={setQ} placeholder="Search employee, program, comment…" /></div>
        <Select value={fRating} onChange={(e) => setFRating(e.target.value)}>
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} star{r === 1 ? '' : 's'}</option>)}
        </Select>
        <Select value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option value="all">All departments</option>
          {Array.from(new Set(staff.map((s) => s.department))).sort().map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={fProgram} onChange={(e) => setFProgram(e.target.value)}>
          <option value="all">All programs</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
        </Select>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        {/* Rating distribution */}
        <div className="card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-mist">Rating distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => (
              <div key={r} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-bold">{r} ★</span>
                <div className="h-2.5 flex-1 rounded bg-black/10 dark:bg-white/10">
                  <div className="h-2.5 rounded bg-amber-400" style={{ width: `${Math.round((dist[r - 1] / maxDist) * 100)}%` }} />
                </div>
                <span className="w-6 text-right font-bold">{dist[r - 1]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mist">Average {filtered.length ? averageRating(filtered) : 0}/5 across {filtered.length} response{filtered.length === 1 ? '' : 's'} shown.</p>
        </div>

        {/* Per-program summary */}
        <div className="card overflow-x-auto xl:col-span-2">
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Program</th>
                <th className="px-3 py-2.5 text-center">Responses</th>
                <th className="px-3 py-2.5 text-center">Average</th>
                <th className="px-3 py-2.5">Distribution</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {programSummary.map(({ p, avg, d, n }) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-bold">{p.title}</p>
                    <p className="text-[10px] text-mist">{p.code}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold">{n}</td>
                  <td className="px-3 py-2.5 text-center"><Stars value={avg} /> <span className="text-xs font-bold">{avg}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex h-2.5 w-28 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <div key={r} className={r >= 4 ? 'bg-lime' : r === 3 ? 'bg-amber-400' : 'bg-rose-500'} style={{ width: `${(d[r - 1] / Math.max(1, n)) * 100}%` }} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge></td>
                </tr>
              ))}
              {!programSummary.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-mist">No feedback recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback entries */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 860 }}>
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Employee</th>
              <th className="px-3 py-2.5">Department</th>
              <th className="px-3 py-2.5">Program</th>
              <th className="px-3 py-2.5">Rating</th>
              <th className="px-3 py-2.5">Comment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e: FeedbackEntry) => (
              <tr key={`${e.programId}-${e.staffUserId}`} className="border-b border-line last:border-0 hover:bg-lime/[0.02]">
                <td className="px-3 py-2.5 font-mono text-xs text-mist">{e.date || '—'}</td>
                <td className="px-3 py-2.5 font-bold">{staffName(e.staffUserId)}</td>
                <td className="px-3 py-2.5 text-xs text-mist">{deptOf(e.staffUserId)}</td>
                <td className="px-3 py-2.5 text-xs">{e.programCode} · {e.programTitle}</td>
                <td className="px-3 py-2.5"><Stars value={e.rating} /></td>
                <td className="max-w-[380px] px-3 py-2.5 text-xs text-mist">{e.comment || <span className="opacity-60">No comment</span>}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-mist">No feedback matches the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Log feedback modal */}
      <Modal open={!!logging} onClose={() => setLogging(null)} title="Log training feedback" wide>
        {logging && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Program" required>
              <Select
                value={logging.programId}
                onChange={(e) => setLogging({ ...logging, programId: e.target.value, staffUserId: '' })}
              >
                {feedbackOptions.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
              </Select>
            </Field>
            <Field label="Employee" required>
              <Select value={logging.staffUserId} onChange={(e) => setLogging({ ...logging, staffUserId: e.target.value })}>
                <option value="">Select employee…</option>
                {(programs.find((p) => p.id === logging.programId)?.enrollments || []).map((e) => (
                  <option key={e.staffUserId} value={e.staffUserId} disabled={typeof e.rating === 'number'}>
                    {staffName(e.staffUserId)}{typeof e.rating === 'number' ? ` (rated ${e.rating})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rating" required>
              <Select value={logging.rating} onChange={(e) => setLogging({ ...logging, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} — {r === 5 ? 'Excellent' : r === 4 ? 'Good' : r === 3 ? 'Average' : r === 2 ? 'Poor' : 'Very poor'}</option>)}
              </Select>
            </Field>
            <Field label="Comment" className="sm:col-span-2">
              <Input value={logging.comment} onChange={(e) => setLogging({ ...logging, comment: e.target.value })} placeholder="What did the employee say about the training?" />
            </Field>
            {err && <p className="text-xs font-bold text-rose-500 sm:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setLogging(null)}>Cancel</Button>
              <Button onClick={saveFeedback}>Save feedback</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
