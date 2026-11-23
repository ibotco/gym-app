import type { EduRow } from './eduRecords'
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
export function findStudentTermDates(rows:EduRow[],year:string,term:string):EduRow|null {
 if(!norm(year)||!norm(term))return null
 const found=rows.filter(r=>norm(r.academicYear)===norm(year)&&norm(r.term)===norm(term))
 return found.length===1?found[0]:null
}
export function formatStudentTermDate(value:unknown):string {
 const s=String(value??'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return ''
 const [y,m,d]=s.split('-').map(Number), date=new Date(Date.UTC(y,m-1,d))
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return ''
 return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date)
}
