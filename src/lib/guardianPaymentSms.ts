import type { EduRow } from './eduRecords'
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
/** A name-only parent link is usable only if the student's name is unique in this branch. */
export function paymentGuardianCandidates(student:EduRow, students:EduRow[], parents:EduRow[]):EduRow[] {
 if(!student.id || students.filter(s=>s.id===student.id).length!==1) return []
 const name=norm(student.name), uniqueName=!!name && students.filter(s=>norm(s.name)===name).length===1
 return parents.filter(p=>p.studentId ? p.studentId===student.id : uniqueName && norm(p.student)===name)
}
export function paymentGuardianPhone(value:unknown):string|null {
 const raw=String(value??'').trim();if(!/^\+[0-9 ()-]+$/.test(raw))return null
 const digits=raw.replace(/\D/g,'');return /^[1-9]\d{7,14}$/.test(digits)?digits:null
}
export function paymentConfirmationText(student:string,amount:string,currency:string,school:string):string {
 return `${school||'School'}: Payment of ${currency} ${amount} was recorded for ${student||'your student'}. Please contact the school with any questions.`
}
