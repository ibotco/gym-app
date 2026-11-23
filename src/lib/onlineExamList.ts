type Row={id:string;[key:string]:string}
const clean=(v:unknown)=>String(v??'').trim().toLocaleLowerCase()
export function onlineExamClosed(row:Row,today:string):boolean{const status=clean(row.status);const end=String(row.examTo||row.date||'').trim().slice(0,10);return status==='closed'||status==='completed'||Boolean(end&&/^\d{4}-\d{2}-\d{2}$/.test(end)&&end<today)}
/** Match attempt IDs first. Name-only legacy matches require a unique title. */
export function onlineExamAttemptCount(row:Row,exams:Row[],attempts:Row[]):number|null{const name=clean(row.title);const unique=name&&exams.filter(x=>clean(x.title)===name).length===1;const ambiguous=!!name&&!unique&&attempts.some(a=>!a.examId&&clean(a.exam)===name);if(ambiguous)return null;return attempts.filter(a=>a.examId ? a.examId===row.id : unique&&clean(a.exam)===name).length}
