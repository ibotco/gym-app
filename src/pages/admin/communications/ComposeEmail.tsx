import { useRef, useState } from 'react'
import { ArrowLeft, Info, Paperclip, Send, X } from 'lucide-react'
import { Button, Field, Input, Select } from '../../../components/ui'
import { RichBodyEditor, stripHtml } from '../../../components/RichBodyEditor'
import DOMPurify from 'dompurify'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useLicense } from '../../../context/LicenseContext'
import { getNoticeAudiences } from '../../../lib/noticeAudiences'
import { EDU_RECORDS_KEY } from '../../../lib/eduRecords'
import { CHURCH_RECORDS_KEY } from '../../../lib/churchRecords'
import { normalizeSmsAudienceDraft, canSendIndividual, type SmsAudienceDraft } from '../../../lib/smsAudienceDraft'
import { SmsAudienceSelector } from './SmsAudienceSelector'
import { availableEmailTagGroups } from '../../../lib/emailTemplateTags'
import { validEmail } from '../../../lib/companyEmailSettings'
import { loadMail, sendHtmlEmail } from '../../../lib/mail'
import { normalizeSmsScheduleDraft, SMS_WEEKDAYS, type SmsScheduleDraft } from '../../../lib/smsScheduleDraft'
import type { MessageTemplateAttachment } from '../../../types'
import type { EmailAttempt } from './DirectNotifications'

