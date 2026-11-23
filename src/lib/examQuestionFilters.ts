type Row={id:string;[key:string]:string}
export type ExamQuestionCriteria={group:string;questionType:string[];level:string;className:string;section:string;subject:string}
export const emptyExamQuestionCriteria=():ExamQuestionCriteria=>({group:'',questionType:[],level:'',className:'',section:'',subject:''})
const norm=(x:unknown)=>String(x??'').trim().toLocaleLowerCase()
export function examQuestionMatches(row:Row,criteria:ExamQuestionCriteria,search:string):boolean{return Object.entries(criteria).every(([key,value])=>Array.isArray(value)?!value.length||value.some(v=>norm(row[key])===norm(v)):!value||norm(row[key])===norm(value))&&(!norm(search)||[row.question,row.subject,row.group,row.questionType,row.level].some(v=>norm(v).includes(norm(search))))}
export function examQuestionFilterOptions(rows:Row[],criteria:ExamQuestionCriteria,key:keyof ExamQuestionCriteria):string[]{
 if((key==='section'||key==='subject')&&!criteria.className)return []
 const relevant=rows.filter(r=>key==='section'||key==='subject'?norm(r.className)===norm(criteria.className):true).filter(r=>key==='subject'&&criteria.section?norm(r.section)===norm(criteria.section):true)
 const values=[...new Set(relevant.map(r=>String(r[key]??'').trim()).filter(Boolean))];if(key==='level'){const defaults=['Easy','Medium','Hard'];return [...defaults,...values.filter(v=>!defaults.some(d=>norm(d)===norm(v))).sort((a,b)=>a.localeCompare(b))]}
 return values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
}
