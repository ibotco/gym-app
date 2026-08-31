import { useState } from 'react'
import { Plus, Pencil, Trash2, Briefcase, UserPlus } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { JOB_TYPES, CANDIDATE_STAGES } from '../../../lib/hrm'
import type { JobPosting, Candidate, JobType, CandidateStage } from '../../../types'

function stageTone(s: CandidateStage): 'sky' | 'zinc' | 'amber' | 'violet' | 'lime' | 'rose' {
  if (s === 'applied') return 'zinc'
  if (s === 'screening') return 'sky'
  if (s === 'interview') return 'amber'
  if (s === 'offer') return 'violet'
  if (s === 'hired') return 'lime'
  return 'rose'
}

export function Recruitment() {
  const app = useApp()
  const { jobs, candidates, departments, upsertJob, deleteJob, upsertCandidate, deleteCandidate, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [jobModal, setJobModal] = useState<{ id?: string; title: string; department: string; location: string; type: JobType; salary: string; description: string; status: 'open' | 'closed' } | null>(null)
  const [candModal, setCandModal] = useState<{ id?: string; name: string; email: string; phone: string; jobId: string; stage: CandidateStage; notes: string } | null>(null)

  const jobTitle = (id: string) => jobs.find((j) => j.id === id)?.title || id

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

  return (
    <div>
      <PageHeader
        title="Recruitment"
        desc="Post jobs and track candidates through the hiring pipeline."
        actions={canManage ? (
          <>
            <Button variant="outline" onClick={() => setCandModal({ name: '', email: '', phone: '', jobId: jobs[0]?.id || '', stage: 'applied', notes: '' })}><UserPlus className="size-4" /> Add candidate</Button>
            <Button onClick={() => setJobModal({ title: '', department: departments[0]?.name || '', location: 'Accra', type: 'full-time', salary: '', description: '', status: 'open' })}><Plus className="size-4" /> Post job</Button>
          </>
        ) : undefined}
      />

      <h2 className="font-display text-xl">Open positions</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {jobs.map((j) => {
          const count = candidates.filter((c) => c.jobId === j.id).length
          return (
            <div key={j.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-xs text-mist">{j.department} · {j.location}</p>
                </div>
                <Badge tone={j.status === 'open' ? 'lime' : 'zinc'}>{j.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-mist">{j.type.replace('-', ' ')} · {j.salary}</p>
              <p className="mt-2 text-sm text-mist line-clamp-2">{j.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-mist">{count} candidate{count === 1 ? '' : 's'} · posted {formatDate(j.postedAt)}</span>
                {canManage && (
                  <div className="flex">
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setJobModal({ id: j.id, title: j.title, department: j.department, location: j.location, type: j.type, salary: j.salary, description: j.description, status: j.status })} aria-label="Edit"><Pencil className="size-4" /></button>
                    <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { deleteJob(j.id); toast.success('Job deleted') }} aria-label="Delete"><Trash2 className="size-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!jobs.length && <Empty title="No job postings" />}

      <h2 className="font-display mt-8 text-xl">Candidates</h2>
      <div className="card mt-3 table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Job</th><th>Contact</th><th>Stage</th><th>Applied</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td className="text-mist">{jobTitle(c.jobId)}</td>
                <td className="text-mist">{c.email}<br />{c.phone}</td>
                <td>
                  {canManage ? (
                    <Select value={c.stage} onChange={(e) => { upsertCandidate({ ...c, stage: e.target.value as CandidateStage }); toast.success('Stage updated') }}>
                      {CANDIDATE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  ) : (
                    <Badge tone={stageTone(c.stage)}>{c.stage}</Badge>
                  )}
                </td>
                <td className="text-mist">{formatDate(c.appliedAt)}</td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setCandModal({ id: c.id, name: c.name, email: c.email, phone: c.phone, jobId: c.jobId, stage: c.stage, notes: c.notes || '' })} aria-label="Edit"><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { deleteCandidate(c.id); toast.success('Candidate removed') }} aria-label="Delete"><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Job modal */}
      <Modal open={!!jobModal} onClose={() => setJobModal(null)} title={jobModal?.id ? 'Edit job' : 'Post job'} wide>
        {jobModal && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" required><Input value={jobModal.title} onChange={(e) => setJobModal({ ...jobModal, title: e.target.value })} /></Field>
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
                <option value="open">open</option>
                <option value="closed">closed</option>
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><Textarea value={jobModal.description} onChange={(e) => setJobModal({ ...jobModal, description: e.target.value })} rows={3} /></Field></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setJobModal(null)}>Cancel</Button>
              <Button onClick={saveJob}><Briefcase className="size-4" /> {jobModal.id ? 'Save job' : 'Post job'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Candidate modal */}
      <Modal open={!!candModal} onClose={() => setCandModal(null)} title={candModal?.id ? 'Edit candidate' : 'Add candidate'}>
        {candModal && (
          <div className="grid gap-3">
            <Field label="Name" required><Input value={candModal.name} onChange={(e) => setCandModal({ ...candModal, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={candModal.email} onChange={(e) => setCandModal({ ...candModal, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={candModal.phone} onChange={(e) => setCandModal({ ...candModal, phone: e.target.value })} /></Field>
            <Field label="Job">
              <Select value={candModal.jobId} onChange={(e) => setCandModal({ ...candModal, jobId: e.target.value })}>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={candModal.stage} onChange={(e) => setCandModal({ ...candModal, stage: e.target.value as CandidateStage })}>
                {CANDIDATE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Notes"><Textarea value={candModal.notes} onChange={(e) => setCandModal({ ...candModal, notes: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCandModal(null)}>Cancel</Button>
              <Button onClick={saveCandidate}>{candModal.id ? 'Save candidate' : 'Add candidate'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
