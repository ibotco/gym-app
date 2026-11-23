import type { EduRecords, EduRow } from './eduRecords'
import { EDU_SEED } from './eduSeed'

// Add illustrative allocations only for unchanged built-in sample students and an
// existing sample group. Never overwrite a real allocation or resurrect deletions.
export function addBillingSamples(records: EduRecords): EduRecords {
  const marker = 'student-billing-samples-v1'
  if ((records.feeSampleMigrations ?? []).some(r => r.id === marker)) return records
  const group = (records.feeGroups ?? []).find(g => g.id === 'sample-fee-group-v1-1' && g.name === 'Sample — Basic Term Fees')
  const period = (records.termSemester ?? []).find(t => t.name === 'Term 1' && t.academicYear === '2026/2027')
  let items: Array<{ feeTypeId: string; name: string; dueDate: string; amount: string }> = []
  try { const parsed = JSON.parse(String(group?.itemsJson ?? '[]')); if (Array.isArray(parsed)) items = parsed } catch { /* no usable sample group */ }
  if (!group || !period || !items.length || items.some(i => !i.feeTypeId || !i.name || !i.dueDate || !/^\d+(\.\d{1,2})?$/.test(String(i.amount)))) return records
  const bills = records.studentBilling ?? []
  const additions: EduRow[] = []
  for (const original of EDU_SEED.studentList.slice(0, 10)) {
    const student = (records.studentList ?? []).find(s => s.id === original.id && s.name === original.name && s.admissionNo === original.admissionNo)
    if (!student) continue
    const exists = bills.some(b => b.feeGroupId === group.id && (b.studentId === student.id || (student.admissionNo && b.admissionNo === student.admissionNo)) && ((!b.academicYear || !b.term) || (b.academicYear === period.academicYear && b.term === period.name)))
    if (exists) continue
    items.forEach((item, index) => additions.push({ id: `sample-billing-v1-${student.id}-${index+1}`, studentId: student.id, admissionNo: student.admissionNo, student: student.name, className: student.className, billingDate: '2026-09-01', academicYear: period.academicYear, term: period.name, dueDate: String(item.dueDate), amount: Number(item.amount).toFixed(2), status: 'Unpaid', feeType: item.name, feeTypeId: item.feeTypeId, feeGroupId: group.id, feeGroupName: group.name, reference: `SAMPLE:billing-v1:${student.id}:${index+1}`, allocationSource: 'feesGroup', remarks: 'Illustrative sample allocation; not a real charge.' }))
  }
  return { ...records, studentBilling: [...additions, ...bills], feeSampleMigrations: [...(records.feeSampleMigrations ?? []), { id: marker }] }
}

// Move only an untouched built-in sample item, never a real or paid allocation.
export function addCarryForwardSample(records: EduRecords): EduRecords {
  const marker = 'carry-forward-sample-v1'
  if ((records.feeSampleMigrations ?? []).some(r => r.id === marker)) return records
  const source = (records.studentBilling ?? []).find(b => b.id === 'sample-billing-v1-seed-st-1-1' && b.reference === 'SAMPLE:billing-v1:seed-st-1:1' && b.studentId === 'seed-st-1' && b.feeGroupId === 'sample-fee-group-v1-1' && b.status === 'Unpaid' && !b.amountPaid && !b.carryForwardId && b.academicYear === '2026/2027' && b.term === 'Term 1' && /^\d+(\.\d{1,2})?$/.test(String(b.amount ?? '')) && !(records.feesInvoicePayments ?? []).some(p => p.billingId === b.id))
  const destination = (records.termSemester ?? []).some(t => t.name === 'Term 2' && t.academicYear === '2026/2027')
  if (!source || !destination) return records
  const id = 'sample-carry-forward-v1-1'
  const event: EduRow = { id, studentId: source.studentId, student: source.student, billingId: source.id, feeGroupId: source.feeGroupId, feeGroupName: source.feeGroupName, feeType: source.feeType, fromSession: source.academicYear, fromTerm: source.term, toSession: '2026/2027', toTerm: 'Term 2', amount: Number(source.amount).toFixed(2), status: 'Carried', previousCarryId: '', paymentIdsJson: '[]', carriedAt: new Date().toISOString(), remarks: 'Illustrative sample; not a real charge.' }
  return { ...records, studentBilling: (records.studentBilling ?? []).map(b => b.id === source.id ? { ...b, academicYear: event.toSession, term: event.toTerm, carryForwardId: id } : b), feesCarryForward: [event, ...(records.feesCarryForward ?? [])], feeSampleMigrations: [...(records.feeSampleMigrations ?? []), { id: marker }] }
}
