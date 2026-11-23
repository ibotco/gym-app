import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info, Send } from 'lucide-react'
import { Button, Field, Input, Select, Textarea, Modal } from '../../../components/ui'
import { stripHtml } from '../../../components/RichBodyEditor'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useLicense } from '../../../context/LicenseContext'
import { availableEmailTagGroups } from '../../../lib/emailTemplateTags'
import { getNoticeAudiences } from '../../../lib/noticeAudiences'
import { EDU_RECORDS_KEY } from '../../../lib/eduRecords'
import { CHURCH_RECORDS_KEY } from '../../../lib/churchRecords'
import { normalizeSmsAudienceDraft, canSendIndividual, canSendSelectedStudents, type SmsAudienceDraft } from '../../../lib/smsAudienceDraft'
import { SmsAudienceSelector } from './SmsAudienceSelector'
import { planStudentSms, planStudentSmsAudience, readStudentSmsRecords, type StudentSmsRecipient } from '../../../lib/studentSmsRecipients'
import { activeSmsGateway, currentSmsSettings, smsProviderCredentials } from '../../../lib/smsGateway'
import { normalizeInternationalPhone, sendDirectSms } from '../../../lib/directSms'
import { normalizeSmsScheduleDraft, SMS_WEEKDAYS, type SmsScheduleDraft } from '../../../lib/smsScheduleDraft'
import type { SmsAttempt } from './DirectNotifications'

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type Draft = { to:string; message:string; templateId:string; priority:Priority; schedule:SmsScheduleDraft; audience:SmsAudienceDraft }
const draftKey = (companyId:string,userId:string) => `fitpro_sms_compose_draft_v1_${companyId}_${userId}`
function loadDraft(key:string): Draft | null {
  try { const d=JSON.parse(localStorage.getItem(key) || 'null'); if (d && typeof d === 'object') delete d.attachmentUrl; return d && typeof d.to === 'string' && typeof d.message === 'string' && typeof d.templateId === 'string' ? { ...d, priority: ['low','normal','high','urgent'].includes(d.priority) ? d.priority : 'normal', schedule:normalizeSmsScheduleDraft(d.schedule), audience:normalizeSmsAudienceDraft(d.audience,d.target) } : null } catch { return null }
}
function senderName() {
  if (!activeSmsGateway()) return 'No active default provider'
  const m = currentSmsSettings()
  if (m.smsMode === 'hubtel') return m.hubtelFrom || 'Not configured'
  if (m.smsMode === 'mnotify') return m.mnotifySender || 'Not configured'
  if (m.smsMode === 'wigal') return m.wigalSender || 'Not configured'
  if (m.smsMode === 'twilio') return m.twilioSender || 'Not configured'
  if (m.smsMode === 'webhook') return 'Managed by webhook'
  if (m.smsMode === 'link') return 'Manual SMS app (not supported)'
  return smsProviderCredentials(m).sender || 'Provider default / not configured'
}
export function ComposeSms({onBack,onSmsResult}:{onBack:()=>void;onSmsResult:(attempt:SmsAttempt)=>void}) {
  const {activeCompanyId,messageTemplates,modules,companies,roles,users,activeBranchId} = useApp()
  const {user} = useAuth()
  const {currentPackage,pkgActive} = useLicense()
  const [form,setForm] = useState<Draft>({to:'',message:'',templateId:'',priority:'normal',schedule:normalizeSmsScheduleDraft(null),audience:normalizeSmsAudienceDraft(null)})
  const [category,setCategory] = useState('General')
  const [tagSearch,setTagSearch] = useState('')
  const [busy,setBusy] = useState(false)
  const [outcome,setOutcome] = useState<{ok:boolean;message:string}|null>(null)
  const [notice,setNotice] = useState('')
  const [confirmation,setConfirmation] = useState<StudentSmsRecipient[] | null>(null)
  const [batchDone,setBatchDone] = useState(false)
  const scope = useRef({companyId:activeCompanyId,branchId:activeBranchId})
  scope.current = {companyId:activeCompanyId,branchId:activeBranchId}
  useEffect(() => { scope.current = {companyId:activeCompanyId,branchId:activeBranchId}; return () => { scope.current = {companyId:'',branchId:''} } }, [activeCompanyId,activeBranchId])
  const sending = useRef(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const audiences = getNoticeAudiences(roles,activeCompanyId,modules,currentPackage?.modules,pkgActive)
  const churchGroups = (() => {
    if (!modules.churchManagement || !activeBranchId) return []
    try { const saved = JSON.parse(localStorage.getItem(CHURCH_RECORDS_KEY) || '{}'); const list = saved?.[activeBranchId]?.ministries; return Array.isArray(list) ? list.filter((x:unknown): x is {id:string;name:string;status:string} => !!x && typeof x === 'object' && typeof (x as {id?:unknown}).id === 'string' && typeof (x as {name?:unknown}).name === 'string').map((x:{id:string;name:string}) => ({id:x.id,name:x.name})) : [] } catch { return [] }
  })()
  const audienceOptions:Record<string,{id:string;name:string}[]> = {}
  const display = (r:{id:string;name?:unknown;phone?:unknown}) => ({id:r.id,name:[String(r.name || 'Unnamed'),String(r.phone || 'No phone')].join(' · ')})
  for (const role of audiences) {
    if (role.id.startsWith('audience_')) continue
    audienceOptions[`audience:${role.id}`] = users.filter(u=>u.role===role.id && u.companyId===activeCompanyId && u.branchId===activeBranchId).map(display)
  }
  try {
    const ed=JSON.parse(localStorage.getItem(EDU_RECORDS_KEY) || '{}')?.[activeBranchId]
    audienceOptions['audience:audience_parent'] = Array.isArray(ed?.parents) ? ed.parents.filter((r:any)=>typeof r?.id==='string').map(display) : []
    const church=JSON.parse(localStorage.getItem(CHURCH_RECORDS_KEY) || '{}')?.[activeBranchId]
    const congregation=Array.isArray(church?.congregation) ? church.congregation.filter((r:any)=>typeof r?.id==='string').map(display) : []
    audienceOptions['audience:audience_congregation']=congregation
    // Church group categories are selectable records, not inferred membership.
    const records=Array.isArray(church?.ministries) ? church.ministries.filter((r:any)=>typeof r?.id==='string') : []
    const category:Record<string,string[]>={'church:ministries':['ministry'],'church:homeCells':['cell group','home cell'],'church:bibleStudy':['bible study','bible study group'],'church:committees':['committee'],'church:guilds':['guild']}
    for (const [key,values] of Object.entries(category)) audienceOptions[key]=records.filter((r:any)=>values.includes(String(r.category || '').trim().toLowerCase())).map(display)
  } catch { /* Unreadable source: no recipients are inferred. */ }
  const studentRecords = readStudentSmsRecords(activeBranchId)
  const studentOptions = studentRecords.map(s=>({id:s.id,name:[s.name || 'Unnamed student',s.admissionNo,s.className,s.phone || 'No phone'].filter(Boolean).join(' · ')}))
  const templates = messageTemplates.filter(t=>t.channel==='sms' && t.active)
  const groups = availableEmailTagGroups(modules,currentPackage?.modules,pkgActive)
  const chosen = groups.find(g=>g.label===category) || groups[0]
  const q = tagSearch.trim().toLowerCase().replace(/[{}]/g,'')
  const tags = q ? [...new Set(groups.flatMap(g=>g.tags.filter(t=>t.toLowerCase().includes(q) || g.label.toLowerCase().includes(q))))] : chosen?.tags || []
  const key = draftKey(activeCompanyId,user?.id || 'unknown')
  const saved = loadDraft(key)
  function selectTemplate(id:string) {
    if (!id) { setForm(prev=>({...prev,templateId:''})); return }
    const t = templates.find(x=>x.id===id)
    if (!t) return
    if (form.message.trim() && !window.confirm('Replace the current message with this template?')) return
    const text = stripHtml(t.body.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>/gi,'\n')).trim()
    setForm(prev=>({...prev,templateId:id,message:text}))
  }
  function insertTag(tag:string) {
    const el=textRef.current, start=el?.selectionStart ?? form.message.length, end=el?.selectionEnd ?? start
    setForm(prev=>({...prev,message:prev.message.slice(0,start)+tag+prev.message.slice(end)}))
    requestAnimationFrame(()=>{ el?.focus(); el?.setSelectionRange(start+tag.length,start+tag.length) })
  }
  function saveDraft() {
    try { localStorage.setItem(key,JSON.stringify(form)); setNotice('Draft saved. One draft is stored per user and company; saving again replaces it.'); setOutcome(null) }
    catch { setOutcome({ok:false,message:'Draft could not be saved in this browser.'}) }
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (sending.current) return
    const isStudents = canSendSelectedStudents(form.audience)
    if (!canSendIndividual(form.audience) && !isStudents) { setOutcome({ok:false,message:'Select only specific students or one custom number; other groups and exclusions cannot be sent.'}); return }
    if (form.schedule.mode !== 'now') { setOutcome({ok:false,message:'Scheduled SMS is not available. Save this as a draft or select Send now.'}); return }
    if (!isStudents && !normalizeInternationalPhone(form.to)) {setOutcome({ok:false,message:'Enter a valid international number beginning with + and country code.'});return}
    if (!form.message.trim()) {setOutcome({ok:false,message:'Enter an SMS message.'});return}
    if (/\{\{[^{}]+\}\}/.test(form.message)) {setOutcome({ok:false,message:'Replace all tags with actual values before sending. Automatic substitution is not connected.'});return}
    if (isStudents) {
      if (!activeBranchId || form.audience.studentBranchId !== activeBranchId) { setOutcome({ok:false,message:'The selected students belong to a different or unavailable branch. Select them again.'}); return }
      const plan=planStudentSmsAudience(readStudentSmsRecords(activeBranchId),form.audience.students)
      if (plan.error) { setOutcome({ok:false,message:plan.error}); return }
      setConfirmation(plan.recipients); return
    }
    sending.current=true;setBusy(true);setOutcome(null);setNotice('')
    const to=form.to.trim(), message=form.message.trim(), companyId=activeCompanyId
    try {
      const result=await sendDirectSms(to,message)
      onSmsResult({companyId,to,message,ok:result.ok,priority:form.priority})
      setOutcome(result.ok ? {ok:true,message:'Request submitted to the configured provider. Delivery is not verified.'} : {ok:false,message:result.error || 'Request could not be confirmed. Check the provider before retrying.'})
    } catch { onSmsResult({companyId,to,message,ok:false,priority:form.priority}); setOutcome({ok:false,message:'The request outcome is unknown. Check the provider before retrying to avoid duplicates.'}) }
    finally {sending.current=false;setBusy(false)}
  }
  async function sendStudents() {
    if (sending.current || !confirmation || batchDone) return
    const companyId=activeCompanyId, branchId=activeBranchId, selected=form.audience.students
    if (!canSendSelectedStudents(form.audience) || form.schedule.mode !== 'now' || !branchId || form.audience.studentBranchId !== branchId) {setConfirmation(null);setOutcome({ok:false,message:'Audience or schedule changed. Review the message again.'});return}
    const latest=planStudentSmsAudience(readStudentSmsRecords(branchId),selected)
    if (latest.error || JSON.stringify(latest.recipients) !== JSON.stringify(confirmation)) {setConfirmation(null);setOutcome({ok:false,message:latest.error || 'Student details changed. Review the selection again.'});return}
    const message=form.message.trim()
    if (!form.message.trim() || /\{\{[^{}]+\}\}/.test(message)) {setConfirmation(null);setOutcome({ok:false,message:'Enter a message with no unresolved tags.'});return}
    sending.current=true;setBusy(true);setConfirmation(null);setOutcome(null);setNotice('')
    let submitted=0, attempted=0, failure=''
    try {
      for (const student of latest.recipients) {
        if (scope.current.companyId !== companyId || scope.current.branchId !== branchId) { failure='Company or branch changed; remaining students were not attempted.'; break }
        // Recheck current stored record immediately before each provider call.
        const current=planStudentSms(readStudentSmsRecords(branchId),[student.id])
        if (current.error || JSON.stringify(current.recipients[0]) !== JSON.stringify(student)) { failure='A student record changed; remaining students were not attempted.'; break }
        attempted++
        const result=await sendDirectSms(student.phone,message)
        onSmsResult({companyId,to:student.phone,message,ok:result.ok,priority:form.priority})
        if (!result.ok) {failure=result.error || 'A request was not confirmed; remaining students were not attempted.';break}
        submitted++
      }
      const remaining=latest.recipients.length-attempted
      setOutcome({ok:!failure,message:`${submitted} request(s) submitted; ${attempted-submitted} unconfirmed; ${remaining} not attempted. Delivery is not verified.${failure ? ` ${failure} Check the provider before retrying.` : ''}`})
    } catch {setOutcome({ok:false,message:`${submitted} request(s) submitted before an unknown outcome. Remaining students were not attempted. Check the provider before retrying.`})}
    finally { if (attempted>0) setBatchDone(true); sending.current=false;setBusy(false) }
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-mist">Communication</p><h1 className="text-2xl font-bold">New SMS</h1></div><Button type="button" variant="outline" disabled={busy} onClick={onBack}><ArrowLeft className="size-4" /> Back to SMS notifications</Button></div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(250px,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="card overflow-hidden"><div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4"><h2 className="font-semibold">Message</h2><span className="text-xs text-mist">What you are sending</span></div><div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Template"><Select value={form.templateId} onChange={e=>selectTemplate(e.target.value)}><option value="">Start from a template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><p className="mt-1 text-xs text-mist">Optional starting point.</p></Field><Field label="Sender ID"><Input value={senderName()} readOnly aria-label="Configured sender ID" /><p className="mt-1 text-xs text-mist">Managed by the active SMS provider in Company Settings.</p></Field></div>
          <Field label="SMS content" required><Textarea ref={textRef} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={6} placeholder="Write your message…" required /><p className="mt-1 text-xs text-mist">{Array.from(form.message).length} characters. Segments and cost depend on encoding and provider.</p></Field>
          <div className="space-y-2"><div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_minmax(0,13rem)_minmax(0,13rem)]"><label htmlFor="sms-tag-module" className="whitespace-nowrap text-xs font-semibold text-mist">Insert tag</label><div className="min-w-0"><Select id="sms-tag-module" value={chosen?.label || ''} onChange={e=>{setCategory(e.target.value);setTagSearch('')}}>{groups.map(g=><option value={g.label} key={g.label}>{g.label}</option>)}</Select></div><div className="col-span-2 min-w-0 sm:col-span-1"><Input aria-label="Search insert tags" placeholder="Search tags" value={tagSearch} onChange={e=>setTagSearch(e.target.value)} /></div></div><div className="flex flex-wrap gap-1.5">{tags.map(tag=><button type="button" key={tag} onMouseDown={e=>e.preventDefault()} onClick={()=>insertTag(tag)} className="rounded-md border border-line px-2 py-1 font-mono text-xs hover:border-violet-500">{tag}</button>)}{!tags.length && <p className="text-xs text-mist">No matching tags.</p>}</div><p className="text-xs text-mist">Tags are placeholders only; replace them with actual values before sending.</p></div>
          <section className="space-y-2" aria-labelledby="sms-scheduling-title">
          <div className="flex items-baseline gap-3"><h2 id="sms-scheduling-title" className="font-semibold">Scheduling</h2><span className="text-xs text-mist">When it goes out</span></div>
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
            <p className="flex gap-2 text-xs text-mist"><Info className="size-4 shrink-0" />{form.schedule.mode === 'now' ? 'Send now submits requests when you click Send SMS; selected students are reviewed before sending.' : `Scheduling is not active. These details can be saved in a draft only; no SMS will be queued or sent. Intended company timezone: ${companies.find(c=>c.id===activeCompanyId)?.timezone || 'not set'}.`}</p>
          </div>
          </section>
        </div></section>
      </div>
      <aside className="space-y-5"><section className="card overflow-hidden"><div className="flex items-baseline gap-3 border-b border-line px-5 py-4"><h2 className="font-semibold">Recipient</h2><span className="text-xs text-mist">Who receives it</span></div><div className="space-y-4 p-5"><SmsAudienceSelector value={form.audience} onChange={audience=>setForm({...form,audience})} roles={audiences} groups={churchGroups} students={studentOptions} audienceOptions={audienceOptions} branchId={activeBranchId} showChurch={modules.churchManagement === true} to={form.to} onToChange={to=>setForm({...form,to})} priority={form.priority} onPriorityChange={priority=>setForm({...form,priority})} /></div></section></aside>
    </div>
    {(notice || outcome) && <p role="status" className={`rounded-lg border p-3 text-sm ${outcome && !outcome.ok ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>{outcome?.message || notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div>{saved && <Button type="button" variant="ghost" disabled={busy} onClick={()=>{if (saved.audience.excludeTypes.length && !window.confirm('This older draft contains exclusions, but exclusions are no longer available. Loading will remove them and may increase the intended audience. Continue and review recipients before sending?')) return; setForm({...saved,audience:{...saved.audience,excludeTypes:[],excludeRoles:[],excludeGroups:[]}});setNotice('Draft loaded. Review the audience before sending.');setOutcome(null)}}>Load saved draft</Button>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onBack}>Cancel</Button><Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>Save draft</Button><Button type="submit" disabled={busy || batchDone || form.schedule.mode !== 'now' || (!canSendIndividual(form.audience) && !canSendSelectedStudents(form.audience))}><Send className="size-4" />{busy?'Submitting…':'Send SMS'}</Button></div></div>
    {batchDone && <p className="text-xs text-mist">This student batch has been attempted. Return to SMS notifications and start a new message before sending again.</p>}
    {confirmation && <Modal open title="Confirm student SMS" onClose={()=>setConfirmation(null)} maxWidth="2xl"><p className="text-sm">{form.audience.students.length ? 'Send to selected students' : 'Send to ALL students in this branch'}: {confirmation.length} recipient(s). Continue? The provider may charge for each request. Delivery is not verified.</p><ul className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-line p-3 text-sm">{confirmation.map(s=><li key={s.id}>{s.name}{s.admissionNo ? ` · ${s.admissionNo}` : ''}{s.className ? ` · ${s.className}` : ''} · {s.phone}</li>)}</ul><div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setConfirmation(null)}>Cancel</Button><Button type="button" onClick={()=>void sendStudents()}>Confirm and send</Button></div></Modal>}
    <p className="text-xs text-mist">Drafts and attempt history are browser-backed and may sync to the app database. SMS delivery is not verified.</p>
  </form>
}
