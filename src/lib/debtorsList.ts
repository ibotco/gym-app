import { consistentScholarshipAward } from './scholarshipBalanceApply'
import type { EduRecords, EduRow } from './eduRecords'
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
function cents(v:unknown):number|null {const s=String(v??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [whole,frac='']=s.split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null}
type DebtItem={bill:EduRow;amountCents:number;paidCents:number;balanceCents:number}
type Debtor={student:EduRow;items:DebtItem[];amountCents:number;paidCents:number;balanceCents:number}
/** Current branch billing balances; uncertain or ambiguous entries are reported, not counted. */
export function debtorsList(data:EduRecords, filter:{year?:string;term?:string}={}) : {rows:Debtor[];review:{bill:EduRow;reason:string}[]} {
 const students=data.studentList??[], bills=data.studentBilling??[], grouped=new Map<string,Debtor>(),review:{bill:EduRow;reason:string}[]=[],ids=new Map<string,number>()
 for(const b of bills)ids.set(b.id,(ids.get(b.id)||0)+1)
 for(const bill of bills){
  if(filter.year&&norm(bill.academicYear)!==norm(filter.year))continue
  if(filter.term&&norm(bill.term)!==norm(filter.term))continue
  if(['cancelled','canceled','void'].includes(norm(bill.status)))continue
  const bad=(reason:string)=>review.push({bill,reason})
  if(!bill.id||(ids.get(bill.id)||0)!==1){bad('Missing or duplicate billing ID');continue}
  const matches=bill.studentId ? students.filter(s=>s.id===bill.studentId) : bill.admissionNo ? students.filter(s=>norm(s.admissionNo)===norm(bill.admissionNo)) : []
  if(matches.length!==1){bad('Student is missing or ambiguous');continue}
  const student=matches[0]
  if(bill.admissionNo&&student.admissionNo&&norm(bill.admissionNo)!==norm(student.admissionNo)){bad('Student registration number does not match');continue}
  if(['discount','discountAmount','scholarshipDiscount','fine','fineAmount'].some(k=>String(bill[k]??'').trim()!=='' && cents(bill[k])!==0)){bad('Fee adjustments require review');continue}
  if(bill.scholarshipPostingId||bill.scholarshipOriginalAmount||bill.scholarshipAppliedAmount){
   const posts=(data.scholarshipPostings??[]).filter(p=>p.id===bill.scholarshipPostingId&&p.status==='Posted'), awards=posts.length===1?(data.scholarships??[]).filter(a=>a.id===posts[0].awardId):[]
   if(awards.length!==1||!consistentScholarshipAward(awards[0],bills,data.scholarshipPostings??[],data.scholarshipAllocations??[])){bad('Scholarship credit requires review');continue}
  }
  const total=cents(bill.amount),status=norm(bill.status),raw=String(bill.amountPaid??'').trim()
  const paid=raw?cents(raw):status==='paid'?total:(!status||status==='unpaid')?0:null
  if(total===null||paid===null||paid>total||!['','unpaid','paid','partial','partly paid'].includes(status)||(status==='paid'&&paid!==total)){bad('Balance cannot be verified');continue}
  const balance=total-paid;if(balance===0)continue
  const debtor=grouped.get(student.id)??{student,items:[],amountCents:0,paidCents:0,balanceCents:0}
  if(!Number.isSafeInteger(debtor.amountCents+total)||!Number.isSafeInteger(debtor.paidCents+paid)||!Number.isSafeInteger(debtor.balanceCents+balance)){bad('Student total is too large');continue}
  debtor.items.push({bill,amountCents:total,paidCents:paid,balanceCents:balance});debtor.amountCents+=total;debtor.paidCents+=paid;debtor.balanceCents+=balance;grouped.set(student.id,debtor)
 }
 return {rows:[...grouped.values()].sort((a,b)=>String(a.student.name||'').localeCompare(String(b.student.name||''))),review}
}
