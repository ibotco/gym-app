import type { EduRecords, EduRow } from './eduRecords'
/** Non-payable demonstration entries, added once per branch without altering real accounts. */
export function addPaymentAccountSamples(records:EduRecords):EduRecords {
 const marker='payment-account-samples-v1'
 if ((records.feeSampleMigrations??[]).some(r=>r.id===marker))return records
 const examples:EduRow[]=[
  {id:'sample-payment-account-v1-bank',bankName:'Sample — Commercial Bank',accountName:'EXAMPLE SCHOOL — DO NOT PAY',accountNumber:'DEMO-BANK-NOT-REAL',instructions:'EXAMPLE ONLY — DO NOT SEND MONEY.',status:'Disabled',sample:'true'},
  {id:'sample-payment-account-v1-mtn',bankName:'Sample — MTN Mobile Money',accountName:'EXAMPLE SCHOOL — DO NOT PAY',accountNumber:'DEMO-MTN-NOT-REAL',instructions:'EXAMPLE ONLY — DO NOT SEND MONEY.',status:'Disabled',sample:'true'},
  {id:'sample-payment-account-v1-telecel',bankName:'Sample — Telecel Cash',accountName:'EXAMPLE SCHOOL — DO NOT PAY',accountNumber:'DEMO-TELECEL-NOT-REAL',instructions:'EXAMPLE ONLY — DO NOT SEND MONEY.',status:'Disabled',sample:'true'},
  {id:'sample-payment-account-v1-at',bankName:'Sample — AT Money',accountName:'EXAMPLE SCHOOL — DO NOT PAY',accountNumber:'DEMO-AT-NOT-REAL',instructions:'EXAMPLE ONLY — DO NOT SEND MONEY.',status:'Disabled',sample:'true'},
 ]
 const current=records.paymentAccounts??[]
 return {...records,paymentAccounts:[...current,...examples.filter(e=>!current.some(x=>x.id===e.id))],feeSampleMigrations:[...(records.feeSampleMigrations??[]),{id:marker}]}
}
