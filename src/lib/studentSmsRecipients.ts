import { normalizeInternationalPhone } from './directSms'
import { EDU_RECORDS_KEY } from './eduRecords'
export type SmsStudent = {id:string;name:string;phone:string;status:string;className:string;admissionNo:string}
export type StudentSmsRecipient = {id:string;name:string;phone:string;className:string;admissionNo:string}
/** Read only: do not seed or migrate education records when composing a message. */
export function readStudentSmsRecords(branchId:string):SmsStudent[] {
 if (!branchId) return []
 try {
  const data = JSON.parse(localStorage.getItem(EDU_RECORDS_KEY) || '{}')
  const students = data?.[branchId]?.studentList
  if (!Array.isArray(students)) return []
  return students.filter((x:unknown)=>x && typeof x === 'object' && typeof (x as {id?:unknown}).id === 'string').map((x:Record<string,unknown>)=>({id:String(x.id),name:String(x.name || ''),phone:String(x.phone || ''),status:String(x.status || 'Active'),className:String(x.className || ''),admissionNo:String(x.admissionNo || '')}))
 } catch { return [] }
}
export function planStudentSms(students:SmsStudent[], selectedIds:string[]):{recipients:StudentSmsRecipient[];error?:string} {
 if (!selectedIds.length) return {recipients:[],error:'Select at least one student.'}
 if (selectedIds.length > 100) return {recipients:[],error:'Select at most 100 students per send.'}
 if (new Set(selectedIds).size !== selectedIds.length) return {recipients:[],error:'The student selection contains duplicate IDs.'}
 const recipients:StudentSmsRecipient[]=[]; const phones = new Set<string>()
 for (const id of selectedIds) {
  const found=students.filter(s=>s.id===id)
  if (found.length!==1 || !found[0].name.trim() || found[0].status.toLowerCase() !== 'active') return {recipients:[],error:'A selected student is missing, inactive or ambiguous. Review the selection.'}
  const s=found[0]; const digits=normalizeInternationalPhone(s.phone)
  if (!digits) return {recipients:[],error:`${s.name} has no valid international Student Phone. Update their number before sending.`}
  if (phones.has(digits)) return {recipients:[],error:'Selected students share a phone number. Remove duplicates before sending.'}
  phones.add(digits); recipients.push({id:s.id,name:s.name,phone:`+${digits}`,className:s.className,admissionNo:s.admissionNo})
 }
 return {recipients}
}

/** Empty selection explicitly means all saved students in this branch, never other branches. */
export function planStudentSmsAudience(students:SmsStudent[], selectedIds:string[]):{recipients:StudentSmsRecipient[];error?:string} {
 if (!selectedIds.length && !students.length) return {recipients:[],error:'There are no students in the current branch.'}
 return planStudentSms(students, selectedIds.length ? selectedIds : students.map(s=>s.id))
}