type Priority='low'|'normal'|'high'|'urgent'
type Draft={to:string;subject:string;message:string;templateId:string;priority:Priority;schedule:SmsScheduleDraft;richBody?:boolean;attachments:MessageTemplateAttachment[];audience:SmsAudienceDraft}
const blank=():Draft=>({to:'',subject:'',message:'',templateId:'',priority:'normal',schedule:normalizeSmsScheduleDraft(null),richBody:true,attachments:[],audience:normalizeSmsAudienceDraft(null)})
const draftKey=(companyId:string,userId:string)=>`fitpro_email_compose_draft_v1_${companyId}_${userId}`
function loadDraft(key:string):Draft|null {try {const d=JSON.parse(localStorage.getItem(key)||'null');if (!d || typeof d.to!=='string' || typeof d.subject!=='string' || typeof d.message!=='string') return null;return {to:d.to,subject:d.subject,message:d.richBody === true ? DOMPurify.sanitize(d.message, { USE_PROFILES:{html:true} }) : d.message.split('\n').map((line:string)=>`<p>${escapeHtml(line) || '<br>'}</p>`).join(''),richBody:true,audience:normalizeSmsAudienceDraft(d.audience),attachments:Array.isArray(d.attachments) ? d.attachments : [],templateId:typeof d.templateId==='string'?d.templateId:'',priority:['low','normal','high','urgent'].includes(d.priority)?d.priority:'normal',schedule:normalizeSmsScheduleDraft(d.schedule)}}catch{return null}}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
export function ComposeEmail({onBack,onEmailResult}:{onBack:()=>void;onEmailResult:(attempt:EmailAttempt)=>void}) {
 const {activeCompanyId,messageTemplates,modules,companies,roles,users,activeBranchId}=useApp()
 const {user}=useAuth();const {currentPackage,pkgActive}=useLicense()
 const [form,setForm]=useState<Draft>(blank)
 const [editorVersion,setEditorVersion]=useState(0)
 const [readingFiles,setReadingFiles]=useState(false);const readingRef=useRef(false)
 const [busy,setBusy]=useState(false);const [outcome,setOutcome]=useState<{ok:boolean;message:string}|null>(null);const [notice,setNotice]=useState('')
 const sending=useRef(false)
 const key=draftKey(activeCompanyId,user?.id||'unknown');const saved=loadDraft(key)
 const templates=messageTemplates.filter(t=>t.channel==='email' && t.active)
 const groups=availableEmailTagGroups(modules,currentPackage?.modules,pkgActive)
 const audiences=getNoticeAudiences(roles,activeCompanyId,modules,currentPackage?.modules,pkgActive)
 const audienceOptions:Record<string,{id:string;name:string}[]>={}
 const display=(r:{id:string;name?:unknown;email?:unknown})=>({id:r.id,name:[String(r.name||'Unnamed'),String(r.email||'No email')].join(' · ')})
 for (const role of audiences) {if (!role.id.startsWith('audience_')) audienceOptions[`audience:${role.id}`]=users.filter(u=>u.role===role.id && u.companyId===activeCompanyId && u.branchId===activeBranchId).map(display)}
 let students:{id:string;name:string}[]=[], churchGroups:{id:string;name:string}[]=[]
 try {
  const ed=JSON.parse(localStorage.getItem(EDU_RECORDS_KEY)||'{}')?.[activeBranchId]
  students=Array.isArray(ed?.studentList)?ed.studentList.filter((r:any)=>typeof r?.id==='string').map(display):[]
  audienceOptions['audience:audience_parent']=Array.isArray(ed?.parents)?ed.parents.filter((r:any)=>typeof r?.id==='string').map(display):[]
  const church=JSON.parse(localStorage.getItem(CHURCH_RECORDS_KEY)||'{}')?.[activeBranchId]
  audienceOptions['audience:audience_congregation']=Array.isArray(church?.congregation)?church.congregation.filter((r:any)=>typeof r?.id==='string').map(display):[]
  const records=Array.isArray(church?.ministries)?church.ministries.filter((r:any)=>typeof r?.id==='string'):[]
  churchGroups=modules.churchManagement===true?records.map((r:any)=>({id:r.id,name:String(r.name||'Unnamed')})):[]
  const categories:Record<string,string[]>={'church:ministries':['ministry'],'church:homeCells':['cell group','home cell'],'church:bibleStudy':['bible study','bible study group'],'church:committees':['committee'],'church:guilds':['guild']}
  for(const [id,values] of Object.entries(categories))audienceOptions[id]=records.filter((r:any)=>values.includes(String(r.category||'').trim().toLowerCase())).map((r:any)=>({id:r.id,name:String(r.name||'Unnamed')}))
 } catch { /* No records are inferred from unreadable storage. */ }
 const mail=loadMail();const provider=mail.emailProviders?.find(p=>p.provider===mail.emailDefault && p.active)
 const sender=provider?.config.fromEmail || provider?.config.smtpUser || 'Managed by the active provider'
 function selectTemplate(id:string) {if(!id){setForm(prev=>({...prev,templateId:''}));return} const t=templates.find(x=>x.id===id);if(!t)return;if((stripHtml(form.message).trim()||form.subject.trim()||form.attachments.length)&&!window.confirm('Replace the current subject, message and attachments with this template?'))return;const body=/<[a-z][\s\S]*>/i.test(t.body) ? DOMPurify.sanitize(t.body,{USE_PROFILES:{html:true}}) : t.body.split('\n').map(line=>`<p>${escapeHtml(line)||'<br>'}</p>`).join('');setForm(prev=>({...prev,templateId:id,subject:t.subject||'',message:body,richBody:true,attachments:[...(t.attachments||[])]}));setEditorVersion(v=>v+1)}
 async function attachFiles(list:FileList|null) {
  if (!list || !list.length || readingRef.current) return
  const files=Array.from(list)
  if (files.length + form.attachments.length > 3) {setOutcome({ok:false,message:'Up to 3 attachments are allowed.'});return}
  const tooLarge=files.find(f=>f.size>512*1024)
  if (tooLarge) {setOutcome({ok:false,message:`${tooLarge.name} exceeds the 512 KB limit.`});return}
  readingRef.current=true;setReadingFiles(true);setOutcome(null)
  try {
   const filesRead=await Promise.all(files.map(f=>new Promise<MessageTemplateAttachment>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:f.name,size:f.size,type:f.type||'application/octet-stream',dataUrl:String(r.result)});r.onerror=()=>reject(r.error);r.readAsDataURL(f)})))
   setForm(prev=>({...prev,attachments:[...prev.attachments,...filesRead]}))
  } catch {setOutcome({ok:false,message:'Could not read the selected files. Try again.'})}
  finally {readingRef.current=false;setReadingFiles(false)}
 }
 function saveDraft(){try{localStorage.setItem(key,JSON.stringify(form));setNotice('Draft saved. One draft is stored per user and company; saving again replaces it.');setOutcome(null)}catch{setOutcome({ok:false,message:'Draft could not be saved in this browser.'})}}
 async function submit(e:React.FormEvent){e.preventDefault();if(sending.current)return
  if(!canSendIndividual(form.audience)){setOutcome({ok:false,message:'Group email targeting is not connected. Select only Custom email address to send.'});return}
  if(readingRef.current || form.attachments.length){setOutcome({ok:false,message:'Sending email attachments is not connected. Remove all attachments before sending, or save as a draft.'});return}
  if(form.schedule.mode!=='now'){setOutcome({ok:false,message:'Scheduled email is not available. Save this as a draft or select Send now.'});return}
  if(!validEmail(form.to.trim())){setOutcome({ok:false,message:'Enter a valid recipient email address.'});return}
  if(!form.subject.trim()||!stripHtml(form.message).trim()||/[\r\n]/.test(form.subject)){setOutcome({ok:false,message:'Enter a subject without line breaks and a message.'});return}
  if(/\{\{[^{}]+\}\}/.test(form.message)||/\{\{[^{}]+\}\}/.test(form.subject)){setOutcome({ok:false,message:'Replace all tags with actual values before sending. Automatic substitution is not connected.'});return}
  sending.current=true;setBusy(true);setOutcome(null);setNotice('');const companyId=activeCompanyId,to=form.to.trim(),subject=form.subject.trim(),html=DOMPurify.sanitize(form.message,{USE_PROFILES:{html:true}}),message=stripHtml(html.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n')).trim()
  try{const result=await sendHtmlEmail({to,subject,text:message,html,companyId});onEmailResult({companyId,to,subject,message,ok:result.ok,priority:form.priority});setOutcome(result.ok?{ok:true,message:'Request submitted to the configured provider. Delivery is not verified.'}:{ok:false,message:result.error||'Request could not be confirmed. Check the provider before retrying.'})}catch{onEmailResult({companyId,to,subject,message,ok:false,priority:form.priority});setOutcome({ok:false,message:'The request outcome is unknown. Check the provider before retrying to avoid a duplicate.'})}finally{sending.current=false;setBusy(false)}
 }
 return <form onSubmit={submit} className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-mist">Communication</p><h1 className="text-2xl font-bold">New Email</h1></div><Button type="button" variant="outline" disabled={busy} onClick={onBack}><ArrowLeft className="size-4" /> Back to Email notifications</Button></div>
  <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(250px,1fr)]"><div className="min-w-0 space-y-5">
   <section className="card overflow-hidden"><div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4"><h2 className="font-semibold">Message</h2><span className="text-xs text-mist">What you are sending</span></div><div className="space-y-5 p-5">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Template"><Select disabled={readingFiles} value={form.templateId} onChange={e=>selectTemplate(e.target.value)}><option value="">Start from a template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><p className="mt-1 text-xs text-mist">Optional starting point.</p></Field><Field label="Sender email"><Input value={sender} readOnly aria-label="Configured sender email" /><p className="mt-1 text-xs text-mist">Managed by the active email provider in Company Settings.</p></Field></div>
    <Field label="Subject" required><Input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} maxLength={200} required /></Field>
    <Field label="Email content" required><RichBodyEditor key={editorVersion} value={form.message} onChange={message=>setForm(prev=>({...prev,message,richBody:true}))} tall placeholder="Write your message…" tagGroups={groups} plainTextPaste resizable /><p className="mt-1 text-xs text-mist">Tags are placeholders only; replace them with actual values before sending.</p></Field>
    <Field label={`Attachments (${form.attachments.length}/3)`}><div className="space-y-2">
     {form.attachments.length > 0 && <ul className="space-y-1.5">{form.attachments.map((a,i)=><li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-line bg-zinc-50 px-2.5 py-1.5 dark:bg-white/5"><Paperclip className="size-3.5 shrink-0 text-mist" aria-hidden /><span className="min-w-0 flex-1 truncate text-sm font-medium" title={a.name}>{a.name}</span><span className="shrink-0 text-[10px] font-semibold text-mist">{Math.max(1,Math.round(a.size/1024))} KB</span><button type="button" disabled={readingFiles} aria-label={`Remove ${a.name}`} onClick={()=>setForm(prev=>({...prev,attachments:prev.attachments.filter((_,j)=>j!==i)}))} className="shrink-0 rounded p-1 text-mist hover:text-ember"><X className="size-3.5" /></button></li>)}</ul>}
     <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm font-medium text-mist hover:border-ember hover:text-ember"><Paperclip className="size-4" aria-hidden />{readingFiles?'Reading files…':form.attachments.length?'Add more files':'Attach files'}<input type="file" multiple hidden disabled={readingFiles||busy} onChange={e=>{void attachFiles(e.target.files);e.target.value=''}} /></label>
     <p className="text-xs text-mist">Up to 3 files, 512 KB each. Attachments are stored in the browser-backed draft and may sync to the app database. Sending attachments is not connected; remove them before sending.</p>
    </div></Field>
          <section className="space-y-2" aria-labelledby="email-scheduling-title">
          <div className="flex items-baseline gap-3"><h2 id="email-scheduling-title" className="font-semibold">Scheduling</h2><span className="text-xs text-mist">When it goes out</span></div>
          <div className="space-y-5">
            <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-line p-1" aria-label="Scheduling mode">
              {([{id:'now',label:'Send now'},{id:'once',label:'One-time'},{id:'recurring',label:'Recurring'}] as const).map(option => <button key={option.id} type="button" aria-pressed={form.schedule.mode===option.id} onClick={()=>setForm({...form,schedule:{...form.schedule,mode:option.id}})} className={`rounded-md px-3 py-2 text-xs ${form.schedule.mode===option.id ? 'bg-black/5 font-semibold dark:bg-white/10' : 'text-mist'}`}>{option.label}</button>)}
            </div>
            {form.schedule.mode === 'once' && <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={form.schedule.date} onChange={e=>setForm({...form,schedule:{...form.schedule,date:e.target.value}})} /></Field>
              <Field label="Time"><Input type="time" value={form.schedule.time} onChange={e=>setForm({...form,schedule:{...form.schedule,time:e.target.value}})} /></Field>
            </div>}
            {form.schedule.mode === 'recurring' && <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repeat"><Select value={form.schedule.repeat} onChange={e=>setForm({...form,schedule:{...form.schedule,repeat:e.target.value as SmsScheduleDraft['repeat']}})}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select></Field>
                <Field label="Time"><Input type="time" value={form.schedule.time} onChange={e=>setForm({...form,schedule:{...form.schedule,time:e.target.value}})} /></Field>
              </div>
              {form.schedule.repeat === 'weekly' && <fieldset><legend className="mb-3 text-sm font-medium">On days</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{SMS_WEEKDAYS.map(day=><label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.schedule.days.includes(day)} onChange={e=>setForm({...form,schedule:{...form.schedule,days:e.target.checked ? [...form.schedule.days,day] : form.schedule.days.filter(d=>d!==day)}})} />{day}</label>)}</div></fieldset>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts"><Input type="date" value={form.schedule.starts} onChange={e=>setForm({...form,schedule:{...form.schedule,starts:e.target.value}})} /></Field>
                <Field label="Ends"><Input type="date" value={form.schedule.ends} onChange={e=>setForm({...form,schedule:{...form.schedule,ends:e.target.value}})} /><p className="mt-1 text-xs text-mist">Leave empty for no end date.</p></Field>
              </div>
            </>}
            <p className="flex gap-2 text-xs text-mist"><Info className="size-4 shrink-0" />{form.schedule.mode === 'now' ? 'Send now submits one email request when you click Send Email.' : `Scheduling is not active. These details can be saved in a draft only; no email will be queued or sent. Intended company timezone: ${companies.find(c=>c.id===activeCompanyId)?.timezone || 'not set'}.`}</p>
          </div>
          </section>
   </div></section></div>
   <aside><section className="card overflow-hidden"><div className="flex items-baseline gap-3 border-b border-line px-5 py-4"><h2 className="font-semibold">Recipient</h2><span className="text-xs text-mist">Who receives it</span></div><div className="space-y-5 p-5"><SmsAudienceSelector channel="email" value={form.audience} onChange={audience=>setForm(prev=>({...prev,audience}))} roles={audiences} groups={churchGroups} students={students} audienceOptions={audienceOptions} branchId={activeBranchId} showChurch={modules.churchManagement===true} to={form.to} onToChange={to=>setForm(prev=>({...prev,to}))} priority={form.priority} onPriorityChange={priority=>setForm(prev=>({...prev,priority}))} /></div></section></aside></div>
   {(notice||outcome)&&<p role="status" className={`rounded-lg border p-3 text-sm ${outcome&&!outcome.ok?'border-amber-500/30 bg-amber-500/10':'border-emerald-500/30 bg-emerald-500/10'}`}>{outcome?.message||notice}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div>{saved&&<Button type="button" variant="ghost" disabled={busy||readingFiles} onClick={()=>{setForm(saved);setEditorVersion(v=>v+1);setNotice('Draft loaded.');setOutcome(null)}}>Load saved draft</Button>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onBack}>Cancel</Button><Button type="button" variant="outline" disabled={busy||readingFiles} onClick={saveDraft}>Save draft</Button><Button type="submit" disabled={busy||readingFiles||form.attachments.length>0||form.schedule.mode!=='now'||!canSendIndividual(form.audience)}><Send className="size-4" />{busy?'Submitting…':'Send Email'}</Button></div></div>
   <p className="text-xs text-mist">Drafts and attempt history are browser-backed and may sync to the app database. Email delivery is not verified.</p>
 </form>
}
