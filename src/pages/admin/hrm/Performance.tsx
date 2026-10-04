import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Star, Award, TrendingUp, Users, ClipboardCheck, Printer } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, StatCard, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import type { PerformanceReview } from '../../../types'

/* ---------- rating meta: colour + professional label ---------- */
const RATING_META: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: '#84cc16' },
  4: { label: 'Exceeds expectations', color: '#22c55e' },
  3: { label: 'Meets expectations', color: '#f59e0b' },
  2: { label: 'Needs improvement', color: '#f97316' },
  1: { label: 'Unsatisfactory', color: '#ef4444' },
}
const ratingMeta = (n: number) => RATING_META[Math.max(1, Math.min(5, Math.round(n)))]

function Stars({ n, size = 'size-4' }: { n: number; size?: string }) {
  const c = ratingMeta(n).color
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < n ? '' : 'text-line'}`} style={i < n ? { color: c, fill: c } : undefined} />
      ))}
    </span>
  )
}

/** Clickable star picker used in the review form. */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="transition hover:scale-110"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className="size-7" style={n <= value ? { color: ratingMeta(value).color, fill: ratingMeta(value).color } : undefined} />
        </button>
      ))}
      <span className="ml-2 text-sm font-bold" style={{ color: ratingMeta(value).color }}>{ratingMeta(value).label}</span>
    </div>
  )
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

interface Form {
  staffUserId: string
  reviewerId: string
  period: string
  rating: number
  strengths: string
  improvements: string
  goals: string
  status: 'draft' | 'completed'
}

export function Performance() {
  const app = useApp()
  const { reviews, staff, users, upsertReview, deleteReview, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [statusF, setStatusF] = useState('')
  const [editing, setEditing] = useState<{ id?: string } & Form | null>(null)
  const [detail, setDetail] = useState<PerformanceReview | null>(null)
  const [deleting, setDeleting] = useState<PerformanceReview | null>(null)

  const name = (id: string) => users.find((u) => u.id === id)?.name || id

  /* ----- filters ----- */
  const years = useMemo(() => [...new Set(reviews.map((r) => r.period))].sort().reverse(), [reviews])
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...reviews]
      .filter((r) => (!year || r.period === year) && (!statusF || r.status === statusF))
      .filter((r) => !ql || `${name(r.staffUserId)} ${name(r.reviewerId)}`.toLowerCase().includes(ql))
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
  }, [reviews, q, year, statusF, users]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- stats ----- */
  const stats = useMemo(() => {
    const thisYear = String(new Date().getFullYear())
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    return {
      total: reviews.length,
      avg: avg ? avg.toFixed(1) : '—',
      completed: reviews.filter((r) => r.status === 'completed').length,
      drafts: reviews.filter((r) => r.status === 'draft').length,
      staffReviewed: new Set(reviews.filter((r) => r.period === thisYear).map((r) => r.staffUserId)).size,
    }
  }, [reviews])

  /* ----- distribution + top performers ----- */
  const distribution = useMemo(
    () => [5, 4, 3, 2, 1].map((n) => ({ n, count: filtered.filter((r) => Math.round(r.rating) === n).length })),
    [filtered],
  )
  const topPerformers = useMemo(() => {
    const latest = new Map<string, PerformanceReview>()
    for (const r of [...reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))) latest.set(r.staffUserId, r)
    return [...latest.values()].sort((a, b) => b.rating - a.rating || b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 6)
  }, [reviews])

  const openNew = () => setEditing({
    staffUserId: staff[0]?.userId || '', reviewerId: user?.id || '', period: String(new Date().getFullYear()),
    rating: 3, strengths: '', improvements: '', goals: '', status: 'draft',
  })
  const openEdit = (r: PerformanceReview) => {
    setDetail(null)
    setEditing({ id: r.id, staffUserId: r.staffUserId, reviewerId: r.reviewerId, period: r.period, rating: r.rating, strengths: r.strengths || '', improvements: r.improvements || '', goals: r.goals || '', status: r.status })
  }

  const save = () => {
    if (!editing) return
    if (!editing.staffUserId) { toast.error('Select a staff member.'); return }
    const isNew = !editing.id
    const rec: PerformanceReview = {
      id: editing.id || uid('rv'),
      staffUserId: editing.staffUserId,
      reviewerId: editing.reviewerId,
      period: editing.period,
      rating: editing.rating,
      strengths: editing.strengths.trim() || undefined,
      improvements: editing.improvements.trim() || undefined,
      goals: editing.goals.trim() || undefined,
      status: editing.status,
      reviewedAt: isNew ? new Date().toISOString().slice(0, 10) : (reviews.find((r) => r.id === editing.id)?.reviewedAt || new Date().toISOString().slice(0, 10)),
    }
    upsertReview(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Review', `${isNew ? 'Created' : 'Updated'} review for ${name(rec.staffUserId)}`)
    toast.success(isNew ? 'Review created' : 'Review updated', name(rec.staffUserId))
    setEditing(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    deleteReview(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Review', `Deleted review for ${name(deleting.staffUserId)}`)
    toast.success('Review deleted', name(deleting.staffUserId))
    setDeleting(null); setDetail(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span className="font-semibold text-inherit">Performance</span>
      </div>
      <PageHeader
        title="Performance"
        desc="Appraisals, ratings and development goals for your team — tracked per review period."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New review</Button> : undefined}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total reviews" value={String(stats.total)} icon={<ClipboardCheck className="size-4" />} />
        <StatCard label="Average rating" value={stats.avg === '—' ? '—' : `${stats.avg}/5`} icon={<Star className="size-4" />} hint={stats.avg === '—' ? '' : ratingMeta(Number(stats.avg)).label} />
        <StatCard label="Completed / drafts" value={`${stats.completed} / ${stats.drafts}`} icon={<Award className="size-4" />} />
        <StatCard label="Staff reviewed this year" value={String(stats.staffReviewed)} icon={<Users className="size-4" />} hint={`of ${staff.length}`} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search staff or reviewer…" className="max-w-xs" />
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="max-w-[130px]" aria-label="Filter by period">
          <option value="">All periods</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="max-w-[150px]" aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <ExportButtons filename="performance-reviews" rows={filtered.map((r) => ({
            Staff: name(r.staffUserId), Reviewer: name(r.reviewerId), Period: r.period, Rating: `${r.rating}/5`,
            Band: ratingMeta(r.rating).label, Status: r.status, 'Reviewed on': r.reviewedAt,
            Strengths: r.strengths || '', Improvements: r.improvements || '', Goals: r.goals || '',
          }))} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        {/* ============ REVIEW CARDS (2-col like col-md-6) ============ */}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => {
            const meta = ratingMeta(r.rating)
            return (
              <div key={r.id} className="card overflow-hidden transition hover:border-lime/40">
                <div className="h-1" style={{ background: meta.color }} />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white" style={{ background: meta.color }} data-tip={name(r.staffUserId)}>
                      {initials(name(r.staffUserId))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{name(r.staffUserId)}</p>
                      <p className="text-xs text-mist">Reviewed by {name(r.reviewerId)} · {formatDate(r.reviewedAt)}</p>
                    </div>
                    <Badge tone={r.status === 'completed' ? 'lime' : 'amber'}>{r.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Stars n={r.rating} />
                    <span className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-[13px] text-mist">
                    {r.strengths && <p className="flex gap-1.5"><span className="shrink-0 font-bold text-lime">Strengths</span><span className="truncate">{r.strengths}</span></p>}
                    {r.improvements && <p className="flex gap-1.5"><span className="shrink-0 font-bold text-amber-500">Improve</span><span className="truncate">{r.improvements}</span></p>}
                    {r.goals && <p className="flex gap-1.5"><span className="shrink-0 font-bold text-sky-400">Goals</span><span className="truncate">{r.goals}</span></p>}
                    {!r.strengths && !r.improvements && !r.goals && <p className="italic">No notes yet.</p>}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <Badge tone="zinc">Period {r.period}</Badge>
                    <div className="flex">
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="View" onClick={() => setDetail(r)}><ClipboardCheck className="size-4" /></button>
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className="card col-span-full p-10 text-center text-mist">
              <ClipboardCheck className="mx-auto mb-2 size-8" />
              No reviews match. {canManage && 'Create the first appraisal with “New review”.'}
            </div>
          )}
        </div>

        {/* ============ SIDEBAR ============ */}
        <div className="space-y-4">
          {/* Rating distribution */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><TrendingUp className="size-4 text-lime" /> Rating distribution</p>
            <div className="space-y-2">
              {distribution.map(({ n, count }) => {
                const max = Math.max(1, ...distribution.map((d) => d.count))
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-8 text-right text-xs font-bold text-mist">{n}★</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: ratingMeta(n).color }} />
                    </div>
                    <span className="w-6 text-xs text-mist">{count}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] text-mist">Based on the filtered reviews above.</p>
          </div>

          {/* Top performers */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Award className="size-4 text-lime" /> Top performers</p>
            {topPerformers.length === 0 && <p className="text-sm text-mist">No reviews yet.</p>}
            <div className="space-y-2">
              {topPerformers.map((r, i) => {
                const meta = ratingMeta(r.rating)
                return (
                  <button key={r.id} onClick={() => setDetail(r)} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left transition hover:border-lime/50">
                    <span className="w-4 text-center text-xs font-extrabold text-mist">{i + 1}</span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: meta.color }} data-tip={name(r.staffUserId)}>{initials(name(r.staffUserId))}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{name(r.staffUserId)}</p>
                      <p className="text-[11px] text-mist">{r.period} · {meta.label}</p>
                    </div>
                    <Stars n={r.rating} size="size-3" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============ DETAIL MODAL ============ */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Performance review" wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full text-base font-extrabold text-white" style={{ background: ratingMeta(detail.rating).color }} data-tip={name(detail.staffUserId)}>
                {initials(name(detail.staffUserId))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold">{name(detail.staffUserId)}</p>
                <p className="text-xs text-mist">Reviewed by {name(detail.reviewerId)} · Period {detail.period} · {formatDate(detail.reviewedAt)}</p>
              </div>
              <Badge tone={detail.status === 'completed' ? 'lime' : 'amber'}>{detail.status}</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Stars n={detail.rating} size="size-6" />
              <span className="text-sm font-bold" style={{ color: ratingMeta(detail.rating).color }}>{detail.rating}/5 · {ratingMeta(detail.rating).label}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-lime">Strengths</p>
                <p className="text-sm text-mist">{detail.strengths || '—'}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-amber-500">Areas to improve</p>
                <p className="text-sm text-mist">{detail.improvements || '—'}</p>
              </div>
              <div className="rounded-xl border border-line p-3 sm:col-span-2">
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-sky-400">Goals for next period</p>
                <p className="text-sm text-mist">{detail.goals || '—'}</p>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2 border-t border-line pt-3">
                <Button onClick={() => openEdit(detail)}><Pencil className="size-4" /> Edit</Button>
                <Button variant="danger" onClick={() => setDeleting(detail)}><Trash2 className="size-4" /> Delete</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ============ CREATE / EDIT MODAL ============ */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit review' : 'New performance review'} wide>
        {editing && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Staff member" required>
                <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                  {staff.map((s) => {
                    const u = users.find((x) => x.id === s.userId)
                    return <option key={s.id} value={s.userId}>{u?.name}</option>
                  })}
                </Select>
              </Field>
              <Field label="Reviewer">
                <Select value={editing.reviewerId} onChange={(e) => setEditing({ ...editing, reviewerId: e.target.value })}>
                  {users.filter((u) => ['super_admin', 'gym_manager', 'company_admin'].includes(u.role)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Period (year)"><Input value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'draft' | 'completed' })}>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                </Select>
              </Field>
            </div>
            <Field label="Overall rating">
              <StarPicker value={editing.rating} onChange={(n) => setEditing({ ...editing, rating: n })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Strengths"><Textarea value={editing.strengths} onChange={(e) => setEditing({ ...editing, strengths: e.target.value })} placeholder="What they do well…" /></Field>
              <Field label="Areas for improvement"><Textarea value={editing.improvements} onChange={(e) => setEditing({ ...editing, improvements: e.target.value })} placeholder="Where to focus…" /></Field>
            </div>
            <Field label="Goals for next period"><Textarea value={editing.goals} onChange={(e) => setEditing({ ...editing, goals: e.target.value })} placeholder="Measurable goals…" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save review' : 'Create review'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ DELETE CONFIRM ============ */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete review?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete the {deleting.period} review for <span className="font-semibold text-inherit">{name(deleting.staffUserId)}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
