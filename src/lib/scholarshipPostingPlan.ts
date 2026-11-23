import type { EduRecords, EduRow } from './eduRecords'
import { previewScholarship } from './scholarshipBillingPreview'

export type ScholarshipPostingPlan =
 | { state: 'review'; reasons: string[] }
 | { state: 'already-posted'; postingId: string }
 | { state: 'ready'; postingId: string; awardId: string; studentId: string; academicYear: string; term: string; allocations: { billingId: string; amountCents: number }[]; unappliedCreditCents: number; awardCents: number }

/** Builds a non-mutating plan only. A server transaction must revalidate it before posting. */
export function planScholarshipPosting(award: EduRow, data: EduRecords): ScholarshipPostingPlan {
 if (!award.id) return {state:'review',reasons:['The award has no stable ID.']}
 const stored=(data.scholarships??[]).filter(a=>a.id===award.id)
 if(stored.length!==1 || JSON.stringify(stored[0])!==JSON.stringify(award)) return {state:'review',reasons:['The saved award is missing, duplicated or changed; reload it before posting.']}
 if((data.studentList??[]).filter(s=>s.id===award.studentId).length!==1) return {state:'review',reasons:['The student is missing or not uniquely linked.']}
 const ids=(data.studentBilling??[]).map(b=>b.id)
 if(ids.some(id=>!id) || new Set(ids).size!==ids.length) return {state:'review',reasons:['Billing entries have missing or duplicate IDs.']}

 const existing=(data.scholarshipPostings??[]).filter(p=>p.awardId===award.id && p.status==='Posted')
 if (existing.length===1) return {state:'already-posted',postingId:existing[0].id}
 if (existing.length>1) return {state:'review',reasons:['More than one posting exists for this award.']}
 if (award.id.startsWith('sample-')) return {state:'review',reasons:['Illustrative sample awards are not authorized for real posting.']}
 const preview=previewScholarship(award,data)
 if (preview.state==='review') return {state:'review',reasons:preview.reasons}
 if (preview.lines.some(line => (data.scholarshipAllocations??[]).some(a=>a.billingId===line.billId && a.status==='Posted'))) return {state:'review',reasons:['A fee already has a posted scholarship allocation; review before applying another award.']}
 const allocations=preview.lines.filter(line=>line.deductionCents>0).map(line=>({billingId:line.billId,amountCents:line.deductionCents}))
 const awardCents=allocations.reduce((sum,line)=>sum+line.amountCents,0)+preview.creditCents
 if (!Number.isSafeInteger(awardCents)) return {state:'review',reasons:['Award amount is too large to calculate safely.']}
 return {state:'ready',postingId:`scholarship-posting:${award.id}`,awardId:award.id,studentId:award.studentId,academicYear:award.session,term:award.term,allocations,unappliedCreditCents:preview.creditCents,awardCents}
}
