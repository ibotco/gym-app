import type { EduRecords, EduRow } from './eduRecords'
import { EDUCATION_CLEAR_MARKER } from './educationMenuClear'
export const ONLINE_EXAM_SAMPLE_MARKER='onlineExamSampleMarker'
const subjects=['Mathematics','English','Integrated Science','Social Studies','Computing']
function addDays(today:string,days:number):string {const d=new Date(`${today}T12:00:00Z`);if(!Number.isFinite(d.getTime()))throw new Error('Invalid sample date');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function addOnlineExamSamples(records:EduRecords,today:string):{records:EduRecords;added:number}{
 if((records[ONLINE_EXAM_SAMPLE_MARKER]??[]).some(r=>r.id==='v1')||(records[EDUCATION_CLEAR_MARKER]??[]).some(r=>['onlineExam','onlineExams',ONLINE_EXAM_SAMPLE_MARKER].includes(r.id)))return {records,added:0}
 const current=records.onlineExam??records.onlineExams??[];const ids=new Set(current.map(r=>r.id));const additions:EduRow[]=[]
 for(const kind of ['upcoming','closed'] as const)subjects.forEach((subject,i)=>{const id=`online-exam-sample-${kind}-${i+1}`;if(ids.has(id))return;const date=addDays(today,kind==='upcoming'?7+i*7:-(7+i*7));additions.push({id,title:`Sample ${subject} ${kind==='upcoming'?'Upcoming':'Closed'} Exam`,subject,date,examFrom:`${date}T09:00`,examTo:`${date}T10:00`,duration:'60',durationClock:'01:00:00',attemptLimit:'1',passingPercentage:'50',answerWordLimit:'-1',status:kind==='closed'?'Closed':'Scheduled',description:'Example exam record. Exam delivery and publishing are not available.'})})
 return {records:{...records,onlineExam:[...current,...additions],[ONLINE_EXAM_SAMPLE_MARKER]:[{id:'v1'}]},added:additions.length}
}
