import type { EduRecords, EduRow } from './eduRecords'
export type ScholarshipPreview = { state: 'ready' | 'review'; reasons: string[]; lines: { billId: string; fee: string; dueDate: string; balanceCents: number; deductionCents: number }[]; creditCents: number }
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
const cents = (v: unknown): number | null => { const s = String(v ?? '').trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null; const [a,b=''] = s.split('.'); const n = Number(a)*100+Number(b.padEnd(2,'0')); return Number.isSafeInteger(n) ? n : null }
function feeIds(value: unknown): string[] { try { const x=JSON.parse(String(value??'[]')); return Array.isArray(x) ? x.filter((id): id is string => typeof id === 'string' && !!id) : [] } catch {return []} }
/** Read-only estimate. Never mutates bills or creates credits; ambiguous cases are blocked. */
export function previewScholarship(award: EduRow, data: EduRecords): ScholarshipPreview {
 const reasons:string[]=[];const types=feeIds(award.eligibleFeeTypes), value=cents(award.amount)
 if(norm(award.status)!=='active')reasons.push('Award is not Active.')
 if(!award.studentId)reasons.push('Student is not linked.')
 if(!award.session || !award.term)reasons.push('Academic year and term are required for a same-period credit.')
 if(!types.length)reasons.push('Select at least one eligible fee type.')
 if(value===null || value<=0)reasons.push('Award amount is invalid.')
 if(types.some(id=>!(data.feeTypes??[]).some(t=>t.id===id)))reasons.push('An eligible fee type no longer exists.')
 const bills=(data.studentBilling??[]).filter(b=>b.studentId===award.studentId && norm(b.academicYear)===norm(award.session) && norm(b.term)===norm(award.term) && types.includes(b.feeTypeId)).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||a.id.localeCompare(b.id))
 const competing=(data.scholarships??[]).some(a=>a.id!==award.id&&a.studentId===award.studentId&&norm(a.status)==='active'&&norm(a.session)===norm(award.session)&&(!a.term||norm(a.term)===norm(award.term))&&feeIds(a.eligibleFeeTypes).some(id=>types.includes(id)))
 if(competing)reasons.push('Another active award overlaps eligible fees; allocation order requires review.')
 const lines:ScholarshipPreview['lines']=[]
 for(const b of bills){
  const total=cents(b.amount), status=norm(b.status), paidText=String(b.amountPaid??'').trim(); let paid=paidText?cents(paidText):status==='paid'?total:status===''||status==='unpaid'?0:null
  if(total===null || paid===null || paid>total || (status==='paid'&&paid!==total) || !['','unpaid','paid','partial','partly paid'].includes(status)){reasons.push(`Fee ${b.feeType||b.id} has an unknown or inconsistent balance.`);continue}
  if(['discount','discountAmount','scholarshipDiscount','fine','fineAmount'].some(k=>String(b[k]??'').trim()!=='' && cents(b[k])!==0)){reasons.push(`Fee ${b.feeType||b.id} has an existing adjustment requiring review.`);continue}
  lines.push({billId:b.id,fee:b.feeType||'Fee',dueDate:b.dueDate||'',balanceCents:total-paid,deductionCents:0})
 }
 if(reasons.length)return {state:'review',reasons:[...new Set(reasons)],lines:[],creditCents:0}
 let available=value!;for(const line of lines){line.deductionCents=Math.min(available,line.balanceCents);available-=line.deductionCents}
 return {state:'ready',reasons:[],lines,creditCents:available}
}
