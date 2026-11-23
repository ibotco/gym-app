import type { EduRow } from './eduRecords'
/** Sequential, browser-generated display numbers; not reserved across sessions. */
export function nextFeePaymentNumbers(existing:readonly {paymentNumber?:string}[],count:number):string[] {
 if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid payment count.')
 let max=0
 for(const item of existing){const match=/^FP-(\d+)$/.exec(item.paymentNumber||'');if(match){const n=Number(match[1]);if(Number.isSafeInteger(n))max=Math.max(max,n)}}
 if(max>Number.MAX_SAFE_INTEGER-count)throw new Error('Fee payment numbering exhausted.')
 return Array.from({length:count},(_,i)=>`FP-${String(max+i+1).padStart(4,'0')}`)
}
/** Collect all visible branch payment references from the browser's education store. */
export function allFeePaymentNumberRecords(raw:string|null,fallback:readonly EduRow[]):{paymentNumber?:string}[] {
 try {const value=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return [...fallback];return [...fallback,...Object.values(value).flatMap((branch:unknown)=>branch&&typeof branch==='object'&&Array.isArray((branch as {feesInvoicePayments?:unknown}).feesInvoicePayments)?(branch as {feesInvoicePayments:EduRow[]}).feesInvoicePayments:[])]} catch{return [...fallback]}
}
