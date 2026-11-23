import type { EduRecords, EduRow } from './eduRecords'
/** Once per branch, add non-payable test accounts without changing existing real accounts. */
export function addPaymentAccountTestData(records:EduRecords):EduRecords {
 const marker='payment-account-test-data-v2'
 if ((records.feeSampleMigrations??[]).some(r=>r.id===marker)) return records
 const examples:EduRow[]=[
  {id:'sample-payment-account-v2-mtn',bankName:'MTN Mobile Money',accountName:'Bright Future Demonstration School',accountNumber:'0000000001',instructions:'Example for testing only.',status:'Active',sample:'true'},
  {id:'sample-payment-account-v2-bank',bankName:'Sample Commercial Bank',accountName:'Bright Future Demonstration School',accountNumber:'0000000000002',instructions:'Example for testing only.',status:'Active',sample:'true'},
  {id:'sample-payment-account-v2-telecel',bankName:'Telecel Cash',accountName:'Bright Future Demonstration School',accountNumber:'0000000003',instructions:'Example for testing only.',status:'Disabled',sample:'true'},
  {id:'sample-payment-account-v2-at',bankName:'AT Money',accountName:'Bright Future Demonstration School',accountNumber:'0000000004',instructions:'Example for testing only.',status:'Disabled',sample:'true'},
  {id:'sample-payment-account-v2-bank2',bankName:'Sample Community Bank',accountName:'Bright Future Demonstration School',accountNumber:'0000000000005',instructions:'Example for testing only.',status:'Disabled',sample:'true'},
 ]
 const current=records.paymentAccounts??[]
 return {...records,paymentAccounts:[...current,...examples.filter(e=>!current.some(x=>x.id===e.id))],feeSampleMigrations:[...(records.feeSampleMigrations??[]),{id:marker}]}
}
