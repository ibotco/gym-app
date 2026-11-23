type Row={id:string;[key:string]:string}
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>')
const parseArray=(s:unknown):unknown[]=>{try{const a=JSON.parse(String(s||'[]'));return Array.isArray(a)?a:[]}catch{return []}}
export function questionEditInitial(row?:Row|null){
 const options=parseArray(row?.options).filter((v):v is string=>typeof v==='string');const indexes=parseArray(row?.correctOptionIndexes).filter((v):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<5);const type=String(row?.questionType||'');let answers=indexes
 if(!answers.length&&type==='True/False'&&['true','false'].includes(String(row?.answer||'').trim().toLowerCase()))answers=[String(row?.answer).trim().toLowerCase()==='true'?0:1]
 return {cls:row?.className||'',section:row?.section||'',subject:row?.subject||'',type:row?(type||''):'Single Choice',level:row?.level||'',group:row?.group||'',marks:row?.marks||'',questionHtml:row?.questionHtml||escape(row?.question||''),options:Array.from({length:5},(_,i)=>options[i]||''),answers,writtenAnswer:row?.answer||'',hasExtraOptions:options.length>5}
}
