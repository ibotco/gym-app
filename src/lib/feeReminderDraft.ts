import type { EduRow } from './eduRecords'
export function makeFeeReminderDraft(student: EduRow, bills: EduRow[], branchName: string): {subject:string;body:string} {
 const lines=bills.map(b=>`• ${b.feeGroupName ? `${b.feeGroupName} — ` : ''}${b.feeType||'Fee'} (${b.academicYear||'Year unspecified'} / ${b.term||'Term unspecified'})${b.dueDate?` — due ${b.dueDate}`:''}`)
 return {subject:`Fee payment reminder — ${student.name||'Student'}`,body:[`Hello,`,'',`This is a reminder to review the outstanding fee items for ${student.name||'the student'}${student.admissionNo?` (${student.admissionNo})`:''}:`,'',...lines,'','Please contact the school to confirm the current balance and payment arrangements.','',branchName].join('\n')}
}
