import type { EduRecords } from './eduRecords'
/** Update only unchanged legacy demo names and numbers; preserve edits and real accounts. */
export function refreshPaymentAccountTestData(records:EduRecords):EduRecords {
 const marker='payment-account-test-numeric-v1'
 if((records.feeSampleMigrations??[]).some(r=>r.id===marker))return records
 const replacements:Record<string,[string,string]>={
  'sample-payment-account-v2-mtn':['TEST-MTN-0001','0000000001'],
  'sample-payment-account-v2-bank':['TEST-BANK-0002','0000000000002'],
  'sample-payment-account-v2-telecel':['TEST-TELECEL-0003','0000000003'],
  'sample-payment-account-v2-at':['TEST-AT-0004','0000000004'],
  'sample-payment-account-v2-bank2':['TEST-BANK-0005','0000000000005'],
 }
 const accounts=(records.paymentAccounts??[]).map(r=>{
  const pair=replacements[r.id]
  if(!pair || r.sample!=='true' || r.accountName!=='Sample School' || r.accountNumber!==pair[0])return r
  return {...r,accountName:'Bright Future Demonstration School',accountNumber:pair[1]}
 })
 return {...records,paymentAccounts:accounts,feeSampleMigrations:[...(records.feeSampleMigrations??[]),{id:marker}]}
}
