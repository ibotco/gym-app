import type { EduRecords, EduRow } from './eduRecords'
const uses:Record<string,{table:string;field:string;label:string}[]>={
 'Reference':[{table:'enquiries',field:'reference',label:'Admission Enquiry'}],
 'Source':[{table:'enquiries',field:'source',label:'Admission Enquiry'},{table:'complain',field:'source',label:'Complain'}],
 'Response':[{table:'phoneCalls',field:'response',label:'Phone Call Log'}],
 'Calling Purpose':[{table:'phoneCalls',field:'callingPurpose',label:'Phone Call Log'}],
 'Visiting Purpose':[{table:'visitors',field:'purpose',label:'Visitor Book'}],
 'Complaint Type':[{table:'complain',field:'type',label:'Complain'}],
}
const norm=(x:unknown)=>String(x??'').trim().toLocaleLowerCase()
export function frontOfficeUsage(records:EduRecords, entry:EduRow):{label:string;count:number}[]{
 const mappings=uses[entry.category];if(!mappings)throw new Error('Cannot verify usage for this category.')
 const name=norm(entry.name);if(!name)throw new Error('Cannot verify usage for an unnamed item.')
 return mappings.map(({table,field,label})=>{const rows=records[table];if(rows!==undefined&&!Array.isArray(rows))throw new Error(`Cannot inspect ${label} records.`);return {label,count:(rows??[]).filter(row=>norm(row[field])===name).length}}).filter(x=>x.count>0)
}
export function usageDescription(usage:{label:string;count:number}[]){return usage.map(x=>`${x.label} (${x.count})`).join(', ')}
