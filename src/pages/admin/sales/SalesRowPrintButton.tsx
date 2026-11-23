import { Printer } from 'lucide-react'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { printStudentBills } from '../../../lib/feesBillPrint'
import { invoicePrintItems, invoicePrintUsesDefaults } from '../../../lib/invoicePrintItems'
import { makeSalesRowPrint } from '../../../lib/salesRowPrint'
import { secondDateOf, type QuoteDoc, type QuoteKind } from '../QuoteEditor'
import type { Invoice, Payment, Shipment, SalesReturn, Discount } from '../../../types'

type Props = {kind:'quote';record:QuoteDoc;quoteKind:QuoteKind;customer:string} | {kind:'invoice';record:Invoice;customer:string} | {kind:'payment';record:Payment;customer:string} | {kind:'shipment';record:Shipment;customer:string} | {kind:'return';record:SalesReturn;customer:string} | {kind:'discount';record:Discount}
export function SalesRowPrintButton(props:Props) {
 const {company,activeCompanyId,invoices,receipts,inventory,sales,salesOrders}=useApp(),toast=useToast()
 const print=()=>{
  const rec=props.record
  if(rec.companyId && rec.companyId!==activeCompanyId){toast.error('Switch to the record’s company before printing','This prevents printing the wrong company details.');return}
  const shared={company:company.name,address:company.address,currency:company.currency||'GHS',...(props.kind!=='discount'?{customer:props.customer}:{})}
  let html:string
  if(props.kind==='quote'){
   const record=props.record,title=props.quoteKind==='estimate'?'Estimate':props.quoteKind==='proposal'?'Proposal':'Sales order'
   html=makeSalesRowPrint({...shared,title,number:record.number,status:record.status,date:record.date,secondDateLabel:props.quoteKind==='salesorder'?'Expected':'Valid until',secondDate:secondDateOf(record),items:record.items,subtotal:record.subtotal,discountValue:record.discountValue,taxAmount:record.taxAmount,taxName:record.taxName,total:record.total,notes:record.notes})
  }else if(props.kind==='invoice'){
   const record=props.record
   html=makeSalesRowPrint({...shared,title:'Invoice',number:record.number,status:record.status,date:record.issuedAt,secondDateLabel:'Due',secondDate:record.dueAt,items:invoicePrintItems(record),itemDefaults:invoicePrintUsesDefaults(record),subtotal:record.subtotal,discountValue:record.discountValue,taxAmount:record.taxAmount,taxName:record.taxName,total:record.total,notes:record.notes})
  }else if(props.kind==='shipment'){
   const r=props.record,order=salesOrders.find(o=>o.id===r.salesOrderId)
   html=makeSalesRowPrint({...shared,title:'Shipment',number:r.number,status:r.status,date:r.date,secondDateLabel:'Estimated delivery',secondDate:r.deliveryDate,fields:[['Sales order',order?.number||(r.salesOrderId?'Not found':'Not linked')],['Carrier',r.carrier||'Not recorded'],['Tracking number',r.trackingNumber||'Not recorded']],items:r.items.map(i=>({...i,qty:i.qty??1,unitPrice:i.unitPrice??i.amount})),itemDefaults:r.items.some(i=>i.qty==null||i.unitPrice==null),total:r.total,notes:r.notes})
  }else if(props.kind==='return'){
   const r=props.record,sale=sales.find(s=>s.id===r.saleId)
   html=makeSalesRowPrint({...shared,title:'Sales return',number:r.number,status:r.status,date:r.date,fields:[['Sale',sale?.number||(r.saleId?'Not found':'Not linked')],['Reason',r.reason||'Not recorded']],items:r.lines.map(l=>({desc:inventory.find(i=>i.id===l.itemId)?.name||`Item ${l.itemId}`,qty:l.quantity,unitPrice:l.unitPrice,discount:l.discount,amount:Math.max(0,l.quantity*l.unitPrice-(l.discount||0))})),total:r.total,amountLabel:'Return total'})
  }else if(props.kind==='discount'){
   const d=props.record,cur=shared.currency,fmt=(n:number|undefined)=>n==null?'Not recorded':`${cur} ${Number(n).toFixed(2)}`
   html=makeSalesRowPrint({...shared,title:'Discount',number:d.code||d.name,status:d.status,date:d.startsAt,secondDateLabel:'Expires',secondDate:d.expiresAt,fields:[['Name',d.name],['Type',d.type],['Value',d.type==='percentage'?`${d.value}%`:fmt(d.value)],['Group',d.group||'general'],['Product',d.productId?(inventory.find(i=>i.id===d.productId)?.name||'Not found'):'Not assigned'],['Applies to',d.appliesTo||'Not recorded'],['Minimum spend',fmt(d.minSpend)],['Maximum discount',fmt(d.maxDiscount)],['Used',String(d.used??'Not recorded')],['Usage limit',d.usageLimit?String(d.usageLimit):'Unlimited'],['Per-customer limit',d.perCustomerLimit?String(d.perCustomerLimit):'Not recorded']]})
  }else{
   const record=props.record,links=invoices.filter(i=>i.id===record.invoiceId),accounting=receipts.filter(r=>r.sourceSalesPaymentId===record.id)
   const invoice=links.length===1?links[0]:undefined,receipt=accounting.length===1?accounting[0]:undefined
   html=makeSalesRowPrint({...shared,title:record.status==='paid'?'Payment receipt':'Payment record',number:receipt?.number||record.id,status:record.status,date:record.date,fields:[['Payment ID',record.id],['Invoice',invoice?.number||(record.invoiceId?'Not found or ambiguous':'Not linked')],['Method',record.method||'Not recorded'],['Reference',record.reference||'Not recorded']],total:record.amount,amountLabel:record.status==='paid'?'Recorded amount paid':'Payment amount',notes:record.description})
  }
  if(!printStudentBills(html))toast.error('Could not open the print document')
 }
 return <button type="button" className="rounded-lg p-2 text-mist hover:text-inherit" title="Print" aria-label="Print" onClick={print}><Printer className="size-4"/></button>
}
