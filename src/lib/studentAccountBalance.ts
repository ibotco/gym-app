/** Shared debit/credit account arithmetic. This helper does not save or post entries. */
export type StudentAccountEntry = {
 id: string
 studentId: string
 academicYear: string
 term: string
 status: 'posted' | 'pending' | 'reversed'
 debitCents: number
 creditCents: number
}
export type StudentAccountBalance =
 | { state: 'ready'; debitCents: number; creditCents: number; amountDueCents: number; creditBalanceCents: number }
 | { state: 'review'; reasons: string[] }
const norm=(x:string)=>x.trim().toLowerCase()
export function studentAccountBalance(entries: StudentAccountEntry[], studentId: string, academicYear: string, term: string): StudentAccountBalance {
 if (!studentId.trim() || !academicYear.trim() || !term.trim()) return {state:'review',reasons:['Student, academic year and term are required.']}
 const matching=entries.filter(e=>e.studentId===studentId && norm(e.academicYear)===norm(academicYear) && norm(e.term)===norm(term) && e.status==='posted')
 const ids=new Set<string>();let debitCents=0,creditCents=0
 for(const e of matching){
  if (!e.id || ids.has(e.id)) return {state:'review',reasons:['An account entry is missing an ID or is duplicated.']}
  ids.add(e.id)
  if (![e.debitCents,e.creditCents].every(n=>Number.isSafeInteger(n)&&n>=0) || (e.debitCents>0 && e.creditCents>0) || (e.debitCents===0 && e.creditCents===0)) return {state:'review',reasons:['An account entry has an invalid debit or credit.']}
  debitCents+=e.debitCents;creditCents+=e.creditCents
  if(!Number.isSafeInteger(debitCents)||!Number.isSafeInteger(creditCents))return {state:'review',reasons:['Account totals exceed the safe calculation limit.']}
 }
 return {state:'ready',debitCents,creditCents,amountDueCents:Math.max(0,debitCents-creditCents),creditBalanceCents:Math.max(0,creditCents-debitCents)}
}
