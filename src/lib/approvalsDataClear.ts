export const APPROVAL_DATA_MENUS=[
 {id:'pending',label:'Pending Approvals',desc:'Saved pending request queues across companies available in this browser. Clearing removes queued submission snapshots, including vouchers awaiting approval; it does not post, reject or repair related documents.'},
 {id:'history',label:'Approval History',desc:'Saved approval action history across companies available in this browser. Actions on still-pending requests may be recovered and appear again.'},
 {id:'rules',label:'Approval Rule Builder',desc:'Workflows, approval steps and automatic rule actions across company stores in this browser. Existing approval-enable settings and the shared document-type catalogue are preserved.'},
 {id:'reports',label:'Approval Reports',desc:'Calculated from pending requests, history and rules; no independent records to clear.'},
] as const
export const APPROVAL_DATA_PREFIXES=['fitpro_pending_approvals_preview_v1_','fitpro_approval_history_preview_v1_','fitpro_approval_module_v1_']
export function planApprovalsDataClear(stores:Record<string,string>,ids:readonly string[]){
 const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={pending:0,history:0,rules:0,reports:0}
 for(const [key,raw] of Object.entries(stores)){
  const pending=key.startsWith(APPROVAL_DATA_PREFIXES[0]),history=key.startsWith(APPROVAL_DATA_PREFIXES[1]),rules=key.startsWith(APPROVAL_DATA_PREFIXES[2]);if(!pending&&!history&&!rules)continue
  let value:any;try{value=JSON.parse(raw)}catch{throw new Error(`Cannot safely inspect ${key}.`)}
  if(pending||history){if(!Array.isArray(value))throw new Error(`Invalid approval queue or history in ${key}.`);const id=pending?'pending':'history';counts[id]+=value.length;if(selected.has(id))changes[key]='[]'}
  else {if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid approval configuration in ${key}.`);for(const field of ['settings','workflows','steps','ruleActions'])if(value[field]!==undefined&&!Array.isArray(value[field]))throw new Error(`Invalid approval configuration in ${key}.`);counts.rules+=(value.workflows?.length||0)+(value.steps?.length||0)+(value.ruleActions?.length||0);if(selected.has('rules'))changes[key]=JSON.stringify({...value,workflows:[],steps:[],ruleActions:[]})}
 }
 return {changes,counts}
}
