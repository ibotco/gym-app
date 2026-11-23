import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { Button, Field, Modal, PageHeader, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'
import { carryForwardClassOptions, carryForwardInClass, carryForwardMatchesPeriod } from '../../../lib/carryForwardClass'

function balance(b: EduRow): number | null {
  const amount = String(b.amount ?? '').trim(), paid = String(b.amountPaid ?? '').trim(), status = String(b.status ?? '').trim().toLowerCase()
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null
  const toCents = (v: string) => { const [a, f = ''] = v.split('.'); return Number(a) * 100 + Number(f.padEnd(2, '0')) }
  const total = toCents(amount)
  if (!Number.isSafeInteger(total)) return null
  if (paid) { if (!/^\d+(?:\.\d{1,2})?$/.test(paid)) return null; const n = toCents(paid); if (!Number.isSafeInteger(n) || n > total || (status === 'paid' && n !== total)) return null; return total - n }
  if (status === 'paid') return 0
  if (status === 'partial' || status === 'partly paid' || (status && status !== 'unpaid')) return null
  return total
}
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
export function FeesCarryForwardPage() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find(b => b.id === activeBranchId)?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [open, setOpen] = useState(false)
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [className, setClassName] = useState('')
  const [listClass, setListClass] = useState('')
  const [listYear, setListYear] = useState('')
  const [listTerm, setListTerm] = useState('')
  const [year, setYear] = useState('')
  const [term, setTerm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName)); refresh(); setOpen(false); setSelectedBillIds([]); setSearch(''); setClassName(''); setListClass(''); setListYear(''); setListTerm(''); setYear(''); setTerm(''); setError(''); const un = subscribeDbHydrated(refresh); window.addEventListener('focus', refresh); return () => { un(); window.removeEventListener('focus', refresh) } }, [activeBranchId, branchName])
  const students = records.studentList ?? []
  const classes = records.classList ?? []
  const classOptions = carryForwardClassOptions(students, classes)
  const belongs = (b: EduRow, s: EduRow) => b.studentId ? b.studentId === s.id : !!s.admissionNo && norm(b.admissionNo) === norm(s.admissionNo)
  // An item must resolve to exactly one student before it can be moved.
  const candidates = (records.studentBilling ?? []).flatMap(b => {
    const matches = students.filter(s => belongs(b, s))
    return matches.length === 1 && !b.scholarshipPostingId && !!b.feeGroupId && (balance(b) ?? 0) > 0 && !!b.academicYear && !!b.term ? [{ bill: b, student: matches[0] }] : []
  })
  const visible = candidates.filter(({bill, student}) => carryForwardInClass(student, classes, className) && norm([student.name, student.admissionNo, student.className, bill.feeType, bill.feeGroupName].join(' ')).includes(norm(search)))
  const selected = candidates.filter(({bill}) => selectedBillIds.includes(bill.id))
  const years = [...new Set((records.academicYear ?? []).map(y => String(y.name ?? '').trim()).filter(Boolean))].sort()
  const terms = [...new Set((records.termSemester ?? []).filter(t => norm(t.academicYear) === norm(year)).map(t => String(t.name ?? '').trim()).filter(Boolean))].sort()
  const history = records.feesCarryForward ?? []
  const listYears = [...new Set([...years, ...history.flatMap(r => [r.fromSession, r.toSession].map(v => String(v ?? '').trim()))].filter(Boolean))].sort()
  const listTerms = [...new Set([...(records.termSemester ?? []).filter(t => !listYear || norm(t.academicYear) === norm(listYear)).map(t => String(t.name ?? '').trim()), ...history.flatMap(r => [[r.fromSession, r.fromTerm], [r.toSession, r.toTerm]].filter(([y]) => !listYear || norm(y) === norm(listYear)).map(([,t]) => String(t ?? '').trim()))].filter(Boolean))].sort()
  const filteredHistory = history.filter(r => {
    if (!carryForwardMatchesPeriod(r, listYear, listTerm)) return false
    if (!listClass) return true
    const matched = students.filter(student => student.id === r.studentId)
    return matched.length === 1 && carryForwardInClass(matched[0], classes, listClass)
  })
  const close = () => { if (!saving) { setOpen(false); setError('') } }
  const save = async () => {
    if (saving || !selectedBillIds.length || selected.length !== selectedBillIds.length || !year || !term) { setError('Select one or more outstanding fee items and a destination academic year and term.'); return }
    if (selected.some(({bill}) => norm(bill.academicYear) === norm(year) && norm(bill.term) === norm(term))) { setError('A selected fee is already in the destination period. Deselect it or choose a different destination.'); return }
    const total = selected.reduce((sum, {bill}) => sum + (balance(bill) ?? 0), 0)
    const studentCount = new Set(selected.map(({student}) => student.id)).size
    setSaving(true)
    try {
      const result = await Swal.fire({ title: 'Carry forward selected fees?', text: `Move ${selected.length} fee item(s) for ${studentCount} student(s) (${className ? `class ${className}` : 'all classes selection'}), with a combined outstanding balance of ${(total/100).toFixed(2)}, to ${year} / ${term}. Payment history remains linked and due dates stay unchanged.`, icon: 'question', showCancelButton: true, confirmButtonText: 'Carry forward' })
      if (!result.isConfirmed) return
      const latest = loadEduRecords(activeBranchId, branchName)
      if (!(latest.termSemester ?? []).some(t => norm(t.academicYear) === norm(year) && norm(t.name) === norm(term))) { setError('The destination changed. Review the form and try again.'); setRecords(latest); return }
      const moves: {bill: EduRow; student: EduRow; owed: number}[] = []
      for (const chosen of selected) {
        const actual = (latest.studentBilling ?? []).find(b => b.id === chosen.bill.id)
        const matches = actual ? (latest.studentList ?? []).filter(s => belongs(actual, s)) : []
        const owed = actual ? balance(actual) : null
        if (!actual || !!actual.scholarshipPostingId || matches.length !== 1 || matches[0].id !== chosen.student.id || !actual.feeGroupId || owed === null || owed <= 0 || owed !== balance(chosen.bill) || norm(actual.academicYear) !== norm(chosen.bill.academicYear) || norm(actual.term) !== norm(chosen.bill.term) || String(actual.carryForwardId ?? '') !== String(chosen.bill.carryForwardId ?? '')) {
          setError('A selected fee or student changed. No fees were moved; review the selection and try again.'); setRecords(latest); return
        }
        moves.push({bill: actual, student: matches[0], owed})
      }
      const events: EduRow[] = moves.map(({bill, student, owed}) => ({ id: uid(), studentId: student.id, student: student.name, billingId: bill.id, feeGroupId: bill.feeGroupId, feeGroupName: bill.feeGroupName ?? '', feeType: bill.feeType ?? '', fromSession: bill.academicYear, fromTerm: bill.term, toSession: year, toTerm: term, amount: (owed/100).toFixed(2), status: 'Carried', previousCarryId: String(bill.carryForwardId ?? ''), paymentIdsJson: JSON.stringify((latest.feesInvoicePayments ?? []).filter(p => p.billingId === bill.id).map(p => p.id)), carriedAt: new Date().toISOString() }))
      const byBill = new Map(events.map(event => [event.billingId, event]))
      const next = { ...latest, studentBilling: (latest.studentBilling ?? []).map(b => byBill.has(b.id) ? { ...b, academicYear: year, term, carryForwardId: byBill.get(b.id)!.id } : b), feesCarryForward: [...events, ...(latest.feesCarryForward ?? [])] }
      saveEduRecords(activeBranchId, next); setRecords(next); setOpen(false); setSelectedBillIds([]); setSearch(''); setClassName(''); setYear(''); setTerm(''); setError(''); toast(`${events.length} fee item(s) carried forward`, 'success')
    } finally { setSaving(false) }
  }
  const undo = async (entry: EduRow, remove: boolean) => {
    if (saving) return
    if (entry.status === 'Reversed' && remove) {
      const answer = await Swal.fire({ title: 'Delete reversed record?', text: 'This removes the reversed record without changing the fee item.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete record' })
      if (!answer.isConfirmed) return
      const latest = loadEduRecords(activeBranchId, branchName)
      if (!(latest.feesCarryForward ?? []).some(r => r.id === entry.id && r.status === 'Reversed')) { toast('The record changed; review it first', 'info'); setRecords(latest); return }
      const next = { ...latest, feesCarryForward: (latest.feesCarryForward ?? []).filter(r => r.id !== entry.id) }; saveEduRecords(activeBranchId, next); setRecords(next); return
    }
    if (!entry.billingId) {
      if (!remove) { toast('This legacy record is not linked to a fee item', 'info'); return }
      const answer = await Swal.fire({ title: 'Delete unlinked record?', text: 'This removes the legacy record only and does not change any billing balance.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete record' })
      if (!answer.isConfirmed) return
      const latest = loadEduRecords(activeBranchId, branchName)
      const next = { ...latest, feesCarryForward: (latest.feesCarryForward ?? []).filter(r => r.id !== entry.id) }; saveEduRecords(activeBranchId, next); setRecords(next); return
    }
    const check = (data: EduRecords): string => {
      const event = (data.feesCarryForward ?? []).find(r => r.id === entry.id)
      const bill = (data.studentBilling ?? []).find(b => b.id === entry.billingId)
      if (!event || event.status !== 'Carried' || !bill || bill.carryForwardId !== event.id || norm(bill.academicYear) !== norm(event.toSession) || norm(bill.term) !== norm(event.toTerm)) return 'This transfer is no longer the current transfer for the fee item. Review the record first.'
      if (!(data.termSemester ?? []).some(t => norm(t.academicYear) === norm(event.fromSession) && norm(t.name) === norm(event.fromTerm))) return 'The original academic period no longer exists. Restore it before reversing.'
      let oldIds: string[]
      try { const p = JSON.parse(event.paymentIdsJson || ''); if (!Array.isArray(p) || p.some((id: unknown) => typeof id !== 'string')) throw Error(); oldIds = p } catch { return 'Payment history at transfer time is unavailable. Review this older record before reversing.' }
      const nowIds = (data.feesInvoicePayments ?? []).filter(p => p.billingId === bill.id).map(p => p.id)
      if (nowIds.length !== oldIds.length || nowIds.some(id => !oldIds.includes(id))) return 'Payments changed after this transfer. Review them before reversing.'
      return ''
    }
    const first = loadEduRecords(activeBranchId, branchName); const problem = check(first)
    if (problem) { toast(problem, 'info'); setRecords(first); return }
    const answer = await Swal.fire({ title: remove ? 'Reverse and delete?' : 'Reverse carry forward?', text: `Move the fee item back to ${entry.fromSession} / ${entry.fromTerm}. ${remove ? 'The carry-forward record will be removed.' : 'The record will remain as Reversed.'}`, icon: 'warning', showCancelButton: true, confirmButtonText: remove ? 'Reverse and delete' : 'Reverse' })
    if (!answer.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName); const changed = check(latest)
    if (changed) { toast(changed, 'info'); setRecords(latest); return }
    const next = { ...latest, studentBilling: (latest.studentBilling ?? []).map(b => b.id === entry.billingId ? { ...b, academicYear: entry.fromSession, term: entry.fromTerm, carryForwardId: entry.previousCarryId || '' } : b), feesCarryForward: remove ? (latest.feesCarryForward ?? []).filter(r => r.id !== entry.id) : (latest.feesCarryForward ?? []).map(r => r.id === entry.id ? { ...r, status: 'Reversed', reversedAt: new Date().toISOString() } : r) }
    saveEduRecords(activeBranchId, next); setRecords(next); toast(remove ? 'Carry forward reversed and deleted' : 'Carry forward reversed', 'success')
  }
  const cell = 'border-b border-line px-3 py-2 text-left'
  return <div className="space-y-4"><PageHeader title="Fees Carry Forward" desc="Move outstanding fee items to another academic period" /><section className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Carry Forward List</h2><Button onClick={() => { setOpen(true); setError('') }}>Add Fees Carry Forward</Button></div><div className="mb-4 grid gap-3 sm:grid-cols-3"><Field label="Class"><Select value={listClass} onChange={e => setListClass(e.target.value)}><option value="">All classes</option>{classOptions.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Academic Year"><Select value={listYear} onChange={e => {setListYear(e.target.value);setListTerm('')}}><option value="">All academic years</option>{listYears.map(y => <option key={y} value={y}>{y}</option>)}</Select></Field><Field label="Term / Semester"><Select value={listTerm} onChange={e => setListTerm(e.target.value)}><option value="">All terms / semesters</option>{listTerms.map(t => <option key={t} value={t}>{t}</option>)}</Select></Field></div><p className="mb-3 text-xs text-mist">Year and term match either the original or destination period. Class uses the student's current class; unlinked records appear only under All classes.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['S/N','Student','Fee Group / Item','From','To','Amount','Status','Action'].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{filteredHistory.map((r, index) => <tr key={r.id}><td className={cell}>{index + 1}</td><td className={cell}>{r.student}</td><td className={cell}>{r.feeGroupName ? `${r.feeGroupName} / ${r.feeType}` : '—'}</td><td className={cell}>{r.fromSession || '—'}{r.fromTerm ? ` / ${r.fromTerm}` : ''}</td><td className={cell}>{r.toSession || '—'}{r.toTerm ? ` / ${r.toTerm}` : ''}</td><td className={cell}>{r.amount || '—'}</td><td className={cell}>{r.billingId ? r.status : `${r.status || 'Legacy'} — unlinked; review`}</td><td className={cell}><div className="flex gap-2">{r.billingId && r.status === 'Carried' && <Button size="sm" variant="outline" onClick={() => void undo(r, false)}>Reverse</Button>}{(r.status === 'Carried' || r.status === 'Reversed' || !r.billingId) && <Button size="sm" variant="outline" onClick={() => void undo(r, true)}>Delete</Button>}</div></td></tr>)}</tbody></table>{!filteredHistory.length && <p className="p-4 text-sm text-mist">No carry-forward records match the filters.</p>}</div><p className="mt-3 text-xs text-mist">Legacy records without a linked fee item are not automatically added to invoices. Transfers move the existing item rather than creating another charge.</p></section>
  <Modal open={open} onClose={close} title="Fees Carry Forward" maxWidth="2xl"><div className="space-y-4"><Field label="Class / Students"><Select value={className} onChange={e => { setClassName(e.target.value); setSelectedBillIds([]); setError('') }}><option value="">All students</option>{classOptions.map(name => <option key={name} value={name}>{name}</option>)}</Select></Field><div><label htmlFor="carry-search" className="mb-1 block text-sm font-medium">Find students or fee items</label><input id="carry-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, admission number, class or fee" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></div><div className="rounded-lg border border-line"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={visible.length > 0 && visible.every(({bill}) => selectedBillIds.includes(bill.id))} onChange={e => setSelectedBillIds(current => e.target.checked ? [...new Set([...current, ...visible.map(({bill}) => bill.id)])] : current.filter(id => !visible.some(({bill}) => bill.id === id)))} /> Select all visible fee items</label><span>{selectedBillIds.length} selected · {new Set(selected.map(({student}) => student.id)).size} students{selectedBillIds.some(id => !visible.some(({bill}) => bill.id === id)) ? ' · includes items hidden by search' : ''}</span></div><div className="max-h-64 overflow-auto">{visible.map(({bill, student}) => <label key={bill.id} className="flex cursor-pointer items-start gap-3 border-b border-line p-3 text-sm last:border-0"><input type="checkbox" checked={selectedBillIds.includes(bill.id)} onChange={e => setSelectedBillIds(current => e.target.checked ? [...current, bill.id] : current.filter(id => id !== bill.id))} /><span><strong>{student.name}</strong>{student.admissionNo ? ` (${student.admissionNo})` : ''} {student.className ? `· ${student.className}` : ''}<span className="block text-xs text-mist">{bill.feeGroupName} · {bill.feeType} · {bill.academicYear} / {bill.term} · Due {((balance(bill) ?? 0)/100).toFixed(2)}</span></span></label>)}{!visible.length && <p className="p-3 text-sm text-mist">No eligible outstanding fee items found.</p>}</div></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Destination Academic Year" required><Select value={year} onChange={e => { setYear(e.target.value); setTerm('') }}><option value="">Select academic year</option>{years.map(y => <option key={y}>{y}</option>)}</Select></Field><Field label="Destination Term / Semester" required><Select value={term} disabled={!year} onChange={e => setTerm(e.target.value)}><option value="">Select term / semester</option>{terms.map(t => <option key={t}>{t}</option>)}</Select></Field></div><p className="text-xs text-mist">The entire fee item moves, including its payment history. The full remaining balance moves once; the due date stays unchanged. Fees with an unknown balance or missing source period require review.</p>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>Carry Forward</Button></div></div></Modal></div>
}
