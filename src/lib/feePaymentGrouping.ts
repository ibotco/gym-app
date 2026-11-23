import type { EduRow } from './eduRecords'
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
/** Group only the same voucher and confidently identified student. Never merge missing identities. */
export function groupFeePaymentRows<T extends {p:EduRow}>(rows:T[]):(T & {items:T[];groupKey:string;totalCents:number|null;voucher:string})[] {
 const groups=new Map<string,T[]>()
 rows.forEach((r,index)=>{const p=r.p,voucher=norm(p.voucherNumber||p.reference),student=p.studentId?`id:${p.studentId}`:p.admissionNo?`reg:${norm(p.admissionNo)}`:'';const key=voucher&&student?JSON.stringify([voucher,student]):JSON.stringify(['separate',index]);const group=groups.get(key)||[];group.push(r);groups.set(key,group)})
 return [...groups.entries()].map(([groupKey,items])=>{let total=0,valid=true;for(const {p} of items){const s=String(p.amount??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s)){valid=false;continue}const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||!Number.isSafeInteger(total+n))valid=false;else total+=n}return {...items[0],items,groupKey,totalCents:valid?total:null,voucher:String(items[0].p.voucherNumber||items[0].p.reference||'').trim()}})
}
