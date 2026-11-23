import { consistentScholarshipAward, isNonDeductingSample } from '../../../lib/scholarshipBalanceApply'
import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { Button, Field, MultiSelect, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { uid } from '../../../lib/utils'

type Item = { feeTypeId: string; name: string; dueDate: string; amount: string }
function itemsFor(group?: EduRow): Item[] {
  try { const v = JSON.parse(String(group?.itemsJson ?? '[]')); return Array.isArray(v) ? v.map(i => ({ feeTypeId: String(i?.feeTypeId ?? ''), name: String(i?.name ?? ''), dueDate: String(i?.dueDate ?? ''), amount: String(i?.amount ?? '') })) : [] } catch { return [] }
}
const norm = (x: unknown) => String(x ?? '').trim().toLowerCase()
const cleanSection = (x: unknown) => String(x ?? '').trim().replace(/^section\s+/i, '')
function studentClassAndSection(student: EduRow, classes: EduRow[]) {
  const raw = String(student.className ?? '').trim()
  const possible = classes.map(c => String(c.name ?? '').trim()).filter(Boolean).sort((a, b) => b.length - a.length)
  const className = possible.find(n => norm(raw) === norm(n) || norm(raw).startsWith(norm(n) + ' ')) ?? raw
  const suffix = raw.slice(className.length).trim()
  const classRecord = classes.find(c => norm(c.name) === norm(className) && norm(c.section) === norm(suffix))
  return { className, section: cleanSection(suffix || student.section || classRecord?.section || '') }
}
type BillingPeriod = { groupId: string; academicYear: string; term: string }
function allocationStatus(bills: EduRow[], student: EduRow, period: BillingPeriod | null): 'assigned' | 'review' | 'available' {
  if (!period) return 'available'
  const matching = bills.filter(b => String(b.feeGroupId ?? '') === period.groupId && (String(b.studentId ?? '') === student.id || (student.admissionNo && norm(b.admissionNo) === norm(student.admissionNo))))
  if (matching.some(b => norm(b.academicYear) === norm(period.academicYear) && norm(b.term) === norm(period.term))) return 'assigned'
  if (matching.some(b => !norm(b.academicYear) || !norm(b.term))) return 'review'
  return 'available'
}
export function StudentBillingAllocation({ records, branchId, branchName, onChanged }: { records: EduRecords; branchId: string; branchName: string; onChanged: (records: EduRecords) => void }) {
  const toast = useToast()
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [groupId, setGroupId] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [selectedTerms, setSelectedTerms] = useState<string[]>([])
  const [applied, setApplied] = useState<{ className: string; section: string; groupId: string; academicYear: string; terms: string[] } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setClassName(''); setSection(''); setGroupId(''); setAcademicYear(''); setSelectedTerms([]); setApplied(null); setSelected([]); setError('') }, [branchId])
  const classes = records.classList ?? []
  const students = records.studentList ?? []
  const groupRows = records.feeGroups ?? []
  const years = [...new Set((records.academicYear ?? []).map(y => String(y.name ?? '').trim()).filter(Boolean))].sort()
  const terms = [...new Set((records.termSemester ?? []).filter(t => norm(t.academicYear) === norm(academicYear)).map(t => String(t.name ?? '').trim()).filter(Boolean))].sort()
  const classNames = [...new Set([...classes.map(c => String(c.name ?? '').trim()), ...students.map(s => studentClassAndSection(s, classes).className)].filter(Boolean))].sort()
  const sections = [...new Set([...classes.filter(c => norm(c.name) === norm(className)).map(c => cleanSection(c.section)), ...students.map(s => studentClassAndSection(s, classes)).filter(v => norm(v.className) === norm(className)).map(v => v.section)].filter(Boolean))].sort()
  const visible = useMemo(() => applied ? students.filter(s => { const cs = studentClassAndSection(s, classes); return norm(cs.className) === norm(applied.className) && (applied.section === '__all__' || norm(cs.section) === norm(applied.section)) }) : [], [applied, students, classes])
  const bills = records.studentBilling ?? []
  const statusesFor = (data: EduRow[], s: EduRow, period: typeof applied) => period ? period.terms.map(term => ({ term, status: allocationStatus(data, s, { ...period, term }) })) : []
  const groupStatus = (data: EduRow[], s: EduRow, period: typeof applied): 'assigned' | 'review' | 'available' => {
    const states = statusesFor(data, s, period).map(x => x.status)
    return states.length && states.every(x => x === 'assigned') ? 'assigned' : states.includes('review') ? 'review' : 'available'
  }
  const available = visible.filter(s => groupStatus(bills, s, applied) === 'available')
  const registrations = records.studentRegistration ?? []
  const registration = (s: EduRow) => { const a = norm(s.admissionNo); const matches = a ? registrations.filter(r => norm(r.admissionNo) === a) : []; return matches.length === 1 ? matches[0] : undefined }
  const filter = () => { if (!className || !section || !groupId || !academicYear || !selectedTerms.length) { setError('Select an academic year, term/semester, class, section and fee group.'); return }; setError(''); setSelected([]); setApplied({ className, section, groupId, academicYear, terms: [...selectedTerms] }) }
  const save = async () => {
    if (saving || !applied || !selected.length) { setError('Select at least one student to allocate.'); return }
    const latest = loadEduRecords(branchId, branchName)
    if (!applied.terms.every(term => (latest.termSemester ?? []).some(t => norm(t.academicYear) === norm(applied.academicYear) && norm(t.name) === norm(term)))) { setError('The selected academic period is no longer available. Select it again.'); return }
    const group = (latest.feeGroups ?? []).find(g => g.id === applied.groupId)
    const items = itemsFor(group)
    const chosen = (latest.studentList ?? []).filter(s => selected.includes(s.id))
    if (!group || !items.length || items.some(i => !i.feeTypeId || !i.name || !i.dueDate || !i.amount.trim() || !Number.isFinite(Number(i.amount)) || Number(i.amount) < 0)) { setError('The selected fee group needs at least one valid fee item with a due date and amount.'); return }
    if (new Set(items.map(i => i.feeTypeId)).size !== items.length) { setError('This fee group contains duplicate fee items. Review it before allocating.'); return }
    if (chosen.length !== selected.length || chosen.some(s => { const cs = studentClassAndSection(s, latest.classList ?? []); return norm(cs.className) !== norm(applied.className) || (applied.section !== '__all__' && norm(cs.section) !== norm(applied.section)) })) { setError('Student records changed. Filter and select students again.'); return }
    const invalid = chosen.filter(s => groupStatus(latest.studentBilling ?? [], s, applied) !== 'available')
    if (invalid.length) { setError(`Already allocated in all selected periods or missing an existing allocation period: ${invalid.map(s => s.name).join(', ')}. Review before continuing.`); onChanged(latest); return }
    const pending = chosen.flatMap(s => statusesFor(latest.studentBilling ?? [], s, applied).filter(x => x.status === 'available').map(x => ({ student: s, term: x.term })))
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0)
    setSaving(true)
    try {
      const confirm = await Swal.fire({ title: 'Allocate fees?', text: `Create ${pending.length * items.length} unpaid item(s) across ${pending.length} student-period allocation(s) for ${applied.academicYear}: ${applied.terms.join(', ')}. Total: ${(pending.length * total).toFixed(2)}. Each period uses the fee group's existing due dates. Already assigned periods are skipped.`, icon: 'question', showCancelButton: true, confirmButtonText: 'Allocate' })
      if (!confirm.isConfirmed) return
      const current = loadEduRecords(branchId, branchName)
      const pendingNow = chosen.flatMap(s => statusesFor(current.studentBilling ?? [], s, applied).filter(x => x.status === 'available').map(x => `${s.id}::${x.term}`))
      if (chosen.some(s => groupStatus(current.studentBilling ?? [], s, applied) !== 'available') || JSON.stringify(pendingNow) !== JSON.stringify(pending.map(x => `${x.student.id}::${x.term}`))) { setError('An allocation changed while you were reviewing. Refresh and try again.'); onChanged(current); return }
      if (JSON.stringify(itemsFor((current.feeGroups ?? []).find(g => g.id === group.id))) !== JSON.stringify(items)) { setError('The fee group changed. Filter and try again.'); onChanged(current); return }
      if (!applied.terms.every(term => (current.termSemester ?? []).some(t => norm(t.academicYear) === norm(applied.academicYear) && norm(t.name) === norm(term)))) { setError('The academic period changed. Filter and try again.'); onChanged(current); return }
      const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const added: EduRow[] = pending.flatMap(({ student: s, term }) => items.map(item => ({ id: uid(), studentId: s.id, admissionNo: String(s.admissionNo ?? ''), student: String(s.name ?? ''), className: String(s.className ?? ''), billingDate: today, academicYear: applied.academicYear, term, dueDate: item.dueDate, amount: Number(item.amount).toFixed(2), status: 'Unpaid', feeType: item.name, feeTypeId: item.feeTypeId, feeGroupId: group.id, feeGroupName: String(group.name ?? ''), reference: `FG:${uid()}`, allocationSource: 'feesGroup' })))
      const next = { ...current, studentBilling: [...added, ...(current.studentBilling ?? [])] }
      saveEduRecords(branchId, next); onChanged(next); setSelected([]); setError(''); toast.success('Fees allocated', `${pending.length} student-period allocation(s), ${added.length} unpaid billing item(s)`)
    } finally { setSaving(false) }
  }
  const cell = 'border-b border-line px-3 py-2 text-left'
  return <div className="mb-5 space-y-4">
    <section className="rounded-xl border border-line bg-surface p-4"><h2 className="mb-3 font-semibold">Select Group</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"><Field label="Branch"><div className="field flex items-center">{branchName || 'Current branch'}</div></Field><Field label="Academic Year" required><Select value={academicYear} onChange={e => { setAcademicYear(e.target.value); setSelectedTerms([]); setApplied(null); setSelected([]) }}><option value="">Select academic year</option>{years.map(y => <option key={y}>{y}</option>)}</Select></Field><Field label="Term / Semester" required><MultiSelect aria-label="Term / Semester" values={selectedTerms} options={terms.map(t => ({ value: t, label: t }))} disabled={!academicYear} placeholder="Select terms / semesters" onChange={values => { setSelectedTerms(values); setApplied(null); setSelected([]) }} /></Field><Field label="Class" required><Select value={className} onChange={e => { setClassName(e.target.value); setSection(''); setApplied(null); setSelected([]) }}><option value="">Select class</option>{classNames.map(c => <option key={c}>{c}</option>)}</Select></Field><Field label="Section" required><Select value={section} disabled={!className} onChange={e => { setSection(e.target.value); setApplied(null); setSelected([]) }}><option value="">Select section</option><option value="__all__">All Sections</option>{sections.map(s => <option key={s}>{s}</option>)}</Select></Field><Field label="Fee Group" required><Select value={groupId} onChange={e => { setGroupId(e.target.value); setApplied(null); setSelected([]) }}><option value="">Select fee group</option>{groupRows.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field></div><div className="mt-3 flex justify-end"><Button type="button" onClick={filter}>Filter</Button></div></section>
    {applied && <section className="rounded-xl border border-line bg-surface p-4"><h2 className="mb-3 font-semibold">Student List</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className={cell}><input type="checkbox" aria-label="Select all eligible students" checked={visible.length > 0 && visible.every(s => groupStatus(bills, s, applied) === 'assigned' || selected.includes(s.id))} disabled={!available.length} onChange={e => setSelected(e.target.checked ? available.map(s => s.id) : [])} /></th>{['Sl','Name','Register No','Roll','Gender','Mobile No','Email','Guardian Name','Scholarship','Allocation'].map(x => <th key={x} className={cell}>{x}</th>)}</tr></thead><tbody>{visible.map((s, i) => { const reg = registration(s); const status = groupStatus(bills, s, applied); const assignedTerms = statusesFor(bills, s, applied).filter(x => x.status === 'assigned').map(x => x.term); const allocated = status === 'assigned'; const awards = (records.scholarships ?? []).filter(a => a.studentId === s.id && norm(a.status) === 'active' && norm(a.session) === norm(applied.academicYear) && (!a.term || applied.terms.some(t => norm(t) === norm(a.term)))); return <tr key={s.id}><td className={cell}><input type="checkbox" aria-label={`Select ${s.name}`} checked={allocated || selected.includes(s.id)} disabled={status !== 'available'} onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))} /></td><td className={cell}>{i+1}</td><td className={cell}>{s.name}</td><td className={cell}>{s.admissionNo || '—'}</td><td className={cell}>{s.rollNo || reg?.rollNo || '—'}</td><td className={cell}>{s.gender || reg?.gender || '—'}</td><td className={cell}>{s.phone || reg?.phone || '—'}</td><td className={cell}>{s.email || reg?.email || '—'}</td><td className={cell}>{s.guardian || reg?.guardian || '—'}</td><td className={cell}>{awards.length ? awards.map(a => <div key={a.id}>{a.type || 'Scholarship'} · {a.term || 'Annual'} — {isNonDeductingSample(a) ? 'illustrative, no deduction' : consistentScholarshipAward(a,records.studentBilling ?? [],records.scholarshipPostings ?? [],records.scholarshipAllocations ?? []) ? 'applied' : 'not applied'}</div>) : '—'}</td><td className={cell}>{allocated ? `${groupRows.find(g => g.id === applied.groupId)?.name ?? 'Fee group'} — assigned` : status === 'review' ? 'Existing assignment has no period — review' : assignedTerms.length ? `Already assigned: ${assignedTerms.join(', ')}; remaining periods available` : 'Not assigned'}</td></tr> })}</tbody></table>{!visible.length && <p className="p-4 text-sm text-mist">No students match this class and section.</p>}</div><div className="mt-3 flex justify-end"><Button type="button" disabled={saving || !selected.length} onClick={() => void save()}>Save Allocation</Button></div></section>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <p className="text-xs text-mist">Allocations apply separately to each selected term/semester. Already assigned periods are skipped; students assigned in all selected periods remain checked. The same group due dates are used for every selected period. Existing assignments without a period require review before allocating. Scholarship credits are applied from Scholarships → Preview Fees, not when assigning a fee group. Fines and discounts are not applied automatically.</p>
  </div>
}
