import type { EduRecords, EduRow } from './eduRecords'
import { planScholarshipPosting } from './scholarshipPostingPlan'
const cents=(value:unknown):number|null=>{const s=String(value??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null}
const money=(n:number)=>(n/100).toFixed(2)
/** Seeded illustrative awards explicitly state they do not deduct fees. */
export function isNonDeductingSample(award:EduRow):boolean {
 if(!award.id.startsWith('sample-scholarship-award-') || award.remarks!=='Illustrative sample; no billing deduction.') return false
 try {const ids=JSON.parse(award.eligibleFeeTypes || '[]');return Array.isArray(ids) && ids.length===0} catch {return false}
}
/** Browser-coordinated only; revalidate on save. Not transaction safe. */
export function applyScholarshipBalance(award:EduRow,data:EduRecords,now:string):{records:EduRecords|null;error:string} {
 const fail=(error:string)=>({records:null,error})
 const plan=planScholarshipPosting(award,data)
 if(plan.state!=='ready')return fail(plan.state==='already-posted'?'This award is already applied.':plan.reasons.join(' '))
 if(!plan.allocations.length || plan.unappliedCreditCents!==0)return fail('This award exceeds eligible outstanding fees or has no eligible balance. Review unused credit before applying.')
 if((data.studentBilling??[]).some(b=>b.studentId===award.studentId && !b.feeTypeId && (!b.academicYear || b.academicYear.toLowerCase()===award.session.toLowerCase()) && (!b.term || b.term.toLowerCase()===award.term.toLowerCase())))return fail('A potentially eligible fee is missing its fee type; review it before applying.')
 // Reject ambiguous potential overlaps, not merely confirmed overlaps.
 if((data.scholarships??[]).some(a=>{if(isNonDeductingSample(a)||a.id===award.id||a.studentId!==award.studentId||String(a.status||'').trim().toLowerCase()!=='active')return false; if(a.session && a.session.toLowerCase()!==award.session.toLowerCase())return false;if(a.term && a.term.toLowerCase()!==award.term.toLowerCase())return false; try {const ids=JSON.parse(a.eligibleFeeTypes||'');return !Array.isArray(ids)||!ids.length||ids.some((id:unknown)=>typeof id!=='string'||!id) || ids.some((id:string)=>JSON.parse(award.eligibleFeeTypes).includes(id))}catch{return true}}))return fail('Another active scholarship may overlap; review awards before applying.')
 const updates=new Map<string,EduRow>(),allocations:EduRow[]=[]
 for(const item of plan.allocations){
  const matches=(data.studentBilling??[]).filter(b=>b.id===item.billingId);if(matches.length!==1)return fail('A fee item is missing or duplicated.')
  const bill=matches[0],total=cents(bill.amount),paidText=String(bill.amountPaid??'').trim(),paid=paidText?cents(paidText):String(bill.status||'').toLowerCase()==='paid'?total:0
  if(bill.carryForwardId || bill.scholarshipOriginalAmount || bill.scholarshipAppliedAmount)return fail('Carried-forward or previously credited fees require review.')
  if(total===null||paid===null||item.amountCents<=0||paid+item.amountCents>total)return fail('The fee balance changed; review before applying.')
  const net=total-item.amountCents
  updates.set(bill.id,{...bill,scholarshipOriginalAmount:money(total),scholarshipAppliedAmount:money(item.amountCents),scholarshipPostingId:plan.postingId,amount:money(net),status:paid===net?'Paid':paid>0?'Partial':'Unpaid'})
  allocations.push({id:`${plan.postingId}:${bill.id}`,postingId:plan.postingId,awardId:award.id,billingId:bill.id,amount:money(item.amountCents),status:'Posted'})
 }
 const posting:EduRow={id:plan.postingId,awardId:award.id,studentId:award.studentId,amount:money(plan.awardCents),status:'Posted',createdAt:now,accounting:'none'}
 return {error:'',records:{...data,studentBilling:(data.studentBilling??[]).map(b=>updates.get(b.id)??b),scholarshipPostings:[...(data.scholarshipPostings??[]),posting],scholarshipAllocations:[...(data.scholarshipAllocations??[]),...allocations]}}
}
/** Only recognize an applied award when its allocations and net amounts agree. */
export function consistentScholarshipAward(award:EduRow,bills:EduRow[],postings:EduRow[],allocations:EduRow[]):boolean {
 const p=postings.filter(p=>p.awardId===award.id&&p.status==='Posted');if(p.length!==1||p[0].studentId!==award.studentId)return false
 const lines=allocations.filter(a=>a.postingId===p[0].id&&a.awardId===award.id&&a.status==='Posted');if(!lines.length)return false
 let sum=0;const seen=new Set<string>()
 for(const line of lines){if(seen.has(line.billingId))return false;seen.add(line.billingId);const found=bills.filter(b=>b.id===line.billingId);if(found.length!==1)return false;const bill=found[0],gross=cents(bill.scholarshipOriginalAmount),credit=cents(bill.scholarshipAppliedAmount),net=cents(bill.amount),allocated=cents(line.amount);if(bill.studentId!==award.studentId||bill.scholarshipPostingId!==p[0].id||gross===null||credit===null||net===null||allocated===null||credit!==allocated||gross-credit!==net)return false;sum+=allocated}
 return Number.isSafeInteger(sum)&&sum===cents(p[0].amount)&&sum===cents(award.amount)
}
