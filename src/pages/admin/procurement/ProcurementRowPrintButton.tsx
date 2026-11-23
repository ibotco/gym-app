import { Printer } from 'lucide-react'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { makeSalesRowPrint } from '../../../lib/salesRowPrint'
import { printStudentBills } from '../../../lib/feesBillPrint'
import type { PurchaseRequisition, ProcPurchaseOrder, GoodsReceipt, SupplierInvoice, SupplierPayment, ProcPurchaseReturn } from '../../../types'

type Props = {kind:'requisition';record:PurchaseRequisition} | {kind:'order';record:ProcPurchaseOrder} | {kind:'receipt';record:GoodsReceipt} | {kind:'invoice';record:SupplierInvoice} | {kind:'payment';record:SupplierPayment} | {kind:'return';record:ProcPurchaseReturn}
export function ProcurementRowPrintButton(props:Props) {
 const {company,activeCompanyId,inventory,suppliers,branches,procPurchaseOrders,goodsReceipts,supplierInvoices,accounts}=useApp(),toast=useToast()
 const print=()=>{
  const r=props.record
  if(r.companyId&&r.companyId!==activeCompanyId){toast.error('Switch to the record’s company before printing');return}
  const item=(id:string)=>inventory.find(x=>x.id===id)?.name||id||'Not recorded'
  const supplier=(id:string)=>suppliers.find(x=>x.id===id)?.name||id||'Not recorded'
  const po=(id?:string)=>id?(procPurchaseOrders.find(x=>x.id===id)?.number||'Not found'):'Not linked'
  const grn=(id?:string)=>id?(goodsReceipts.find(x=>x.id===id)?.number||'Not found'):'Not linked'
  const warehouse=(id?:string)=>id?(branches.find(x=>x.id===id)?.name||id):'Not recorded'
  const shared={company:company.name,address:company.address,currency:company.currency||'GHS'}
  const net=(qty:number,cost:number,disc?:number)=>Number.isFinite(qty)&&Number.isFinite(cost)?Math.max(0,qty*cost*(1-(disc||0)/100)):NaN
  let html:string
  if(props.kind==='requisition'){
   const x=props.record
   html=makeSalesRowPrint({...shared,title:'Purchase requisition',number:x.number,status:x.status,date:x.date,secondDateLabel:'Required',secondDate:x.requiredDate,fields:[['Requested by',x.requestedBy||'Not recorded'],['Department',x.department||'Not recorded'],['Warehouse',warehouse(x.warehouseId)],['Rejection reason',x.rejectedReason||'Not recorded']],items:x.lines.map(l=>({desc:l.description||item(l.itemId),qty:l.quantity,unitPrice:l.estimatedCost,amount:l.estimatedCost==null?NaN:net(l.quantity,l.estimatedCost)})),notes:x.notes})
  }else if(props.kind==='order'){
   const x=props.record
   html=makeSalesRowPrint({...shared,currency:x.currency||shared.currency,title:'Purchase order',number:x.number,status:x.status,date:x.date,secondDateLabel:'Required',secondDate:x.requiredDate,fields:[['Supplier',supplier(x.supplierId)],['Warehouse',warehouse(x.warehouseId)],['Department',x.department||'Not recorded'],['Payment terms',x.paymentTerms||'Not recorded']],items:x.lines.map(l=>({desc:`${l.description||item(l.itemId)}${l.discountPercent?` (discount ${l.discountPercent}%)`:''}${l.taxRate?` (tax ${l.taxRate}%)`:''}`,qty:l.quantity,unitPrice:l.unitCost,amount:net(l.quantity,l.unitCost,l.discountPercent)})),subtotal:x.subtotal,discountValue:x.discountTotal,taxAmount:x.taxTotal,total:x.total,notes:x.notes})
  }else if(props.kind==='receipt'){
   const x=props.record
   html=makeSalesRowPrint({...shared,title:'Goods receipt (GRN)',number:x.number,status:x.status,date:x.date,fields:[['Supplier',supplier(x.supplierId)],['Purchase order',po(x.purchaseOrderId)],['Warehouse',warehouse(x.warehouseId)],['Delivery note',x.deliveryNoteNumber||'Not recorded'],['Received by',x.receivedBy||'Not recorded'],['Posted at',x.postedAt||'Not posted']],items:x.lines.map(l=>({desc:`${item(l.itemId)} — ordered: ${l.quantityOrdered}; rejected: ${l.quantityRejected??0}${l.batchNumber?`; batch: ${l.batchNumber}`:''}${l.expiryDate?`; expiry: ${l.expiryDate}`:''}`,qty:l.quantityReceiving,unitPrice:l.unitCost,amount:net(l.quantityReceiving,l.unitCost)})),total:x.total,notes:x.remarks})
  }else if(props.kind==='invoice'){
   const x=props.record
   html=makeSalesRowPrint({...shared,currency:x.currency||shared.currency,title:'Purchase invoice',number:x.number,status:x.status,date:x.invoiceDate,secondDateLabel:'Due',secondDate:x.dueDate,fields:[['Supplier',supplier(x.supplierId)],['Purchase order',po(x.purchaseOrderId)],['Goods receipt',grn(x.goodsReceiptId)],['Posted at',x.postedAt||'Not posted'],['Expense subtotal',x.expenseSubtotal==null?'Not recorded':`${x.currency||shared.currency} ${x.expenseSubtotal.toFixed(2)}`]],items:[...x.lines.map(l=>({desc:`${l.description||item(l.itemId)}${l.discountPercent?` (discount ${l.discountPercent}%)`:''}${l.taxRate?` (tax ${l.taxRate}%)`:''}`,qty:l.quantity,unitPrice:l.unitCost,amount:net(l.quantity,l.unitCost,l.discountPercent)})),...(x.expenseLines||[]).map(l=>({desc:`Expense: ${l.description||accounts.find(a=>a.id===l.accountId)?.name||l.accountId}${l.taxRate?` (tax ${l.taxRate}%)`:''}`,qty:1,unitPrice:l.amount,amount:l.amount}))],subtotal:x.subtotal,discountValue:x.orderDiscount,taxAmount:x.taxTotal,total:x.total,notes:x.notes})
  }else if(props.kind==='payment'){
   const x=props.record,alloc=x.allocations?.length?x.allocations:(x.supplierInvoiceId?[{supplierInvoiceId:x.supplierInvoiceId,amount:x.amount}]:[])
   html=makeSalesRowPrint({...shared,title:x.status==='posted'?'Supplier payment':'Supplier payment record',number:x.number,status:x.status,date:x.paymentDate,fields:[['Supplier',supplier(x.supplierId)],['Method',x.method||'Not recorded'],['Account',accounts.find(a=>a.id===x.accountId)?.name||'Not recorded'],['Reference',x.reference||'Not recorded'],['Posted at',x.postedAt||'Not posted'],...alloc.map(a=>[`Invoice allocation: ${supplierInvoices.find(i=>i.id===a.supplierInvoiceId)?.number||a.supplierInvoiceId}`,`${shared.currency} ${Number(a.amount).toFixed(2)}`] as [string,string])],total:x.amount,amountLabel:'Payment amount',notes:x.notes})
  }else{
   const x=props.record
   html=makeSalesRowPrint({...shared,title:'Purchase return',number:x.number,status:x.status,date:x.returnDate,fields:[['Supplier',supplier(x.supplierId)],['Goods receipt',grn(x.goodsReceiptId)],['Reason',x.reason||'Not recorded'],['Posted at',x.postedAt||'Not posted']],items:x.lines.map(l=>({desc:`${item(l.itemId)} — received: ${l.quantityReceived}${l.batchNumber?`; batch: ${l.batchNumber}`:''}`,qty:l.quantityReturned,unitPrice:l.unitCost,amount:net(l.quantityReturned,l.unitCost)})),total:x.total,notes:x.notes})
  }
  if(!printStudentBills(html))toast.error('Could not open the print document')
 }
 return <button type="button" className="rounded-lg p-2 text-mist hover:text-inherit" title="Print" aria-label="Print" onClick={print}><Printer className="size-4"/></button>
}
