import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Briefcase, UserPlus, MapPin, Mail, Phone, ChevronLeft, ChevronRight,
  Printer, Users, Award, Send, X,
} from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, StatCard, Segmented, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { JOB_TYPES, CANDIDATE_STAGES } from '../../../lib/hrm'
import type { JobPosting, Candidate, JobType, CandidateStage } from '../../../types'

/* ---------- stage meta: professional colour coding ---------- */
const STAGE_META: Record<CandidateStage, { label: string; color: string }> = {
  applied: { label: 'Applied', color: '#64748b' },
  screening: { label: 'Screening', color: '#0ea5e9' },
  interview: { label: 'Interview', color: '#f59e0b' },
  offer: { label: 'Offer', color: '#8b5cf6' },
  hired: { label: 'Hired', color: '#84cc16' },
  rejected: { label: 'Rejected', color: '#ef4444' },
}
const PIPELINE_ORDER: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
const daysAgo = (isoDate: string) => {
  const d = Math.round((Date.now() - new Date(`${isoDate}T00:00:00`).getTime()) / 86400000)
  return d <= 0 ? 'today' : `${d}d ago`
}

function StageBadge({ stage }: { stage: CandidateStage }) {
  const m = STAGE_META[stage]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: m.color, color: m.color, background: `${m.color}14` }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
    </span>
  )
}

