import { useState } from 'react'
import { Plus, Trash2, Star } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import type { PerformanceReview } from '../../../types'

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 text-lime" aria-label={`${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`size-4 ${i < n ? 'fill-current' : 'text-line'}`} />
      ))}
    </span>
  )
}

export function Performance() {
  const app = useApp()
  const { reviews, staff, users, upsertReview, deleteReview, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [editing, setEditing] = useState<{ id?: string; staffUserId: string; reviewerId: string; period: string; rating: number; strengths: string; improvements: string; goals: string; status: 'draft' | 'completed' } | null>(null)
  const [deleting, setDeleting] = useState<PerformanceReview | null>(null)

  const name = (id: string) => users.find((u) => u.id === id)?.name || id

  const openNew = () => setEditing({ staffUserId: staff[0]?.userId || '', reviewerId: user?.id || '', period: String(new Date().getFullYear()), rating: 3, strengths: '', improvements: '', goals: '', status: 'draft' })
  const openEdit = (r: PerformanceReview) => setEditing({ id: r.id, staffUserId: r.staffUserId, reviewerId: r.reviewerId, period: r.period, rating: r.rating, strengths: r.strengths || '', improvements: r.improvements || '', goals: r.goals || '', status: r.status })

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
    toast.success(isNew ? 'Review created' : 'Review updated')
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Performance reviews"
        desc="Document staff performance, ratings, and goals."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New review</Button> : undefined}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {[...reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{name(r.staffUserId)}</p>
                <p className="text-xs text-mist">Reviewed by {name(r.reviewerId)} · {r.period}</p>
              </div>
              <Badge tone={r.status === 'completed' ? 'lime' : 'zinc'}>{r.status}</Badge>
            </div>
            <div className="mt-3"><Stars n={r.rating} /></div>
            {r.strengths && <p className="mt-2 text-sm text-mist"><span className="font-semibold text-lime">Strengths: </span>{r.strengths}</p>}
            {r.improvements && <p className="mt-1 text-sm text-mist"><span className="font-semibold text-amber-500">Improve: </span>{r.improvements}</p>}
            {r.goals && <p className="mt-1 text-sm text-mist"><span className="font-semibold text-sky-400">Goals: </span>{r.goals}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-mist">{formatDate(r.reviewedAt)}</span>
              {canManage && (
                <div className="flex">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(r)} aria-label="Edit">Edit</button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(r)} aria-label="Delete"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {!reviews.length && <Empty title="No reviews yet" />}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit review' : 'New review'} wide>
        {editing && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Staff member">
                <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                  {staff.map((s) => {
                    const u = users.find((x) => x.id === s.userId)
                    return <option key={s.id} value={s.userId}>{u?.name}</option>
                  })}
                </Select>
              </Field>
              <Field label="Period (year)"><Input value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'draft' | 'completed' })}>
                  <option value="draft">draft</option>
                  <option value="completed">completed</option>
                </Select>
              </Field>
              <Field label="Rating">
                <Select value={String(editing.rating)} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Strengths"><Textarea value={editing.strengths} onChange={(e) => setEditing({ ...editing, strengths: e.target.value })} rows={2} /></Field>
            <Field label="Areas for improvement"><Textarea value={editing.improvements} onChange={(e) => setEditing({ ...editing, improvements: e.target.value })} rows={2} /></Field>
            <Field label="Goals"><Textarea value={editing.goals} onChange={(e) => setEditing({ ...editing, goals: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save review' : 'Create review'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete review?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete review for {name(deleting.staffUserId)}?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteReview(deleting.id); toast.success('Review deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
