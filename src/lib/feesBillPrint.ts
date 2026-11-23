import type { EduRow } from './eduRecords'
import { findStudentTermDates, formatStudentTermDate } from './studentTermDates'

export type PrintableInvoice = { id: string; student: EduRow; bills: EduRow[] }
export type BillPrintOptions = { schoolName: string; branchName: string; address?: string; phone?: string; email?: string; logo?: string; currency?: string; classes: EduRow[]; scholarships?: EduRow[]; paymentAccounts?: EduRow[]; studentTermDates?: EduRow[]; carryForwards?: EduRow[]; printNotice?: string }
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))
const key = (v: unknown) => String(v ?? '').trim().toLowerCase()
function cents(value: unknown): number | null { const s=String(value??'').trim(); if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null }
function amounts(b:EduRow, carryForwards:EduRow[]): {total:number|null;paid:number|null;due:number|null} {
 const total=cents(b.amount), status=key(b.status); if(total===null)return {total:null,paid:null,due:null}
 const text=String(b.amountPaid??'').trim();let paid:number|null=null
 if(text) paid=cents(text); else if(status==='paid')paid=total; else if(!status || status==='unpaid')paid=0
 if(paid===null || paid>total || (status==='paid' && paid!==total) || !['','unpaid','paid','partial','partly paid'].includes(status))return {total,paid:null,due:null}
 if(b.carryForwardId){
  const events=carryForwards.filter(e=>e.id===b.carryForwardId && e.billingId===b.id && key(e.status)==='carried' && key(e.toSession)===key(b.academicYear) && key(e.toTerm)===key(b.term))
  if(events.length!==1)return {total:null,paid:null,due:null}
  const carried=cents(events[0].amount)
  if(carried===null || carried>total)return {total:null,paid:null,due:null}
  const before=total-carried, after=paid-before
  if(after<0 || after>carried)return {total:null,paid:null,due:null}
  return {total:carried,paid:after,due:carried-after}
 }
 return {total,paid,due:total-paid}
}
function period(b:EduRow) { return [b.term||'Term unspecified',b.academicYear||'Year unspecified'].join(' · ') }
function studentClass(s:EduRow,classes:EduRow[]) { const raw=String(s.className??'').trim();const name=classes.map(c=>String(c.name??'').trim()).filter(Boolean).sort((a,b)=>b.length-a.length).find(n=>key(raw)===key(n)||key(raw).startsWith(key(n)+' '))??raw;const section=(raw.slice(name.length).trim()||String(s.section??'').trim()).replace(/^section\s+/i,'');return [name,section].filter(Boolean).join(' ') }
/** Complete printable document; all data is escaped and no live balances are changed. */
export function makeStudentBillsHtml(invoices: PrintableInvoice[], options: BillPrintOptions): string {
 const amount=(n:number|null)=>n===null?'Review':(n/100).toFixed(2)
 const bills=invoices.map(inv=>{
  const sorted=[...inv.bills].sort((a,b)=>Number(!!b.carryForwardId)-Number(!!a.carryForwardId)||period(a).localeCompare(period(b))||String(a.dueDate??'').localeCompare(String(b.dueDate??''))||a.id.localeCompare(b.id))
  const periods=[...new Set(sorted.map(period))], values=sorted.map(b=>amounts(b,options.carryForwards??[])), unknown=values.some(v=>v.total===null||v.paid===null||v.due===null)
  const total=values.reduce((n,v)=>n+(v.total??0),0), paid=values.reduce((n,v)=>n+(v.paid??0),0), due=values.reduce((n,v)=>n+(v.due??0),0)
  const pending=(options.scholarships ?? []).filter(a=>a.studentId===inv.student.id && key(a.status)==='active' && sorted.some(b=>(!a.session || key(a.session)===key(b.academicYear)) && (!a.term || key(a.term)===key(b.term))))
  const creditRows: {label:string; value:number|null}[] = sorted.map((b,i)=>({label:`Payment — ${b.feeType||'Fee'}`,value:values[i].paid})).filter(x=>x.value===null||x.value>0)
  for (const award of pending) {
   const sample = award.id.startsWith('sample-') ? 'Sample scholarship' : 'Scholarship'
   const periodLabel = `${award.term || 'term unspecified'} / ${award.session || 'year unspecified'}`
   creditRows.push({label:`${sample} (${award.type || 'Scholarship'}; ${periodLabel})`,value:cents(award.amount)})
  }
  const awardAmounts=pending.map(a=>cents(a.amount))
  const creditUnknown=unknown || awardAmounts.some(v=>v===null)
  const credits=paid+awardAmounts.reduce<number>((n,v)=>n+(v??0),0)
  // Scholarships never offset fees in a different year or term.
  const periodKey=(year: string,term: string)=>JSON.stringify([key(year),key(term)])
  const buckets=new Map<string,{debits:number;credits:number}>()
  for (let i=0;i<sorted.length;i++) {
   const bill=sorted[i], k=periodKey(bill.academicYear||'',bill.term||''), old=buckets.get(k)||{debits:0,credits:0}
   old.debits+=values[i].total??0;old.credits+=values[i].paid??0;buckets.set(k,old)
  }
  let badPeriod=false
  for (const award of pending) {
   if(!award.term || !award.session){badPeriod=true;continue}
   const bucket=buckets.get(periodKey(award.session,award.term))
   if(!bucket){badPeriod=true;continue}
   bucket.credits+=cents(award.amount)??0
  }
  const bucketValues=[...buckets.values()]
  const crossPeriodOffset=bucketValues.some(b=>b.credits>b.debits)&&bucketValues.some(b=>b.debits>b.credits)
  const ambiguous=creditUnknown || badPeriod || (pending.length>0 && sorted.some(b=>!b.term||!b.academicYear)) || crossPeriodOffset
  const adjustments=sorted.some(b=>['discount','discountAmount','scholarshipDiscount','fine','fineAmount'].some(k=>String(b[k]??'').trim()!=='' && cents(b[k])!==0))
  const displayDue=ambiguous||adjustments ? null : Math.max(0,total-credits)
  const surplus=displayDue===null?0:Math.max(0,credits-total)
  // Aggregate carried items into one debit without changing their underlying balances.
  const carried=sorted.map((bill,i)=>({bill,value:values[i]})).filter(x=>!!x.bill.carryForwardId)
  const debitRows: {label:string; value:number|null; periodLabel?:string}[] = []
  if(carried.length) debitRows.push({label:'Fees Arrest',value:carried.some(x=>x.value.total===null) ? null : carried.reduce((sum,x)=>sum+(x.value.total??0),0)})
  sorted.forEach((bill,i)=>{ if(!bill.carryForwardId) debitRows.push({label:bill.feeType||'Fee',value:values[i].total,periodLabel:periods.length>1?period(bill):undefined}) })
  const count=Math.max(debitRows.length,creditRows.length,1)
  const rows=Array.from({length:count},(_,i)=>{const debit=debitRows[i], credit=creditRows[i]; const extra=debit?.periodLabel ? `<small>${esc(debit.periodLabel)}</small>` : '';return `<tr><td class="serial">${debit?i+1:''}</td><td>${debit?esc(debit.label):''}${extra}</td><td class="number">${debit?esc(amount(debit.value)):''}</td><td>${credit?esc(credit.label):''}</td><td class="number">${credit?esc(amount(credit.value)):''}</td></tr>`}).join('')
  const logo=options.logo && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(options.logo) ? `<img class="logo" src="${esc(options.logo)}" alt="">` : ''
  const contact=[options.address,options.phone,options.email].filter(Boolean).map(esc).join(' &nbsp; | &nbsp; ')
  const heading=periods.length===1 ? `${esc(periods[0])} ACADEMIC PERIOD` : periods.length ? 'MULTIPLE ACADEMIC PERIODS' : 'ACADEMIC PERIOD NOT SPECIFIED'
  const accounts=(options.paymentAccounts??[]).filter(a=>key(a.status)==='active' && a.bankName?.trim() && a.accountName?.trim() && a.accountNumber?.trim())
  const matchingPeriods=[...new Map(sorted.filter(b=>b.academicYear&&b.term).map(b=>[periodKey(b.academicYear,b.term),{year:b.academicYear,term:b.term}])).values()]
  const dateInfo=matchingPeriods.map(p=>({p,dates:findStudentTermDates(options.studentTermDates??[],p.year,p.term)})).filter(x=>x.dates && (formatStudentTermDate(x.dates.vacationDate)||formatStudentTermDate(x.dates.nextTermBegins))).map(({p,dates})=>`<div>${matchingPeriods.length>1?`<strong>${esc(p.term)} · ${esc(p.year)}</strong><br>`:''}${formatStudentTermDate(dates!.vacationDate)?`Vacation Date: ${esc(formatStudentTermDate(dates!.vacationDate))}<br>`:''}${formatStudentTermDate(dates!.nextTermBegins)?`Next Term Begins: ${esc(formatStudentTermDate(dates!.nextTermBegins))}`:''}</div>`).join('')
  const paymentInfo=accounts.length?`<section class="payment-info"><strong>NOTE:</strong>${accounts.map(a=>{
   const sample=a.sample==='true' || a.id.startsWith('sample-payment-account-')
   const instructions=String(a.instructions??'').trim()
   const defaultSample=/^(example for testing only\.|example only — do not send money\.)$/i.test(instructions)
   return `<div class="account">${instructions && !(sample&&defaultSample) ? `<div>${esc(instructions).replace(/\n/g,'<br>')}</div>` : !sample ? `<div>Fees should be paid at ${esc(a.bankName)}.</div>` : ''}<div>Bank: ${esc(a.bankName)}</div>${a.bankBranch?.trim()?`<div>Branch: ${esc(a.bankBranch.trim())}</div>`:''}<div>Account Name: ${esc(a.accountName)}</div><div>Account Number: ${esc(a.accountNumber)}</div></div>`
  }).join('')}</section>`:''
  return `<article class="bill"><header>${logo}<div class="school"><h1>${esc(options.schoolName||options.branchName||'School')}</h1>${options.branchName&&options.branchName!==options.schoolName?`<div>${esc(options.branchName)}</div>`:''}${contact?`<div class="contact">${contact}</div>`:''}</div></header><h2>STUDENT BILL FOR ${heading}${accounts.some(a=>a.sample==='true' || a.id.startsWith('sample-payment-account-')) ? '<small>TEST BILL — PAYMENT DETAILS NOT REAL</small>' : ''}</h2>${options.printNotice?`<p class="note">${esc(options.printNotice)}</p>`:''}<div class="student"><div><strong>Student's Name :</strong> ${esc(inv.student.name||'Unknown student')}</div><div><strong>Class :</strong> ${esc(studentClass(inv.student,options.classes)||'—')}</div><div><strong>Register No :</strong> ${esc(inv.student.admissionNo||'—')}</div></div><table><colgroup><col style="width:6%"><col style="width:30%"><col style="width:14%"><col style="width:32%"><col style="width:18%"></colgroup><thead><tr><th rowspan="2">S/N</th><th colspan="2">DEBIT</th><th colspan="2">CREDIT${pending.length?'<small>Unposted scholarship; bill is an estimate. Account balance unchanged; eligibility unverified.</small>':''}</th></tr><tr><th>DETAILS</th><th>AMOUNT (${esc(options.currency||'GHS')})</th><th>DETAILS</th><th>AMOUNT (${esc(options.currency||'GHS')})</th></tr></thead><tbody>${rows}<tr class="totals"><td></td><td>TOTAL DEBIT</td><td class="number">${unknown?'Review':amount(total)}</td><td>TOTAL CREDIT</td><td class="number">${creditUnknown?'Review':amount(credits)}</td></tr></tbody></table><p class="due">Amount Due ${esc(options.currency||'GHS')} ${displayDue===null?'REVIEW REQUIRED':amount(displayDue)}</p>${surplus?`<p class="note">Estimated excess credit: ${esc(options.currency||'GHS')} ${amount(surplus)} (not posted or carried forward).</p>`:''}${unknown?'<p class="note">One or more balances cannot be verified. Review the fee records before payment.</p>':''}${sorted.some(b=>b.scholarshipAppliedAmount)?'<p class="note">Fee debits are net of applied scholarship credits; do not subtract them again.</p>':''}${paymentInfo}${dateInfo?`<section class="payment-info">${dateInfo}</section>`:''}</article>`
 }).join('')
 return `<!doctype html><html><head><meta charset="utf-8"><title>Student Bills</title><style>@page{size:A4;margin:14mm 16mm}*{box-sizing:border-box}body{margin:0;color:#111;background:#fff;font:12px Georgia,"Times New Roman",serif}.bill{break-after:page;page-break-after:always}.bill:last-child{break-after:auto;page-break-after:auto}header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:10px;min-height:70px}.logo{width:70px;height:64px;object-fit:contain}.school{flex:1;text-align:center}.school h1{font:700 21px Arial,sans-serif;margin:0 0 5px;text-transform:uppercase}.contact{font:11px Arial,sans-serif;margin-top:5px}h2{text-align:center;font-size:16px;margin:22px 0}.student{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin:20px 0 12px;font-size:13px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #111;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere}th{text-align:center}thead tr:nth-child(2) th{text-align:left}.number{text-align:right;font-variant-numeric:tabular-nums}.serial{text-align:center}.totals{font-weight:bold}small{display:block;font-size:9px;color:#444;margin-top:2px}.due{font-size:14px;font-weight:bold;margin:20px 0}.note{font-size:10px;margin-top:14px}.payment-info{margin-top:25px;font-size:12px;line-height:1.5}.payment-info .account{margin-top:5px;break-inside:avoid}tr{break-inside:avoid;page-break-inside:avoid}</style></head><body>${bills}</body></html>`
}
/** Print in an isolated document, avoiding app navigation, popups and unrelated page content. */
export function printStudentBills(html:string): boolean {
 const frame=document.createElement('iframe'); frame.setAttribute('title','Student bills print document'); frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0'; document.body.appendChild(frame)
 const win=frame.contentWindow, doc=frame.contentDocument
 if(!win || !doc){frame.remove();return false}
 doc.open();doc.write(html);doc.close()
 const cleanup=()=>{if(frame.isConnected)frame.remove()};win.addEventListener('afterprint',cleanup,{once:true})
 window.setTimeout(()=>{if(!frame.isConnected)return;win.focus();win.print()},250)
 window.setTimeout(cleanup,120000)
 return true
}
