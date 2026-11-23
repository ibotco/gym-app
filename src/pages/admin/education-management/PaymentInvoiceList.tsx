import { useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarCheck, Printer, RotateCcw, Search, Users, Wallet } from 'lucide-react'
import { Badge, Button, Input, PageHeader, Select, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useAuth } from '../../../context/AuthContext'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, type EduRecords } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { amountInWords } from '../../../lib/amountInWords'
import { makeFeeInvoicePrintHtml } from '../../../lib/feeInvoicePrint'
import { makeFeeInvoicePrintData } from '../../../lib/feeInvoicePrintData'
import { feeInvoiceForPayment } from '../../../lib/feeInvoicePrintSelection'
import { groupFeePaymentRows } from '../../../lib/feePaymentGrouping'
import { printStudentBills } from '../../../lib/feesBillPrint'

const norm=(x:unknown)=>String(x??'').trim().toLowerCase()
function cents(value:unknown):number|null {const s=String(value??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [whole,frac='']=s.split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null}
const display=(n:number|null)=>n===null?'Review':(n/100).toFixed(2)
const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
function rangeFor(type:string):{from:string;to:string} {
 const now=new Date(),year=now.getFullYear(),month=now.getMonth(),day=now.getDay()||7
 if(type==='today')return {from:localDate(now),to:localDate(now)}
 if(type==='this_week'){const start=new Date(year,month,now.getDate()-day+1),end=new Date(year,month,now.getDate()-day+7);return {from:localDate(start),to:localDate(end)}}
 if(type==='this_month')return {from:localDate(new Date(year,month,1)),to:localDate(new Date(year,month+1,0))}
 if(type==='this_quarter'){const start=Math.floor(month/3)*3;return {from:localDate(new Date(year,start,1)),to:localDate(new Date(year,start+3,0))}}
 if(type==='this_year')return {from:`${year}-01-01`,to:`${year}-12-31`}
 if(type==='last_year')return {from:`${year-1}-01-01`,to:`${year-1}-12-31`}
 return {from:'',to:''}
}
const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
export function PaymentInvoiceList(){
 const {user}=useAuth()
 const {activeBranchId,branches,activeCompany,company,accounts}=useApp(),branchName=branches.find(b=>b.id===activeBranchId)?.name??'',{toast}=useToast()
 const [records,setRecords]=useState<EduRecords>(()=>loadEduRecords(activeBranchId,branchName))
 const [searchType,setSearchType]=useState('all'),[query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[method,setMethod]=useState('')
 const [applied,setApplied]=useState({query:'',from:'',to:'',method:''})
 const [selected,setSelected]=useState<Set<string>>(()=>new Set()),[expanded,setExpanded]=useState<Set<string>>(()=>new Set()),[showBulk,setShowBulk]=useState(false)
 useEffect(()=>{const refresh=()=>setRecords(loadEduRecords(activeBranchId,branchName));refresh();setSearchType('all');setQuery('');setFrom('');setTo('');setMethod('');setApplied({query:'',from:'',to:'',method:''});setSelected(new Set());setExpanded(new Set());setShowBulk(false);const unsub=subscribeDbHydrated(refresh);window.addEventListener('focus',refresh);return()=>{unsub();window.removeEventListener('focus',refresh)}},[activeBranchId,branchName])
 const rows=useMemo(()=>(records.feesInvoicePayments??[]).map(p=>{
  const bill=(records.studentBilling??[]).find(b=>b.id===p.billingId)
  const matches=p.studentId?(records.studentList??[]).filter(s=>s.id===p.studentId):p.admissionNo?(records.studentList??[]).filter(s=>norm(s.admissionNo)===norm(p.admissionNo)):[]
  const student=matches.length===1?matches[0]:undefined
  return {p,name:p.studentName||p.student||student?.name||'Not recorded',admission:p.admissionNo||student?.admissionNo||'',className:p.className||'',group:p.feeGroupName||bill?.feeGroupName||'',period:[p.academicYear,p.term].filter(Boolean).join(' / ')}
 }).sort((a,b)=>String(b.p.paidAt??'').localeCompare(String(a.p.paidAt??''))||String(b.p.recordedAt??'').localeCompare(String(a.p.recordedAt??''))||a.p.id.localeCompare(b.p.id)),[records])
 const groups=useMemo(()=>groupFeePaymentRows(rows),[rows])
 const methods=[...new Set(rows.map(r=>r.p.paymentMethod).filter(Boolean))].sort()
 const filtered=useMemo(()=>groups.filter(r=>r.items.some(({p,name,admission,group,period,className})=>{const date=String(p.paidAt??'').slice(0,10);return (!applied.from||date>=applied.from)&&(!applied.to||date<=applied.to)&&(!applied.method||p.paymentMethod===applied.method)&&norm([name,admission,className,group,period,p.feeType,p.paymentMethod,p.reference,p.voucherNumber,p.paymentNumber,p.id].join(' ')).includes(norm(applied.query))})),[groups,applied])
 const values=(r:typeof groups[number],fn:(x:typeof rows[number])=>unknown)=>[...new Set(r.items.map(x=>String(fn(x)||'').trim()).filter(Boolean))]
 const joined=(r:typeof groups[number],fn:(x:typeof rows[number])=>unknown)=>values(r,fn).join(', ')||'—'
 const dateLabel=(r:typeof groups[number])=>joined(r,x=>String(x.p.paidAt??'').slice(0,10))
 const paymentLabel=(r:typeof groups[number])=>joined(r,x=>x.p.paymentNumber||x.p.id)

 const currency=activeCompany?.currency||company.currency||'GHS'
 const validAmounts=rows.map(r=>cents(r.p.amount)),invalidCount=validAmounts.filter(n=>n===null).length
 const amountSum=validAmounts.reduce<number>((sum,n)=>sum+(n??0),0),today=localDate(new Date()),todayValues=rows.filter(r=>String(r.p.paidAt??'').slice(0,10)===today).map(r=>cents(r.p.amount)),todayTotal=todayValues.reduce<number>((n,v)=>n+(v??0),0)
 const totalLabel=invalidCount||!Number.isSafeInteger(amountSum)?'Review amounts':`${currency} ${display(amountSum)}`
 const todayLabel=todayValues.some(v=>v===null)||!Number.isSafeInteger(todayTotal)?'Review amounts':`${currency} ${display(todayTotal)}`
 const students=new Set(rows.map(r=>r.p.studentId?`id:${r.p.studentId}`:r.p.admissionNo?`reg:${norm(r.p.admissionNo)}`:'').filter(Boolean))
 const sumCards=[{label:'Total Payments',value:String(groups.length),icon:<Wallet className="size-5"/>,tint:'text-emerald-600 bg-emerald-500/10'},{label:'Total Amount Received',value:totalLabel,icon:<Banknote className="size-5"/>,tint:'text-emerald-600 bg-emerald-500/10'},{label:'Students with Payments',value:String(students.size),icon:<Users className="size-5"/>,tint:'text-amber-600 bg-amber-500/10'},{label:"Today's Collections",value:todayLabel,icon:<CalendarCheck className="size-5"/>,tint:'text-sky-600 bg-sky-500/10'}]
 const receipt=(item:typeof groups[number])=>{
  const latest=loadEduRecords(activeBranchId,branchName), invoices=new Map<string,{student:NonNullable<ReturnType<typeof feeInvoiceForPayment>['student']>;bills:ReturnType<typeof feeInvoiceForPayment>['bills']}>()
  let studentId=''
  for(const row of item.items){const found=(latest.feesInvoicePayments??[]).filter(p=>p.id===row.p.id);if(found.length!==1){toast('A grouped payment is missing or duplicated. Review before printing.','info');return}const resolved=feeInvoiceForPayment(found[0],latest);if(!resolved.student){toast(resolved.error,'info');return}if(studentId&&studentId!==resolved.student.id){toast('Grouped payments resolve to different students. Review before printing.','info');return}studentId=resolved.student.id;const key=JSON.stringify(resolved.bills.map(b=>b.id).sort());invoices.set(key,{student:resolved.student,bills:resolved.bills})}
  const docs=[...invoices.values()].map(invoice=>{const printData=makeFeeInvoicePrintData(invoice.student,invoice.bills,latest.classList??[],latest.feeGroups??[],latest.feeTypes??[],accounts,branchName,latest.feesInvoicePayments??[]);return makeFeeInvoicePrintHtml({...printData,paidWords:amountInWords(printData.paid,currency),accountantName:user?.name||''})})
  if(!docs.length){toast('No invoice found for this payment.','info');return}
  const html=docs.length===1?docs[0]:docs[0].replace('</style>','main{break-after:page;page-break-after:always}main:last-child{break-after:auto;page-break-after:auto}</style>').replace(/<body>[\s\S]*<\/body>/,()=>`<body>${docs.map(doc=>doc.match(/<body>([\s\S]*)<\/body>/)?.[1]||'').join('')}</body>`)
  if(!printStudentBills(html))toast('Could not open the invoice','info')
 }
 const exportRows=filtered.map((r,i)=>({'S/N':i+1,Date:dateLabel(r),'Voucher Number':r.voucher||'—',Student:r.name,'Register No':r.admission,'Academic Period':joined(r,x=>x.period),Method:joined(r,x=>x.p.paymentMethod),Account:joined(r,x=>x.p.account),Amount:display(r.totalCents)}))
 const printList=(selection?:Set<string>)=>{const printed=selection ? exportRows.filter((_,i)=>selection.has(filtered[i].groupKey)) : exportRows;const headings=['S/N','Date','Voucher Number','Student','Register No','Academic Period','Method','Account','Amount'];const html=`<!doctype html><html><head><meta charset="utf-8"><title>Payment of Invoice List</title><style>@page{size:landscape;margin:12mm}body{font:11px Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;text-align:left;padding:5px}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>Payment of Invoice List</h1><p>${escapeHtml(branchName)} · ${escapeHtml(currency)}</p><table><thead><tr>${headings.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${printed.map(r=>`<tr>${headings.map(h=>`<td>${escapeHtml(r[h as keyof typeof r])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;if(!printStudentBills(html))toast('Could not open the payment list','info')}
 type Row=typeof groups[number]
 const allSelected=filtered.length>0&&filtered.every(r=>selected.has(r.groupKey))
 const columns:Column<Row>[]=[
  {key:'select',header:<input type="checkbox" aria-label="Select all payments" checked={allSelected} onChange={e=>setSelected(e.target.checked?new Set(filtered.map(r=>r.groupKey)):new Set())}/>,render:r=><input type="checkbox" aria-label={`Select ${r.p.paymentNumber||r.p.id}`} checked={selected.has(r.groupKey)} onChange={e=>{const checked=e.target.checked;setSelected(current=>{const next=new Set(current);if(checked)next.add(r.groupKey);else next.delete(r.groupKey);return next})}}/>} ,
  {key:'sn',header:'S/N',render:(_,i)=>i+1},
  {key:'date',header:'Date',sortValue:r=>r.p.paidAt||'',render:r=>dateLabel(r)},
  {key:'voucher',header:'Voucher Number',sortValue:r=>r.voucher,render:r=><span className="font-mono text-sm font-semibold">{r.voucher||'—'}</span>},
  {key:'student',header:'Student',sortValue:r=>r.name,render:r=><span className="font-semibold">{r.name}</span>},
  {key:'admission',header:'Register No',sortValue:r=>r.admission,render:r=>r.admission||'—'},
  {key:'period',header:'Academic Period',sortValue:r=>joined(r,x=>x.period),render:r=>joined(r,x=>x.period)},
  {key:'method',header:'Method',sortValue:r=>r.p.paymentMethod||'',render:r=><Badge tone="zinc">{joined(r,x=>x.p.paymentMethod)}</Badge>},
  {key:'account',header:'Account',sortValue:r=>r.p.account||'',render:r=>joined(r,x=>x.p.account)},
  {key:'amount',header:'Amount',sortValue:r=>r.totalCents??-1,render:r=><span className="font-semibold">{currency} {display(r.totalCents)}</span>},
  {key:'action',header:'Action',render:r=><Button size="sm" variant="outline" onClick={()=>receipt(r)}><Printer className="size-4"/> Print Fee Payment Receipt</Button>},
 ]
 const onType=(value:string)=>{setSearchType(value);if(value!=='custom'){const range=rangeFor(value);setFrom(range.from);setTo(range.to)}}
 const reset=()=>{setSearchType('all');setQuery('');setFrom('');setTo('');setMethod('');setApplied({query:'',from:'',to:'',method:''});setSelected(new Set());setShowBulk(false)}
 const applySearch=()=>{setApplied({query,from,to,method});setSelected(new Set());setShowBulk(false)}
 return <div><PageHeader title="Payment of Invoice List" desc="Fee payments recorded through Fees Pay / Invoice" actions={<ExportButtons filename="fee-invoice-payments" rows={exportRows} onPdf={()=>printList()} onDone={(label,ok)=>toast(ok?`${label} export started`:'Export blocked',ok?'success':'error')}/>}/>
  <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{sumCards.map(c=><div key={c.label} className="card flex items-center gap-3 p-4"><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${c.tint}`}>{c.icon}</div><div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-wider text-mist">{c.label}</p><p className="stat-num mt-0.5 truncate text-xl md:text-2xl">{c.value}</p></div></div>)}</div>
  <div className="card mb-4 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><div><label className="mb-1 block text-xs font-semibold text-mist" htmlFor="payment-search-type">Search Type</label><Select id="payment-search-type" value={searchType} onChange={e=>onType(e.target.value)}><option value="all">All dates</option><option value="today">Today</option><option value="this_week">This Week</option><option value="this_month">This Month</option><option value="this_quarter">This Quarter</option><option value="this_year">This Year</option><option value="last_year">Last Year</option><option value="custom">Custom Date Range</option></Select></div><div><label className="mb-1 block text-xs font-semibold text-mist">Start Date</label><DatePicker value={from} onChange={v=>{setFrom(v);setSearchType('custom')}}/></div><div><label className="mb-1 block text-xs font-semibold text-mist">End Date</label><DatePicker value={to} onChange={v=>{setTo(v);setSearchType('custom')}}/></div><div><label className="mb-1 block text-xs font-semibold text-mist" htmlFor="payment-method-filter">Payment Method</label><Select id="payment-method-filter" value={method} onChange={e=>setMethod(e.target.value)}><option value="">All methods</option>{methods.map(m=><option key={m}>{m}</option>)}</Select></div><div><label className="mb-1 block text-xs font-semibold text-mist" htmlFor="payment-search">Search</label><Input id="payment-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Student, fee, voucher or payment ID" onKeyDown={e=>{if(e.key==='Enter'&&(!from||!to||from<=to))applySearch()}}/></div><div className="flex items-end gap-2"><Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={applySearch} disabled={!!from&&!!to&&from>to}><Search className="size-4"/> Search</Button><Button variant="outline" onClick={reset} title="Reset filters" aria-label="Reset filters"><RotateCcw className="size-4"/></Button></div></div>{from&&to&&from>to&&<p role="alert" className="mt-3 text-sm text-red-600">The start date is after the end date.</p>}</div>
  <div className="card"><div className="flex items-center justify-between px-4 py-3"><p className="text-sm font-semibold">Fee Payment List <span className="ml-1 text-xs font-normal text-mist">({filtered.length} records)</span></p><div className="flex items-center gap-2"><div className="relative"><Button variant="outline" size="sm" disabled={!selected.size} onClick={()=>setShowBulk(v=>!v)}>Bulk Actions{selected.size?` (${selected.size})`:''}</Button>{showBulk&&selected.size>0&&<div className="menu-pop absolute right-0 top-full z-30 mt-1 w-44 rounded-xl p-1.5"><button type="button" className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={()=>{printList(selected);setShowBulk(false)}}><Printer className="size-4"/> Print List</button></div>}</div><Button variant="ghost" size="sm" onClick={reset}>Show all</Button></div></div><DataTable columns={columns} data={filtered} rowKey={r=>r.groupKey} emptyTitle="No fee payments found" emptyDesc="No recorded fee payments match the applied filters." expandable={{isExpanded:r=>expanded.has(r.groupKey),onToggle:r=>setExpanded(current=>{const next=new Set(current);if(next.has(r.groupKey))next.delete(r.groupKey);else next.add(r.groupKey);return next}),label:r=>r.p.paymentNumber||r.p.id,render:r=><div className="px-4 py-2 text-sm"><div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{gridAutoRows:"max-content",rowGap:4,columnGap:12,alignContent:"start"}}>{[['Student',r.name],['Payment IDs',paymentLabel(r)],['Voucher number',r.p.voucherNumber||r.p.reference||'—'],['Fee group',joined(r,x=>x.group)],['Academic period',joined(r,x=>x.period)],['Payment method',joined(r,x=>x.p.paymentMethod)],['Account',joined(r,x=>x.p.account)],['Remarks',r.p.remarks||'—']].map(([label,value])=><div key={label}><div className="text-xs text-mist">{label}</div><div className="font-semibold">{value}</div></div>)}</div><div className="mt-2"><div className="text-xs text-mist">Item allocations</div>{r.items.map((x,i)=><div key={`${x.p.id}-${i}`} className="mt-1">{x.p.feeType||'Fee'} · {x.period||'Period not recorded'} · {x.p.paymentNumber||x.p.id} · {currency} {display(cents(x.p.amount))} · {String(x.p.paidAt||'').slice(0,10)||'—'}</div>)}</div></div>}}/><p className="px-4 pb-4 text-xs text-mist">Rows group allocations by voucher for the same student, including different academic periods and fee groups; missing vouchers or identity details remain separate. A filter matching any allocation shows its whole group. Summary cards cover all recorded branch payments, regardless of filters; they do not confirm bank transfers or accounting posting. Older payments may lack period snapshots. Payment numbers are browser-generated and may collide across sessions. The receipt action prints each current invoice represented by the grouped payment.</p></div>
 </div>
}
