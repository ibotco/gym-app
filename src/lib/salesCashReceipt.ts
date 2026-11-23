import type { Account, AccountHistoryEntry, AccountingSettings, Invoice, Payment, ReceiptVoucher, VoucherMethod } from '../types'
/** Browser-generated serial; simultaneous sessions can still pick the same number. */
export function nextSalesReceiptNumber(records:readonly {number?:string}[], prefix='SALE-'):string {
 let max=0
 for (const record of records) {
  const number=record.number || ''; const match=number.startsWith(prefix) ? /^(\d+)$/.exec(number.slice(prefix.length)) : null
  if (match) { const n=Number(match[1]); if(Number.isSafeInteger(n) && n>=0) max=Math.max(max,n) }
 }
 if (max>=Number.MAX_SAFE_INTEGER) throw new Error('Sales receipt numbering is exhausted; review existing numbers.')
 return `${prefix}${String(max+1).padStart(4,'0')}`
}
/** Client-coordinated receipt generation. This is NOT an atomic transaction,
 * server authorization or cross-session exactly-once guarantee. */
export function planSalesCashReceipt(input:{payment:Payment;invoice:Invoice;settings:AccountingSettings;accounts:Account[];cashAccountIds:readonly string[];receipts:ReceiptVoucher[];accountHistory:AccountHistoryEntry[];payer:string;actorId:string;currency:string;accountingAvailable:boolean;receiptPrefix?:string}):{receipt:ReceiptVoucher|null;error:string} {
 const {payment:p,invoice:i,settings:s,accounts,receipts}=input
 const fail=(error:string)=>({receipt:null,error})
 if(!input.accountingAvailable)return fail('Accounting is not enabled for this company and package.')
 if(s.accountingMethod!=='cash')return fail('Only cash-basis sales receipts are supported; review this payment manually.')
 if(!s.autoPost || !s.autoMapping?.enabled)return fail('Automatic accounting or automatic mapping is disabled.')
 if(s.closeTheBooks)return fail('The books are closed; review the payment with an accountant.')
 if(input.accountHistory.some(h=>h.relType==='invoice' && h.relId===i.id))return fail('An invoice accounting entry already exists; review it to avoid recognising income twice.')
 const sale=s.autoMapping.lines?.['payment.sales'], revenue=s.autoMapping.lines?.['invoice.default']
 if(!sale?.enabled || !revenue?.enabled)return fail('Enable the sales-payment and invoice mappings in Accounting settings.')
 const cashId=String(sale.depositToAccountId||''),incomeId=String(revenue.paymentAccountId||'')
 const cash=accounts.filter(a=>a.id===cashId),income=accounts.filter(a=>a.id===incomeId)
 if(cash.length!==1 || cash[0].status==='inactive' || !input.cashAccountIds.includes(cashId))return fail('The sales-payment deposit account must be an active cash or bank account.')
 if(income.length!==1 || income[0].status==='inactive' || income[0].type!=='income' || incomeId===cashId)return fail('The invoice revenue mapping must be a different active income account.')
 if(p.status!=='paid'||p.invoiceId!==i.id||i.status==='cancelled'||!p.id||!i.id)return fail('The invoice payment is not eligible for accounting posting.')
 const cents=Math.round(p.amount*100)
 if(!Number.isFinite(p.amount)||!Number.isSafeInteger(cents)||cents<=0||Math.abs(p.amount*100-cents)>1e-7)return fail('The payment amount must be positive and have at most two decimal places.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||Number.isNaN(Date.parse(`${p.date}T00:00:00Z`))||new Date(`${p.date}T00:00:00Z`).toISOString().slice(0,10)!==p.date)return fail('The payment date is invalid.')
 // Tax cannot safely be credited entirely to sales income; partial settlements
 // require a separate tax-allocation policy which is not implemented here.
 if(Number(i.taxAmount||0)!==0 || Number(i.taxRate||0)!==0 || (i.taxes||[]).some(t=>Number(t.rate||0)!==0) || (i.items||[]).some(item=>Number(item.taxTotal||0)!==0 || (item.taxes||[]).some(t=>Number(t.rate||0)!==0||Number(t.amount||0)!==0))) return fail('This invoice includes tax; review and post it manually so tax is allocated correctly.')
 const methods:Record<string,VoucherMethod>={cash:'cash'}
 const method=methods[p.method];if(!method)return fail('This payment method needs an accounting settlement account; post it manually.')
 if(!input.payer.trim())return fail('The payment customer could not be identified.')
 const receiptId=`sales_payment_receipt_${p.id}`
 if(receipts.some(r=>r.id===receiptId||r.sourceSalesPaymentId===p.id))return fail('A linked receipt already exists; review it to avoid a duplicate.')
 let number:string
 try { number=nextSalesReceiptNumber([...receipts,...input.accountHistory],input.receiptPrefix || 'SALE-') } catch { return fail('Sales receipt numbering is exhausted; review existing numbers.') }
 const amount=cents/100
 return {error:'',receipt:{id:receiptId,sourceSalesPaymentId:p.id,companyId:p.companyId,branchId:p.branchId,number,date:p.date,receivedFrom:input.payer.trim(),stakeholderClass:'customer',depositAccountId:cashId,lines:[{accountId:incomeId,narration:`Sales invoice ${i.number}; payment ${p.id}`,amount}],amount,method,referenceNo:p.reference||p.id,currency:input.currency,description:`Sales invoice ${i.number}; payment ${p.id}`,status:'posted',createdBy:input.actorId||undefined,createdAt:new Date().toISOString()}}
}
