import type { Account, AccountingSettings, ReceiptVoucher, VoucherMethod } from '../types'
import type { EduRow } from './eduRecords'
/** Browser-coordinated only; no atomicity or cross-session exactly-once guarantee. */
export function planFeeReceipt(input:{payment:EduRow;bill:EduRow;feeTypes:EduRow[];accounts:Account[];cashAccountIds:string[];receipts:ReceiptVoucher[];settings:AccountingSettings;enabled:boolean;accountingAvailable:boolean;companyId:string;branchId:string;payer:string;actorId:string;currency:string}):{receipt:ReceiptVoucher|null;error:string} {
 const fail=(error:string)=>({receipt:null,error})
 const {payment:p,bill,accounts}=input
 if(!input.accountingAvailable)return fail('Accounting is not available for this company or package.')
 if(!input.enabled)return fail('Fee Integration is switched off.')
 if(input.settings.closeTheBooks)return fail('Books are closed; review this payment with an accountant.')
 if(!p.id||p.billingId!==bill.id||!input.companyId||!input.branchId||!input.payer.trim())return fail('Payment, bill, payer or company details are missing.')
 const typeId=String(bill.feeTypeId||'').trim(),name=String(bill.feeType||'').trim().toLowerCase()
 const types=input.feeTypes.filter(t=>typeId?t.id===typeId:!!name&&String(t.name||'').trim().toLowerCase()===name)
 if(types.length!==1)return fail('Fee type is missing or ambiguous; review Fees Mapping.')
 const cashId=String(p.accountId||'').trim(),incomeId=String(types[0].feesMappingAccountId||'').trim()
 const cash=accounts.filter(a=>a.id===cashId),income=accounts.filter(a=>a.id===incomeId)
 if(cash.length!==1||cash[0].status==='inactive'||!input.cashAccountIds.includes(cashId))return fail('Select an active cash or bank account.')
 if(!incomeId||income.length!==1||income[0].status==='inactive'||income[0].type!=='income'||incomeId===cashId)return fail('Map the fee type to a different active income account.')
 const value=String(p.amount||'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(value))return fail('The payment amount is invalid.')
 const [whole,frac='']=value.split('.'), cents=Number(whole)*100+Number(frac.padEnd(2,'0'))
 if(!Number.isSafeInteger(cents)||cents<=0)return fail('The payment amount is invalid.')
 const date=String(p.paidAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)return fail('The payment date is invalid.')
 const methods:Record<string,VoucherMethod>={'Cash':'cash','Bank Transfer':'bank','Mobile Money':'momo'};const method=methods[p.paymentMethod];if(!method)return fail('This payment method requires manual accounting review.')
 const id=`fee_payment_receipt_${p.id}`
 if(input.receipts.some(r=>r.id===id||r.sourceFeePaymentId===p.id))return fail('A linked receipt already exists; review for duplicates.')
 const amount=cents/100,description=`Student fee ${bill.feeType || 'payment'}; payment ${p.id}`
 return {error:'',receipt:{id,sourceFeePaymentId:p.id,companyId:input.companyId,branchId:input.branchId,number:String(p.voucherNumber||`FEE-${p.id}`),date,receivedFrom:input.payer.trim(),stakeholderClass:'customer',depositAccountId:cashId,lines:[{accountId:incomeId,narration:description,amount}],amount,method,referenceNo:String(p.voucherNumber||p.id),currency:input.currency,description,status:'posted',createdBy:input.actorId||undefined,createdAt:new Date().toISOString()}}
}
