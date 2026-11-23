/** Question IDs are stored on the exam as a JSON string; null means legacy/no assignment data. */
export function readExamQuestionIds(value:unknown):string[]|null {
 if(value==null || value==='')return null
 try {const data=JSON.parse(String(value));return Array.isArray(data)&&data.every(x=>typeof x==='string')?[...new Set<string>(data)]:null} catch{return null}
}
export function mergeExamQuestionIds(existing:string[],visible:string[],selected:string[]):string[]{const allowed=new Set(visible);return [...new Set([...existing.filter(id=>!allowed.has(id)),...selected.filter(id=>allowed.has(id))])]}
export type ExamQuestionMarks=Record<string,{marks:string;negativeMarks:string}>
export function readExamQuestionMarks(value:unknown):ExamQuestionMarks {try{const parsed=JSON.parse(String(value||'{}'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};const result:ExamQuestionMarks={};for(const [id,v] of Object.entries(parsed)){if(v&&typeof v==='object'&&!Array.isArray(v)){const data=v as Record<string,unknown>;result[id]={marks:String(data.marks??''),negativeMarks:String(data.negativeMarks??'')}}}return result}catch{return {}}}
export function validExamQuestionMarks(marks:ExamQuestionMarks,ids:string[]):boolean{return ids.every(id=>{const v=marks[id];return !!v&&[v.marks,v.negativeMarks].every(x=>x.trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0)})}
