import type { EduRecords, EduRow } from './eduRecords'
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
/** Resolve a payment to one current student/period/fee-group. Never use payment voucher as invoice ID. */
export function feeInvoiceForPayment(payment:EduRow, data:EduRecords):{student:EduRow|null;bills:EduRow[];error:string} {
 const fail=(error:string)=>({student:null,bills:[],error})
 const bills=data.studentBilling??[], students=data.studentList??[]
 const linked=bills.filter(b=>b.id===payment.billingId)
 if(linked.length!==1)return fail('The payment’s linked fee item is missing or duplicated. Review the record before printing.')
 const bill=linked[0], admission=norm(payment.admissionNo || bill.admissionNo)
 if(payment.studentId && bill.studentId && payment.studentId!==bill.studentId)return fail('The payment and fee item name different students. Review before printing.')
 const studentId=payment.studentId || bill.studentId
 const found=studentId?students.filter(s=>s.id===studentId):admission?students.filter(s=>norm(s.admissionNo)===admission):[]
 if(found.length!==1)return fail('The student is missing or ambiguous. Review before printing.')
 const student=found[0]
 if((payment.admissionNo && student.admissionNo && norm(payment.admissionNo)!==norm(student.admissionNo)) || (bill.admissionNo && student.admissionNo && norm(bill.admissionNo)!==norm(student.admissionNo))) return fail('The student’s registration number does not match. Review before printing.')
 const year=norm(payment.academicYear),term=norm(payment.term),groupId=String(payment.feeGroupId||'').trim(), groupName=norm(payment.feeGroupName)
 if(!year||!term||(!groupId&&!groupName))return fail('The payment is missing its academic period or fee group. Review before printing.')
 if(year!==norm(bill.academicYear)||term!==norm(bill.term))return fail('The fee item’s period differs from the payment snapshot. Review before printing.')
 if(groupId ? groupId!==String(bill.feeGroupId||'').trim() : groupName!==norm(bill.feeGroupName))return fail('The fee group differs from the payment snapshot. Review before printing.')
 // Name-only group matches are safe only if there is no conflicting group ID.
 if(!groupId){const ids=new Set(bills.filter(b=>norm(b.feeGroupName)===groupName && b.feeGroupId).map(b=>b.feeGroupId));if(ids.size>1)return fail('The fee group name is ambiguous. Review before printing.')}
 const sameStudent=(b:EduRow)=>b.studentId?b.studentId===student.id:!!student.admissionNo && norm(b.admissionNo)===norm(student.admissionNo) && students.filter(s=>norm(s.admissionNo)===norm(student.admissionNo)).length===1
 if(groupId && groupName && bills.some(b=>sameStudent(b) && norm(b.academicYear)===year && norm(b.term)===term && !String(b.feeGroupId||'').trim() && norm(b.feeGroupName)===groupName)) return fail('A fee item has the same group name but no group ID. Review before printing.')
 const matches=bills.filter(b=>sameStudent(b)&&norm(b.academicYear)===year&&norm(b.term)===term&&(groupId ? String(b.feeGroupId||'').trim()===groupId : norm(b.feeGroupName)===groupName))
 if(!matches.length || !matches.some(b=>b.id===bill.id)||new Set(matches.map(b=>b.id)).size!==matches.length)return fail('Invoice fee items are missing or duplicated. Review before printing.')
 return {student,bills:matches,error:''}
}