export function Recruitment() {
  const app = useApp()
  const { jobs, candidates, departments, upsertJob, deleteJob, upsertCandidate, deleteCandidate, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [view, setView] = useState('pipeline')
  const [q, setQ] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [jobModal, setJobModal] = useState<{ id?: string; title: string; department: string; location: string; type: JobType; salary: string; description: string; status: 'open' | 'closed' } | null>(null)
  const [candModal, setCandModal] = useState<{ id?: string; name: string; email: string; phone: string; jobId: string; stage: CandidateStage; notes: string } | null>(null)
  const [detail, setDetail] = useState<Candidate | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'job' | 'candidate'; id: string; label: string } | null>(null)

  const jobTitle = (id: string) => jobs.find((j) => j.id === id)?.title || '—'

  /* ----- filters ----- */
  const filteredCandidates = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...candidates]
      .filter((c) => (!jobFilter || c.jobId === jobFilter) && (!stageFilter || c.stage === stageFilter))
      .filter((c) => !ql || `${c.name} ${c.email} ${jobTitle(c.jobId)}`.toLowerCase().includes(ql))
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
  }, [candidates, q, jobFilter, stageFilter, jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- stats ----- */
  const stats = useMemo(() => ({
    open: jobs.filter((j) => j.status === 'open').length,
    pipeline: candidates.filter((c) => c.stage !== 'hired' && c.stage !== 'rejected').length,
    offers: candidates.filter((c) => c.stage === 'offer').length,
    hired: candidates.filter((c) => c.stage === 'hired').length,
  }), [jobs, candidates])

  /* ----- actions ----- */
  const moveStage = (c: Candidate, dir: 1 | -1) => {
    const idx = PIPELINE_ORDER.indexOf(c.stage) + dir
    if (idx < 0 || idx >= PIPELINE_ORDER.length) return
    const stage = PIPELINE_ORDER[idx]
    upsertCandidate({ ...c, stage })
    log(user?.id || 'system', 'UPDATE', 'Candidate', `Moved ${c.name} to ${stage}`)
    toast.success(`${c.name} → ${STAGE_META[stage].label}`)
    setDetail((d) => (d && d.id === c.id ? { ...d, stage } : d))
  }
  const setStage = (c: Candidate, stage: CandidateStage) => {
    upsertCandidate({ ...c, stage })
    log(user?.id || 'system', 'UPDATE', 'Candidate', `Moved ${c.name} to ${stage}`)
    toast.success(`${c.name} → ${STAGE_META[stage].label}`)
    setDetail((d) => (d && d.id === c.id ? { ...d, stage } : d))
  }

  const saveJob = () => {
    if (!jobModal) return
    if (jobModal.title.trim().length < 2) { toast.error('Enter a job title.'); return }
    const isNew = !jobModal.id
    const rec: JobPosting = {
      id: jobModal.id || uid('job'),
      title: jobModal.title.trim(),
      department: jobModal.department,
      location: jobModal.location.trim() || 'Accra',
      type: jobModal.type,
      salary: jobModal.salary.trim() || 'Negotiable',
      description: jobModal.description.trim(),
      status: jobModal.status,
      postedAt: isNew ? new Date().toISOString().slice(0, 10) : (jobs.find((j) => j.id === jobModal.id)?.postedAt || new Date().toISOString().slice(0, 10)),
    }
    upsertJob(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Job', `${isNew ? 'Posted' : 'Updated'} ${rec.title}`)
    toast.success(isNew ? 'Job posted' : 'Job updated', rec.title)
    setJobModal(null)
  }
  const saveCandidate = () => {
    if (!candModal) return
    if (candModal.name.trim().length < 2) { toast.error('Enter a candidate name.'); return }
    if (!candModal.jobId) { toast.error('Select a job.'); return }
    const isNew = !candModal.id
    const rec: Candidate = {
      id: candModal.id || uid('ca'),
      name: candModal.name.trim(),
      email: candModal.email.trim(),
      phone: candModal.phone.trim(),
      jobId: candModal.jobId,
      stage: candModal.stage,
      notes: candModal.notes.trim() || undefined,
      appliedAt: isNew ? new Date().toISOString().slice(0, 10) : (candidates.find((c) => c.id === candModal.id)?.appliedAt || new Date().toISOString().slice(0, 10)),
    }
    upsertCandidate(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Candidate', `${isNew ? 'Added' : 'Updated'} ${rec.name}`)
    toast.success(isNew ? 'Candidate added' : 'Candidate updated', rec.name)
    setCandModal(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    if (deleting.kind === 'job') deleteJob(deleting.id)
    else deleteCandidate(deleting.id)
    log(user?.id || 'system', 'DELETE', deleting.kind === 'job' ? 'Job' : 'Candidate', `Deleted ${deleting.label}`)
    toast.success(deleting.kind === 'job' ? 'Job deleted' : 'Candidate removed', deleting.label)
    setDeleting(null); setDetail(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span className="font-semibold text-inherit">Recruitment</span>
      </div>
      <PageHeader
        title="Recruitment"
        desc="Post jobs and move candidates through a colour-coded hiring pipeline."
        actions={canManage ? (
          <>
            <Button variant="outline" onClick={() => setCandModal({ name: '', email: '', phone: '', jobId: jobs[0]?.id || '', stage: 'applied', notes: '' })}><UserPlus className="size-4" /> Add candidate</Button>
            <Button onClick={() => setJobModal({ title: '', department: departments[0]?.name || '', location: 'Accra', type: 'full-time', salary: '', description: '', status: 'open' })}><Plus className="size-4" /> Post job</Button>
          </>
        ) : undefined}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open positions" value={String(stats.open)} icon={<Briefcase className="size-4" />} />
        <StatCard label="In pipeline" value={String(stats.pipeline)} icon={<Users className="size-4" />} hint="active candidates" />
        <StatCard label="Offers out" value={String(stats.offers)} icon={<Send className="size-4" />} />
        <StatCard label="Hired" value={String(stats.hired)} icon={<Award className="size-4" />} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search candidates…" className="max-w-xs" />
        <Select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="max-w-[200px]" aria-label="Filter by job">
          <option value="">All jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </Select>
        <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="max-w-[150px]" aria-label="Filter by stage">
          <option value="">All stages</option>
          {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </Select>
        <div className="mx-auto"><Segmented value={view} onChange={setView} options={[{ id: 'pipeline', label: 'Pipeline' }, { id: 'jobs', label: 'Job openings' }, { id: 'candidates', label: 'Candidates' }]} /></div>
        <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
        <ExportButtons filename="candidates" rows={filteredCandidates.map((c) => ({
          Name: c.name, Email: c.email, Phone: c.phone, Job: jobTitle(c.jobId), Stage: STAGE_META[c.stage].label, Applied: c.appliedAt, Notes: c.notes || '',
        }))} />
      </div>

      {/* ============ PIPELINE (kanban) ============ */}
      {view === 'pipeline' && (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1080px] grid-cols-6 gap-3">
            {PIPELINE_ORDER.map((stage) => {
              const m = STAGE_META[stage]
              const list = filteredCandidates.filter((c) => c.stage === stage)
              return (
                <div key={stage} className="card flex h-fit max-h-[65vh] flex-col overflow-hidden">
                  <div className="flex items-center gap-2 border-b-2 px-3 py-2.5" style={{ borderColor: m.color }}>
                    <span className="size-2 rounded-full" style={{ background: m.color }} />
                    <p className="flex-1 text-xs font-extrabold uppercase tracking-wide">{m.label}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: `${m.color}22`, color: m.color }}>{list.length}</span>
                  </div>
                  <div className="space-y-2 overflow-y-auto p-2">
                    {list.map((c) => (
                      <div key={c.id} className="rounded-xl border border-line p-2.5 transition hover:border-lime/50 hover:bg-lime/[0.03]">
                        <button className="flex w-full items-center gap-2 text-left" onClick={() => setDetail(c)}>
                          <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: m.color }}>{initials(c.name)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold">{c.name}</p>
                            <p className="truncate text-[11px] text-mist">{jobTitle(c.jobId)}</p>
                          </div>
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-mist">{daysAgo(c.appliedAt)}</span>
                          {canManage && (
                            <span className="flex gap-0.5">
                              <button className="rounded p-1 text-mist hover:text-lime disabled:opacity-30" disabled={stage === 'applied'} onClick={() => moveStage(c, -1)} title="Previous stage"><ChevronLeft className="size-3.5" /></button>
                              <button className="rounded p-1 text-mist hover:text-lime disabled:opacity-30" disabled={stage === 'rejected'} onClick={() => moveStage(c, 1)} title="Next stage"><ChevronRight className="size-3.5" /></button>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {!list.length && <p className="px-1 py-4 text-center text-[11px] text-mist">No candidates</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ JOB OPENINGS ============ */}
      {view === 'jobs' && (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((j) => {
            const cands = candidates.filter((c) => c.jobId === j.id)
            const max = Math.max(1, ...PIPELINE_ORDER.map((s) => cands.filter((c) => c.stage === s).length))
            return (
              <div key={j.id} className="card overflow-hidden transition hover:border-lime/40">
                <div className="h-1" style={{ background: j.status === 'open' ? '#84cc16' : '#64748b' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{j.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-mist">
                        <span>{j.department}</span>
                        <span className="flex items-center gap-1"><MapPin className="size-3" /> {j.location}</span>
                      </p>
                    </div>
                    <Badge tone={j.status === 'open' ? 'lime' : 'zinc'}>{j.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-mist">
                    <Badge tone="sky">{JOB_TYPES.find((t) => t.id === j.type)?.label || j.type}</Badge>
                    <span className="font-semibold">{j.salary}</span>
                  </div>
                  {j.description && <p className="mt-2 line-clamp-2 text-sm text-mist">{j.description}</p>}
                  {/* per-stage mini bars */}
                  <div className="mt-3 flex items-end gap-1" title="Candidates per stage">
                    {PIPELINE_ORDER.map((s) => {
                      const n = cands.filter((c) => c.stage === s).length
                      return (
                        <div key={s} className="flex-1">
                          <div className="flex h-8 items-end rounded-sm bg-black/5 dark:bg-white/5">
                            <div className="w-full rounded-sm" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 4 : 0, background: STAGE_META[s].color }} />
                          </div>
                          <p className="mt-0.5 text-center text-[9px] font-bold text-mist">{n || ''}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <button className="text-xs font-bold text-lime hover:underline" onClick={() => { setJobFilter(j.id); setView('candidates') }}>
                      {cands.length} candidate{cands.length === 1 ? '' : 's'} →
                    </button>
                    <span className="flex items-center">
                      <span className="mr-2 text-[11px] text-mist">posted {formatDate(j.postedAt)}</span>
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setJobModal({ id: j.id, title: j.title, department: j.department, location: j.location, type: j.type, salary: j.salary, description: j.description, status: j.status })}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting({ kind: 'job', id: j.id, label: j.title })}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {!jobs.length && <div className="card col-span-full p-10 text-center text-mist"><Briefcase className="mx-auto mb-2 size-8" /> No job postings yet.</div>}
        </div>
      )}

      {/* ============ CANDIDATES TABLE ============ */}
      {view === 'candidates' && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-3">Candidate</th>
                <th className="px-3 py-3">Job</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Applied</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                  <td className="px-3 py-2.5">
                    <button className="flex items-center gap-2.5 text-left font-bold hover:text-lime" onClick={() => setDetail(c)}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: STAGE_META[c.stage].color }}>{initials(c.name)}</span>
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-mist">{jobTitle(c.jobId)}</td>
                  <td className="px-3 py-2.5 text-mist">
                    <p className="flex items-center gap-1"><Mail className="size-3" /> {c.email || '—'}</p>
                    <p className="flex items-center gap-1"><Phone className="size-3" /> {c.phone || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {canManage ? (
                      <Select value={c.stage} onChange={(e) => setStage(c, e.target.value as CandidateStage)} className="max-w-[140px]" aria-label="Stage">
                        {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                      </Select>
                    ) : <StageBadge stage={c.stage} />}
                  </td>
                  <td className="px-3 py-2.5 text-mist">{formatDate(c.appliedAt)}<br /><span className="text-[10px]">{daysAgo(c.appliedAt)}</span></td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center justify-end gap-1">
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setCandModal({ id: c.id, name: c.name, email: c.email, phone: c.phone, jobId: c.jobId, stage: c.stage, notes: c.notes || '' })}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting({ kind: 'candidate', id: c.id, label: c.name })}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {!filteredCandidates.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">No candidates match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ CANDIDATE DETAIL ============ */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Candidate profile" wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full text-base font-extrabold text-white" style={{ background: STAGE_META[detail.stage].color }}>{initials(detail.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold">{detail.name}</p>
                <p className="text-xs text-mist">{jobTitle(detail.jobId)} · applied {formatDate(detail.appliedAt)} ({daysAgo(detail.appliedAt)})</p>
              </div>
              <StageBadge stage={detail.stage} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {detail.email && <a href={`mailto:${detail.email}`} className="flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm font-semibold hover:border-lime/50"><Mail className="size-4 text-lime" /> {detail.email}</a>}
              {detail.phone && <a href={`tel:${detail.phone}`} className="flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm font-semibold hover:border-lime/50"><Phone className="size-4 text-lime" /> {detail.phone}</a>}
            </div>
            {/* Stage stepper */}
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-mist">Hiring pipeline</p>
              <div className="flex items-center">
                {(['applied', 'screening', 'interview', 'offer', 'hired'] as CandidateStage[]).map((s, i) => {
                  const activeIdx = PIPELINE_ORDER.indexOf(detail.stage)
                  const reached = detail.stage !== 'rejected' && activeIdx >= i
                  const isCurrent = detail.stage === s
                  const m = STAGE_META[s]
                  return (
                    <div key={s} className="flex flex-1 flex-col items-center">
                      <div className="flex w-full items-center">
                        <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : reached ? '' : 'opacity-25'}`} style={{ background: m.color }} />
                        <button
                          onClick={() => canManage && setStage(detail, s)}
                          className="grid size-8 shrink-0 place-items-center rounded-full border-2 text-[10px] font-extrabold transition"
                          style={{ borderColor: m.color, background: reached ? m.color : 'transparent', color: reached ? '#fff' : m.color }}
                          title={m.label}
                        >
                          {i + 1}
                        </button>
                        <div className={`h-0.5 flex-1 ${i === 4 ? 'opacity-0' : activeIdx > i ? '' : 'opacity-25'}`} style={{ background: m.color }} />
                      </div>
                      <p className={`mt-1 text-[10px] font-bold ${isCurrent ? '' : 'text-mist'}`} style={isCurrent ? { color: m.color } : undefined}>{m.label}</p>
                    </div>
                  )
                })}
              </div>
              {detail.stage === 'rejected' && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: STAGE_META.rejected.color }}><X className="size-4" /> This candidate was rejected.</p>
              )}
              {canManage && detail.stage !== 'rejected' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => moveStage(detail, -1)} disabled={detail.stage === 'applied'}><ChevronLeft className="size-4" /> Back</Button>
                  {detail.stage !== 'hired' && <Button onClick={() => moveStage(detail, 1)}>Advance to {STAGE_META[PIPELINE_ORDER[PIPELINE_ORDER.indexOf(detail.stage) + 1]].label} <ChevronRight className="size-4" /></Button>}
                  <Button variant="danger" onClick={() => setStage(detail, 'rejected')}><X className="size-4" /> Reject</Button>
                </div>
              )}
            </div>
            {detail.notes && <p className="whitespace-pre-line rounded-xl border border-line p-3 text-sm text-mist">{detail.notes}</p>}
            {canManage && (
              <div className="flex gap-2 border-t border-line pt-3">
                <Button onClick={() => { const c = detail; setDetail(null); setCandModal({ id: c.id, name: c.name, email: c.email, phone: c.phone, jobId: c.jobId, stage: c.stage, notes: c.notes || '' }) }}><Pencil className="size-4" /> Edit</Button>
                <Button variant="danger" onClick={() => setDeleting({ kind: 'candidate', id: detail.id, label: detail.name })}><Trash2 className="size-4" /> Delete</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ============ JOB MODAL ============ */}
      <Modal open={!!jobModal} onClose={() => setJobModal(null)} title={jobModal?.id ? 'Edit job' : 'Post job'} wide>
        {jobModal && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" required><Input value={jobModal.title} onChange={(e) => setJobModal({ ...jobModal, title: e.target.value })} placeholder="e.g. Fitness Trainer" /></Field>
            <Field label="Department">
              <Select value={jobModal.department} onChange={(e) => setJobModal({ ...jobModal, department: e.target.value })}>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Location"><Input value={jobModal.location} onChange={(e) => setJobModal({ ...jobModal, location: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={jobModal.type} onChange={(e) => setJobModal({ ...jobModal, type: e.target.value as JobType })}>
                {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Salary"><Input value={jobModal.salary} onChange={(e) => setJobModal({ ...jobModal, salary: e.target.value })} placeholder="GHS 4,200 / month" /></Field>
            <Field label="Status">
              <Select value={jobModal.status} onChange={(e) => setJobModal({ ...jobModal, status: e.target.value as 'open' | 'closed' })}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><Textarea value={jobModal.description} onChange={(e) => setJobModal({ ...jobModal, description: e.target.value })} placeholder="Role summary, responsibilities, requirements…" /></Field></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setJobModal(null)}>Cancel</Button>
              <Button onClick={saveJob}><Briefcase className="size-4" /> {jobModal.id ? 'Save job' : 'Post job'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ CANDIDATE MODAL ============ */}
      <Modal open={!!candModal} onClose={() => setCandModal(null)} title={candModal?.id ? 'Edit candidate' : 'Add candidate'}>
        {candModal && (
          <div className="grid gap-3">
            <Field label="Name" required><Input value={candModal.name} onChange={(e) => setCandModal({ ...candModal, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email"><Input type="email" value={candModal.email} onChange={(e) => setCandModal({ ...candModal, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={candModal.phone} onChange={(e) => setCandModal({ ...candModal, phone: e.target.value })} /></Field>
            </div>
            <Field label="Job">
              <Select value={candModal.jobId} onChange={(e) => setCandModal({ ...candModal, jobId: e.target.value })}>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={candModal.stage} onChange={(e) => setCandModal({ ...candModal, stage: e.target.value as CandidateStage })}>
                {PIPELINE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
              </Select>
            </Field>
            <Field label="Notes"><Textarea value={candModal.notes} onChange={(e) => setCandModal({ ...candModal, notes: e.target.value })} placeholder="Interview feedback, references…" /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCandModal(null)}>Cancel</Button>
              <Button onClick={saveCandidate}>{candModal.id ? 'Save candidate' : 'Add candidate'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ DELETE CONFIRM ============ */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={deleting?.kind === 'job' ? 'Delete job posting?' : 'Remove candidate?'}>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleting.label}</span>? This cannot be undone.</p>
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
