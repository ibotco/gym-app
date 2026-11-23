type Row={id:string;[key:string]:unknown}
type Account={id:string;name:string;code?:string;status?:string}
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
/** Display current configuration, never infer a historical posting from it. */
export function feeMappedAccount(bill:Row|undefined,feeTypes:readonly Row[],accounts:readonly Account[]):string {
 if(!bill)return 'Select a fee item'
 const typeId=String(bill.feeTypeId||'').trim(),name=norm(bill.feeType)
 const matches=typeId?feeTypes.filter(t=>t.id===typeId):name?feeTypes.filter(t=>norm(t.name)===name):[]
 if(matches.length!==1)return matches.length?'Fee type ambiguous — review mapping':'Fee type unavailable — review mapping'
 const type=matches[0],id=String(type.feesMappingAccountId||'').trim(),label=String(type.feesMapping||'').trim()
 if(!id)return label?`${label} (legacy mapping — review)`:'Not mapped'
 const matchesAccount=accounts.filter(a=>a.id===id)
 if(matchesAccount.length!==1)return `Unavailable account — ${label||id}`
 const a=matchesAccount[0];return `${[a.code,a.name].filter(Boolean).join(' — ')}${a.status==='inactive'?' (inactive)':''}`
}
