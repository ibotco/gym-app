import { consistentScholarshipAward, isNonDeductingSample } from './scholarshipBalanceApply'
import type { EduRow } from './eduRecords'
const key=(v:unknown)=>String(v??'').trim().toLowerCase()
const cents=(v:unknown):number|null=>{const s=String(v??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null}
export function fullInvoicePlan(bills:EduRow[],studentId:string,scholarships:EduRow[], allBills:EduRow[] = bills, postings:EduRow[] = [], allocations:EduRow[] = []):{rows:{billId:string;owed:number}[];total:number;error:string}{
 const fail=(error:string)=>({rows:[],total:0,error})
 if (!bills.length) return fail('No invoice items are available.')
 if (new Set(bills.map(b=>b.id)).size!==bills.length) return fail('Duplicate fee items need review.')
 for(const bill of bills) if(bill.scholarshipPostingId || bill.scholarshipAppliedAmount || bill.scholarshipOriginalAmount) {
  const post=postings.filter(p=>p.id===bill.scholarshipPostingId && p.status==='Posted');const award=post.length===1?scholarships.filter(a=>a.id===post[0].awardId):[]
  if(award.length!==1 || !consistentScholarshipAward(award[0],allBills,postings,allocations)) return fail('Scholarship credit records are inconsistent. Review this invoice before collection.')
 }
 // A known disjoint fee-type set cannot affect this invoice; unknown types or
 // periods are treated as potentially relevant, never silently ignored.
 const awardMayApply = (a:EduRow) => {
  if(isNonDeductingSample(a) || a.studentId!==studentId || key(a.status)!=='active') return false
  if(consistentScholarshipAward(a,allBills,postings,allocations)) return false
  let types:string[]|null=null
  try { const parsed=JSON.parse(String(a.eligibleFeeTypes??'')); if(Array.isArray(parsed) && parsed.length && parsed.every((x:unknown)=>typeof x==='string' && !!x.trim())) types=parsed } catch { /* require review when eligibility is unclear */ }
  return bills.some(b=>{
   const sameYear=!a.session||!b.academicYear||key(a.session)===key(b.academicYear)
   const sameTerm=!a.term||!b.term||key(a.term)===key(b.term)
   const possibleType=!types||!b.feeTypeId||types.includes(b.feeTypeId)
   return sameYear&&sameTerm&&possibleType
  })
 }
 if (scholarships.some(awardMayApply)) return fail('Scholarship credit may apply but is not applied or needs review. Open Scholarships → Preview Fees to apply eligible credits before collection.')
 const rows:{billId:string;owed:number}[]=[]
 for(const b of bills){
  if(['discount','discountAmount','scholarshipDiscount','fine','fineAmount'].some(k=>String(b[k]??'').trim()!==''&&cents(b[k])!==0))return fail('A fee has an adjustment that requires review before full payment.')
  const total=cents(b.amount),status=key(b.status),text=String(b.amountPaid??'').trim(),paid=text?cents(text):status==='paid'?total:(!status||status==='unpaid')?0:null
  if(total===null||paid===null||paid>total||!['','unpaid','partial','partly paid','paid'].includes(status)||(status==='paid'&&paid!==total))return fail('A fee balance cannot be verified. Review the invoice first.')
  if(total-paid>0)rows.push({billId:b.id,owed:total-paid})
 }
 const total=rows.reduce((n,r)=>n+r.owed,0)
 if(!Number.isSafeInteger(total))return fail('Invoice total is too large to calculate safely.')
 if(!rows.length)return fail('There is no outstanding balance to collect.')
 return {rows,total,error:''}
}
