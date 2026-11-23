/** Menu-scoped storage mappings. Prefix entries include all companies/users in this browser. */
export const COMMUNICATION_MENUS = [
 {id:'events',label:'Events',desc:'Events only in the shared website/CMS store; other website data is preserved.'},
 {id:'notice',label:'Notice Board',desc:'Notice-board records for all companies stored in this browser.'},
 {id:'system',label:'System Message',desc:'System messages and per-user mailbox state for all companies in this browser.'},
 {id:'sms',label:'SMS Notifications',desc:'SMS notification history and compose drafts in this browser. Scheduled jobs and gateway settings are not removed.'},
 {id:'email',label:'Email Notifications',desc:'Email notification history and compose drafts in this browser. Scheduled jobs and gateway settings are not removed.'},
 {id:'emailTemplate',label:'Email Template',desc:'Email templates in the shared message-template store, across companies. SMS templates are preserved.'},
 {id:'smsTemplate',label:'SMS Template',desc:'SMS templates in the shared message-template store, across companies. Email templates are preserved.'},
 {id:'approval',label:'Approval notifications',desc:'Saved approval-notification templates for all companies in this browser; default templates will reappear. Approval requests and history are untouched.'},
] as const
const PREFIX:Record<string,string[]>={notice:['fitpro_notice_board_v1_'],system:['fitpro_system_messages_v1_','fitpro_system_mail_state_v1_'],sms:['fitpro_sms_notification_history_v1_','fitpro_sms_compose_draft_v1_'],email:['fitpro_email_notification_history_v1_','fitpro_email_compose_draft_v1_'],approval:['fitpro_approval_notification_templates_v1_']}
export type StorageMap=Record<string,string>
export function planCommunicationsClear(stores:StorageMap, ids:readonly string[], fallbackCms:unknown, fallbackTemplates:unknown) {
 const selected=new Set(ids),changes:Record<string,string|null>={},counts:Record<string,number>={}
 for(const [id,prefixes] of Object.entries(PREFIX)){counts[id]=0;for(const [key,raw] of Object.entries(stores)){if(prefixes.some(p=>key.startsWith(p))){let v:unknown;try{v=JSON.parse(raw)}catch{throw new Error(`Cannot safely inspect ${key}; no data was cleared.`)};counts[id]+=Array.isArray(v)?v.length:1;if(selected.has(id))changes[key]=null}}}
 let cms:any;try{cms=stores.fitpro_cms?JSON.parse(stores.fitpro_cms):fallbackCms}catch{throw new Error('Cannot safely inspect the CMS store.')}
 if(!cms||typeof cms!=='object'||Array.isArray(cms)||(cms.events!==undefined&&!Array.isArray(cms.events)))throw new Error('Cannot safely inspect CMS events.')
 counts.events=(cms.events||[]).length;if(selected.has('events'))changes.fitpro_cms=JSON.stringify({...cms,events:[]})
 let templates:any;try{templates=stores.fitpro_message_templates?JSON.parse(stores.fitpro_message_templates):fallbackTemplates}catch{throw new Error('Cannot safely inspect message templates.')}
 if(!Array.isArray(templates))throw new Error('Cannot safely inspect message templates.')
 for(const [id,ch] of [['emailTemplate','email'],['smsTemplate','sms']])counts[id]=templates.filter((x:any)=>x?.channel===ch).length
 if(selected.has('emailTemplate')||selected.has('smsTemplate'))changes.fitpro_message_templates=JSON.stringify(templates.filter((x:any)=>!(selected.has('emailTemplate')&&x?.channel==='email')&&!(selected.has('smsTemplate')&&x?.channel==='sms')))
 return {changes,counts}
}
