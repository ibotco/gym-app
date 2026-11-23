import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { Button, Field, Input, Modal, MultiSelect, PageHeader, Select, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated, flushEducationBeforeNotification } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'
import { ScholarshipSetup } from './ScholarshipSetup'
import { ScholarshipApplications } from './ScholarshipApplications'
import { ScholarshipRenewals } from './ScholarshipRenewals'
import { previewScholarship } from '../../../lib/scholarshipBillingPreview'
import { planScholarshipPosting } from '../../../lib/scholarshipPostingPlan'
import { applyScholarshipBalance, consistentScholarshipAward } from '../../../lib/scholarshipBalanceApply'

const norm = (x: unknown) => String(x ?? '').trim().toLowerCase()
const selectedFeeIds = (value: unknown): string[] => { try { const parsed = JSON.parse(String(value ?? '[]')); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [] } catch { return [] } }
const blank = (): EduRow => ({ id: '', studentId: '', student: '', type: '', amount: '', session: '', term: '', status: 'Active', remarks: '' })
export function ScholarshipsPage() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find(b => b.id === activeBranchId)?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [view, setView] = useState<'awards' | 'setup' | 'applications' | 'renewals'>('awards')
  const [typesOpen, setTypesOpen] = useState(false)
  const [typeName, setTypeName] = useState('')
  const [typeDescription, setTypeDescription] = useState('')
  const [editingType, setEditingType] = useState<EduRow | null>(null)
  const [typeError, setTypeError] = useState('')
  const [edit, setEdit] = useState<EduRow | null>(null)
  const [previewAwardId, setPreviewAwardId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const applyLock=useRef(false)
  useEffect(() => { const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName)); refresh(); setPreviewAwardId(''); setEdit(null); setSelectedStudents([]); setSelectedClass(''); setTypesOpen(false); setEditingType(null); setTypeName(''); setTypeDescription(''); setTypeError(''); setSearch(''); setError(''); const un = subscribeDbHydrated(refresh); window.addEventListener('focus', refresh); return () => { un(); window.removeEventListener('focus', refresh) } }, [activeBranchId, branchName])
  const students = records.studentList ?? []
  const classes = records.classList ?? []
  const classNames = [...new Set(classes.map(c => String(c.name ?? '').trim()).filter(Boolean))].sort()
  const studentClass = (s: EduRow) => {
    const raw = String(s.className ?? '').trim()
    return [...classNames].sort((a, b) => b.length - a.length).find(name => norm(raw) === norm(name) || norm(raw).startsWith(norm(name) + ' ')) ?? raw
  }
  const classOptions = [...new Set([...classNames, ...students.map(studentClass)].filter(Boolean))].sort()
  const visibleStudents = students.filter(s => !selectedClass || norm(studentClass(s)) === norm(selectedClass) || (!!edit?.id && s.id === edit.studentId))
  const years = [...new Set((records.academicYear ?? []).map(y => String(y.name ?? '').trim()).filter(Boolean))].sort()
  const terms = [...new Set((records.termSemester ?? []).filter(t => norm(t.academicYear) === norm(edit?.session)).map(t => String(t.name ?? '').trim()).filter(Boolean))].sort()
  const scholarshipTypes = records.scholarshipTypes ?? []
  const feeTypes = records.feeTypes ?? []
  const rows = (records.scholarships ?? []).filter(r => `${r.student} ${r.type} ${r.session} ${r.term ?? ''} ${r.status ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const saveType = () => {
    const name = typeName.trim()
    if (!name) { setTypeError('Enter a scholarship type.'); return }
    const latest = loadEduRecords(activeBranchId, branchName)
    const types = latest.scholarshipTypes ?? []
    const existing = editingType ? types.find(t => t.id === editingType.id) : undefined
    if (editingType && (!existing || (existing.name !== editingType.name || String(existing.description ?? '') !== String(editingType.description ?? '')))) { setTypeError('This type changed or was removed. Close and reopen it before editing.'); setRecords(latest); return }
    if (types.some(t => t.id !== editingType?.id && norm(t.name) === norm(name))) { setTypeError('This scholarship type already exists.'); return }
    const description = typeDescription.trim()
    const type = existing ? { ...existing, name, description } : { id: uid(), name, description }
    const next = { ...latest, scholarshipTypes: existing ? types.map(t => t.id === existing.id ? type : t) : [...types, type], scholarships: existing ? (latest.scholarships ?? []).map(r => r.scholarshipTypeId === existing.id ? { ...r, type: name } : r) : (latest.scholarships ?? []) }
    saveEduRecords(activeBranchId, next); setRecords(next); setEditingType(null); setTypeName(''); setTypeDescription(''); setTypeError(''); toast(existing ? 'Scholarship type updated' : 'Scholarship type saved', 'success')
  }
  const deleteType = async (type: EduRow) => {
    const first = loadEduRecords(activeBranchId, branchName)
    const current = (first.scholarshipTypes ?? []).find(t => t.id === type.id)
    if (!current) { setRecords(first); setTypeError('This scholarship type no longer exists.'); return }
    const linked = (first.scholarships ?? []).filter(r => r.scholarshipTypeId === type.id).length
    const answer = await Swal.fire({ title: 'Delete scholarship type?', text: `Delete “${current.name}”? ${linked ? `${linked} linked scholarship record(s) will keep the type name as a legacy value.` : 'Existing scholarship records will not be deleted.'}`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete Type', confirmButtonColor: '#dc2626' })
    if (!answer.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName)
    const actual = (latest.scholarshipTypes ?? []).find(t => t.id === type.id)
    const linkedNow = (latest.scholarships ?? []).filter(r => r.scholarshipTypeId === type.id).length
    if (!actual || actual.name !== current.name || String(actual.description ?? '') !== String(current.description ?? '') || linkedNow !== linked) { setRecords(latest); setTypeError('The type or its linked records changed. Review and try again.'); return }
    const next = { ...latest, scholarshipTypes: (latest.scholarshipTypes ?? []).filter(t => t.id !== type.id), scholarships: (latest.scholarships ?? []).map(r => r.scholarshipTypeId === type.id ? { ...r, scholarshipTypeId: '', type: r.type || current.name } : r) }
    saveEduRecords(activeBranchId, next); setRecords(next); if (editingType?.id === type.id) { setEditingType(null); setTypeName(''); setTypeDescription('') }; setTypeError(''); toast('Scholarship type deleted', 'info')
  }
  const startEdit = (r: EduRow) => { const matches = students.filter(s => norm(s.name) === norm(r.student)); const id = r.studentId || (matches.length === 1 ? matches[0].id : ''); setSelectedStudents(id ? [id] : []); setSelectedClass(id ? studentClass(students.find(s => s.id === id) ?? { id }) : ''); setEdit({ ...r, studentId: id, type: r.type || '', amount: r.amount || '', session: r.session || '', status: r.status || '', term: r.term || '', remarks: r.remarks || '' }); setError('') }
  const change = (key: string, value: string) => setEdit(prev => prev ? { ...prev, [key]: value } : prev)
  const save = () => {
    if (!edit || saving) return
    const latest = loadEduRecords(activeBranchId, branchName)
    if(edit.id && (latest.scholarshipPostings ?? []).some(p=>p.awardId===edit.id && p.status==='Posted')) {setError('Applied awards cannot be edited. Review the credit before making changes.');return}
    const chosen = (latest.studentList ?? []).filter(s => selectedStudents.includes(s.id))
    if (!selectedStudents.length || chosen.length !== selectedStudents.length || !edit.type.trim()) { setError('Select available students and a scholarship type.'); return }
    if (edit.id && edit.studentId && !selectedStudents.includes(edit.studentId)) { setError('Keep the original student selected when editing an existing award.'); return }
    const matchedType = (latest.scholarshipTypes ?? []).find(t => t.id === edit.scholarshipTypeId && t.name === edit.type)
    const prior = edit.id ? (latest.scholarships ?? []).find(r => r.id === edit.id) : undefined
    if (!matchedType && !(prior && !prior.scholarshipTypeId && prior.type === edit.type)) { setError('Select an available scholarship type.'); return }
    if (!/^\d+(?:\.\d{1,2})?$/.test(edit.amount.trim()) || Number(edit.amount) <= 0 || !Number.isSafeInteger(Math.round(Number(edit.amount) * 100))) { setError('Enter an amount greater than zero with up to two decimal places.'); return }
    if (selectedFeeIds(edit.eligibleFeeTypes).some(id => !(latest.feeTypes ?? []).some(t => t.id === id))) { setError('A selected fee type no longer exists. Review eligible fees.'); return }
    if (edit.session && !(latest.academicYear ?? []).some(y => y.name === edit.session)) { setError('The selected academic year is no longer available.'); return }
    if (edit.term && !(latest.termSemester ?? []).some(t => t.name === edit.term && t.academicYear === edit.session)) { setError('The selected term is no longer available.'); return }
    if (edit.id && !(latest.scholarships ?? []).some(r => r.id === edit.id)) { setError('This scholarship no longer exists.'); setRecords(latest); return }
    const owner = edit.id && edit.studentId ? chosen.find(s => s.id === edit.studentId)! : chosen[0]
    const makeRow = (student: EduRow, id: string): EduRow => ({ ...edit, id, studentId: student.id, student: student.name, admissionNo: student.admissionNo ?? '', type: edit.type.trim(), amount: Number(edit.amount).toFixed(2), remarks: edit.remarks.trim() })
    const current = latest.scholarships ?? []
    const extras = edit.id ? chosen.filter(s => s.id !== owner.id).map(s => makeRow(s, uid())) : chosen.map(s => makeRow(s, uid()))
    const next = { ...latest, scholarships: edit.id ? [...extras, ...current.map(r => r.id === edit.id ? makeRow(owner, edit.id) : r)] : [...extras, ...current] }
    saveEduRecords(activeBranchId, next); setRecords(next); setEdit(null); setSelectedStudents([]); setError(''); toast(`${chosen.length} scholarship record(s) saved`, 'success')
  }
  const remove = async (r: EduRow) => {
    if (saving) return
    if ((loadEduRecords(activeBranchId,branchName).scholarshipPostings ?? []).some(p=>p.awardId===r.id && p.status==='Posted')) {toast('Applied awards cannot be deleted; review the credit first','info');return}
    const result = await Swal.fire({ title: 'Delete scholarship?', text: `Delete the scholarship record for ${r.student}? Billing and invoices will not be changed.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' })
    if (!result.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName)
    if ((latest.scholarshipPostings ?? []).some(p=>p.awardId===r.id && p.status==='Posted')) {toast('Award has been applied; deletion blocked','info');return}
    const next = { ...latest, scholarships: (latest.scholarships ?? []).filter(x => x.id !== r.id) }; saveEduRecords(activeBranchId, next); setRecords(next); toast('Scholarship deleted', 'info')
  }
  const applyAward = async () => {
    if(applyLock.current || !previewAwardId)return
    applyLock.current=true;setSaving(true)
    try {
      const before=loadEduRecords(activeBranchId,branchName), award=(before.scholarships??[]).find(a=>a.id===previewAwardId)
      if(!award){await Swal.fire('Review required','The award no longer exists.','warning');return}
      const staged=applyScholarshipBalance(award,before,new Date().toISOString())
      if(!staged.records){await Swal.fire('Review required',staged.error,'warning');setRecords(before);return}
      const confirmed=await Swal.fire({title:'Apply scholarship credit?',text:`Reduce eligible invoice balances by ${award.amount}. This does not create an accounting journal. Browser saves are not atomic and concurrent sessions may cause missing or duplicate credits. Verify the saved invoice and do not retry if sync is uncertain.`,icon:'warning',showCancelButton:true,confirmButtonText:'Apply credit'})
      if(!confirmed.isConfirmed)return
      const latest=loadEduRecords(activeBranchId,branchName), current=(latest.scholarships??[]).find(a=>a.id===previewAwardId)
      if(!current || JSON.stringify(latest)!==JSON.stringify(before)){setRecords(latest);await Swal.fire('Records changed','Review the award and invoice before trying again.','warning');return}
      const next=applyScholarshipBalance(current,latest,new Date().toISOString())
      if(!next.records){await Swal.fire('Review required',next.error,'warning');return}
      saveEduRecords(activeBranchId,next.records);const saved=loadEduRecords(activeBranchId,branchName)
      const found=consistentScholarshipAward(current,saved.studentBilling??[],saved.scholarshipPostings??[],saved.scholarshipAllocations??[])
      const synced=found && await flushEducationBeforeNotification()
      setRecords(saved)
      if(!synced){await Swal.fire('Credit save not confirmed','Do not apply the award again. Verify the invoice and database sync first; a partial or lost save is possible.','warning');return}
      await Swal.fire('Scholarship credit requested','The invoice balance was reduced in this browser. Verify the saved invoice after reloading. No accounting journal was created.','info')
    } finally {applyLock.current=false;setSaving(false)}
  }
  const cell = 'border-b border-line px-3 py-2 text-left'
  const previewAward = (records.scholarships ?? []).find(r => r.id === previewAwardId)
  const preview = previewAward ? previewScholarship(previewAward, records) : null
  const postingPlan = previewAward ? planScholarshipPosting(previewAward, records) : null
  const format = (v: number) => (v / 100).toFixed(2)
  if (view === 'renewals') return <div className="space-y-4"><PageHeader title="Scholarship Renewals" desc="Review annual or term renewals" /><Button variant="outline" onClick={() => setView('awards')}>Back to Awards</Button><ScholarshipRenewals /></div>
  if (view === 'applications') return <div className="space-y-4"><PageHeader title="Scholarship Applications" desc="Manage applications and evaluations" /><Button variant="outline" onClick={() => setView('awards')}>Back to Awards</Button><ScholarshipApplications /></div>
  if (view === 'setup') return <div className="space-y-4"><PageHeader title="Scholarships" desc="Scheme and sponsor configuration" /><Button variant="outline" onClick={() => setView('awards')}>Back to Awards</Button><ScholarshipSetup /></div>
  return <div className="space-y-4"><PageHeader title="Scholarships" desc="Manage student scholarship awards" /><div className="grid gap-3 sm:grid-cols-3">{[["Active award records", String((records.scholarships ?? []).filter(r => r.status === 'Active').length)], ["Applications awaiting review", String((records.scholarshipApplications ?? []).filter(r => r.status === 'Submitted' || r.status === 'Under Review').length)], ["Approved applications", String((records.scholarshipApplications ?? []).filter(r => r.status === 'Approved').length)]].map(([label,value]) => <div key={label} className="rounded-xl border border-line bg-surface p-4"><div className="text-sm text-mist">{label}</div><strong className="text-2xl">{value}</strong></div>)}</div><section className="rounded-xl border border-line bg-surface p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Scholarship List</h2><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setTypesOpen(true); setEditingType(null); setTypeName(''); setTypeDescription(''); setTypeError('') }}>Scholarship Types</Button><Button variant="outline" onClick={() => setView('setup')}>Schemes & Sponsors</Button><Button variant="outline" onClick={() => setView('applications')}>Applications</Button><Button variant="outline" onClick={() => setView('renewals')}>Renewals</Button><Input aria-label="Search scholarships" placeholder="Search scholarships" value={search} onChange={e => setSearch(e.target.value)} /><Button onClick={() => { setSelectedStudents([]); setSelectedClass(''); setEdit(blank()); setError('') }}>Add Scholarship</Button></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['S/N','Student','Register No','Scholarship Type','Amount','Academic Year','Term / Semester','Status','Actions'].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{rows.map((r, index) => <tr key={r.id}><td className={cell}>{index + 1}</td><td className={cell}>{r.student}</td><td className={cell}>{r.admissionNo || '—'}</td><td className={cell}>{r.type || '—'}</td><td className={cell}>{r.amount || '—'}</td><td className={cell}>{r.session || '—'}</td><td className={cell}>{r.term || '—'}</td><td className={cell}>{r.status || 'Not specified'}</td><td className={cell}><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPreviewAwardId(r.id)}>Preview Fees</Button><Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void remove(r)}>Delete</Button></div></td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-mist">No scholarships found.</p>}</div><p className="mt-3 text-xs text-mist">Open Preview Fees to review and apply an eligible award to the invoice. Browser-based saves are not atomic; verify the result. No accounting journal is created.</p></section>
  <Modal open={!!previewAwardId} onClose={() => setPreviewAwardId('')} title="Scholarship Billing Preview" maxWidth="3xl">{preview && previewAward && <div className="space-y-4"><p className="text-sm text-mist">Review for {previewAward.student}. No deduction is saved until you apply it. Payments are considered first. Existing adjustments and overlapping awards require review. Eligible fees are ordered by due date, then record ID.</p>{postingPlan?.state === 'already-posted' ? <p className="text-sm">This award is already applied. Review the student invoice for the net balance.</p> : preview.state === 'review' ? <div role="alert" className="rounded border border-amber-500 p-3 text-sm"><strong>Review required</strong><ul className="list-disc pl-5">{preview.reasons.map(r => <li key={r}>{r}</li>)}</ul></div> : <><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Fee item','Due date','Outstanding','Estimated deduction','Estimated balance'].map(x => <th className={cell} key={x}>{x}</th>)}</tr></thead><tbody>{preview.lines.map(line => <tr key={line.billId}><td className={cell}>{line.fee}</td><td className={cell}>{line.dueDate || '—'}</td><td className={cell}>{format(line.balanceCents)}</td><td className={cell}>{format(line.deductionCents)}</td><td className={cell}>{format(line.balanceCents - line.deductionCents)}</td></tr>)}</tbody></table>{!preview.lines.length && <p className="p-3 text-sm text-mist">No eligible billing items in this period.</p>}</div><p className="text-sm">Potential same-period credit: <strong>{format(preview.creditCents)}</strong> (not created)</p></>}<div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>Scholarship credit</strong><p>Apply credits to eligible invoice balances only. No accounting journal is created. Saves are browser-coordinated and not atomic.</p>{postingPlan?.state === 'review' && <ul className="list-disc pl-5">{postingPlan.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{postingPlan?.state === 'already-posted' && <p>This award has an applied credit. Verify the invoice before making changes.</p>}{postingPlan?.state === 'ready' && postingPlan.unappliedCreditCents>0 && <p>Unapplied award value requires review; application is blocked.</p>}{postingPlan?.state === 'ready' && postingPlan.unappliedCreditCents===0 && postingPlan.allocations.length>0 && <Button disabled={saving} onClick={()=>void applyAward()}>Apply to invoice</Button>}</div><div className="flex justify-end"><Button variant="outline" onClick={() => setPreviewAwardId('')}>Close</Button></div></div>}</Modal>
  <Modal open={typesOpen} onClose={() => setTypesOpen(false)} title="Scholarship Types" maxWidth="2xl"><div className="space-y-4"><p className="text-sm text-mist">Add scholarship types for use when creating or editing awards.</p><div className="flex flex-wrap items-end gap-2"><div className="min-w-[200px] flex-1"><Field label="Scholarship Type" required><Input value={typeName} onChange={e => setTypeName(e.target.value)} placeholder="e.g. Merit scholarship" /></Field></div><Field label="Description"><Textarea rows={2} value={typeDescription} onChange={e => setTypeDescription(e.target.value)} placeholder="Optional description" /></Field><Button onClick={saveType}>{editingType ? 'Update Type' : 'Save Type'}</Button>{editingType && <Button variant="outline" onClick={() => { setEditingType(null); setTypeName(''); setTypeDescription(''); setTypeError('') }}>Cancel Edit</Button>}</div>{typeError && <p role="alert" className="text-sm text-red-600">{typeError}</p>}<div className="rounded-lg border border-line">{scholarshipTypes.length ? scholarshipTypes.map(t => <div key={t.id} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 last:border-b-0"><div><span>{t.name}</span>{t.description && <p className="text-xs text-mist">{t.description}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingType({ ...t }); setTypeName(t.name); setTypeDescription(t.description || ''); setTypeError('') }}>Edit</Button><Button size="sm" variant="outline" onClick={() => void deleteType(t)}>Delete</Button></div></div>) : <p className="p-3 text-sm text-mist">No scholarship types yet.</p>}</div><div className="flex justify-end"><Button variant="outline" onClick={() => setTypesOpen(false)}>Close</Button></div></div></Modal>
  <Modal open={!!edit} onClose={() => { if (!saving) setEdit(null) }} title={edit?.id ? 'Edit Scholarship' : 'Add Scholarship'} maxWidth="2xl">{edit && <div className="space-y-4"><Field label="Class"><Select value={selectedClass} onChange={e => { const next = e.target.value; setSelectedClass(next); setSelectedStudents(prev => prev.filter(id => { const student = students.find(s => s.id === id); return !!student && (!next || norm(studentClass(student)) === norm(next) || (!!edit.id && id === edit.studentId)) })) }}><option value="">All classes</option>{classOptions.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Students" required><MultiSelect aria-label="Students" values={selectedStudents} options={visibleStudents.map(s => ({ value: s.id, label: `${s.name}${s.admissionNo ? ` (${s.admissionNo})` : ''}${selectedClass && norm(studentClass(s)) !== norm(selectedClass) ? ' — original award student' : ''}` }))} onChange={setSelectedStudents} placeholder="Select students" /></Field><p className="text-xs text-mist">{edit.id ? 'Keep the original student selected. Additional students receive new individual records; existing records for other students are not changed.' : 'A separate scholarship record with these details is created for each selected student.'}</p>{edit.id && !edit.studentId && <p className="text-xs text-amber-600">Select the correct student to link this older record.</p>}<Field label="Scholarship Type" required><Select value={edit.scholarshipTypeId || (edit.type ? '__legacy__' : '')} onChange={e => { const type = scholarshipTypes.find(t => t.id === e.target.value); setEdit({ ...edit, scholarshipTypeId: type?.id || '', type: type?.name || '' }) }}><option value="">Select scholarship type</option>{!edit.scholarshipTypeId && edit.type && <option value="__legacy__">{edit.type} (legacy)</option>}{edit.scholarshipTypeId && !scholarshipTypes.some(t => t.id === edit.scholarshipTypeId) && <option value={edit.scholarshipTypeId}>{edit.type} (unavailable)</option>}{scholarshipTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field><Field label="Eligible Fee Types"><MultiSelect aria-label="Eligible Fee Types" values={selectedFeeIds(edit.eligibleFeeTypes)} options={feeTypes.map(t => ({ value: t.id, label: t.name }))} onChange={ids => change('eligibleFeeTypes', JSON.stringify(ids))} placeholder="Select eligible fee types" /></Field><p className="text-xs text-mist">Select eligible fee types, then use Preview Fees to review and apply the award to billing.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Amount" required><Input type="number" min="0.01" step="0.01" value={edit.amount} onChange={e => change('amount', e.target.value)} /></Field><Field label="Status"><Select value={edit.status} onChange={e => change('status', e.target.value)}><option value="">Not specified</option><option>Active</option><option>Pending</option><option>Completed</option><option>Cancelled</option></Select></Field><Field label="Academic Year"><Select value={edit.session} onChange={e => setEdit({ ...edit, session: e.target.value, term: '' })}><option value="">Not specified</option>{edit.session && !years.includes(edit.session) && <option value={edit.session}>{edit.session} (unavailable)</option>}{years.map(y => <option key={y}>{y}</option>)}</Select></Field><Field label="Term / Semester"><Select value={edit.term} disabled={!edit.session} onChange={e => change('term', e.target.value)}><option value="">Not specified</option>{edit.term && !terms.includes(edit.term) && <option value={edit.term}>{edit.term} (unavailable)</option>}{terms.map(t => <option key={t}>{t}</option>)}</Select></Field></div><Field label="Remarks"><Textarea rows={3} value={edit.remarks} onChange={e => change('remarks', e.target.value)} /></Field>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save Scholarship</Button></div></div>}</Modal></div>
}
