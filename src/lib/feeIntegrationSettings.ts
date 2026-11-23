/** Company preference synced through the ordinary browser store bridge. */
export const feeIntegrationKey=(companyId:string)=>`fitpro_fee_integration_settings_v1_${companyId}`
export function readFeeDefaultAccount(companyId:string):string {
 if(!companyId) return ''
 try {const v=JSON.parse(localStorage.getItem(feeIntegrationKey(companyId))||'{}');return typeof v.defaultAccountId==='string'?v.defaultAccountId:''} catch{return ''}
}
export function readFeeIntegrationEnabled(companyId:string):boolean {
 if(!companyId) return false
 try { return JSON.parse(localStorage.getItem(feeIntegrationKey(companyId))||'{}').enabled===true } catch { return false }
}
export function saveFeeDefaultAccount(companyId:string,accountId:string,enabled=readFeeIntegrationEnabled(companyId)) {
 if(!companyId) throw new Error('Company is required')
 localStorage.setItem(feeIntegrationKey(companyId),JSON.stringify({defaultAccountId:accountId,enabled}))
}
/** Never substitute a different account for a missing or inactive saved default. */
export function resolveFeeDefaultAccount(savedId:string,availableIds:readonly string[]):string {
 return savedId && availableIds.filter(id=>id===savedId).length===1 ? savedId : ''
}
