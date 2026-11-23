/** Operations on the shared education store. Each selected menu clears only
 * the explicitly named arrays, in every branch. Related accounting and other
 * modules are not touched. This is a single-store operation, not a transaction. */
export const EDUCATION_CLEAR_MARKER='__maintenanceClearedTables'
const aliases:Record<string,string[]>={postalDispatch:['postalMail'],postalReceive:['postalMail'],markEntries:['marksEntry'],examResult:['examResults'],onlineExam:['onlineExams'],continuousAssessment:['continuousAssessments'],timetableRules:['ttConfig']}
const extra:Record<string,string[]>={frontDesk:['frontOfficeSampleMarker'],onlineExamManagement:['onlineExamSampleMarker'],studentFinance:['feesInvoicePayments','scholarshipPostings','scholarshipAllocations','feeTypes','feeGroups','fineSetup','feesDiscount','paymentAccounts','paymentMethods']}
const hidden=new Set(['staff','certificate','feesConfigurations'])
type Group={id:string;key:string;leaves:{id:string;key:string}[]}
export function educationClearMenus(groups:Group[]){return groups.filter(g=>!hidden.has(g.id)).map(g=>({id:g.id,key:g.key,tables:[...new Set([...g.leaves.flatMap(l=>[l.id,...(aliases[l.id]||[])]),...(extra[g.id]||[])])]}))}
export function planEducationMenuClear(raw:string,menus:ReturnType<typeof educationClearMenus>,ids:string[]){
 const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid education data store')
 const selected=menus.filter(m=>ids.includes(m.id));if(!selected.length||selected.length!==new Set(ids).size)throw new Error('Unknown or empty menu selection')
 const tables=[...new Set(selected.flatMap(m=>m.tables))];if(tables.includes(EDUCATION_CLEAR_MARKER))throw new Error('Invalid table')
 const root=value as Record<string,unknown>;const flat=Object.values(root).some(Array.isArray);const branches=flat?{__legacy__:root}:root;let count=0
 for(const [branch,original] of Object.entries(branches)){if(!original||typeof original!=='object'||Array.isArray(original))throw new Error(`Invalid branch data: ${branch}`);const data=original as Record<string,unknown>;const previous=data[EDUCATION_CLEAR_MARKER];if(previous!==undefined&&!Array.isArray(previous))throw new Error('Invalid clear marker');const markers=new Set((Array.isArray(previous)?previous:[]).map(row=>row&&typeof row==='object'?String((row as {id?:unknown}).id||''):'').filter(Boolean));for(const table of tables){const rows=data[table];if(rows!==undefined&&!Array.isArray(rows))throw new Error(`Invalid table: ${table}`);if(Array.isArray(rows))count+=rows.length;data[table]=[];markers.add(table)}data[EDUCATION_CLEAR_MARKER]=[...markers].map(id=>({id}))}
 return {next:JSON.stringify(flat?branches.__legacy__:branches),tables,count}
}
/** Restore original selected tables after seed/backfill routines; never suppress
 * records added by the user after a clear. */
export function preserveClearedEducationTables<T extends Record<string,any>>(before:T|undefined,after:T):T {
 const marker=before?.[EDUCATION_CLEAR_MARKER];if(!Array.isArray(marker))return after
 const result={...after} as T;for(const entry of marker){const id=String(entry?.id||'');if(!id||id===EDUCATION_CLEAR_MARKER)continue;(result as Record<string,unknown>)[id]=Array.isArray(before?.[id])?before![id]:[]}
 ;(result as Record<string,unknown>)[EDUCATION_CLEAR_MARKER]=marker;return result
}
