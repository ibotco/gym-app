import type { EduRecords } from './eduRecords'
/** Remove demo payment destinations once per branch, leaving all non-sample accounts unchanged. */
export function clearPaymentAccountSamples(records:EduRecords):EduRecords {
 const marker='clear-payment-account-samples-v1'
 if((records.feeSampleMigrations??[]).some(r=>r.id===marker))return records
 const accounts=(records.paymentAccounts??[]).filter(r=>r.sample!=='true' && !r.id.startsWith('sample-payment-account-'))
 return {...records,paymentAccounts:accounts,feeSampleMigrations:[...(records.feeSampleMigrations??[]),{id:marker}]}
}
