import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { Button, Field, Input, Modal, Select, Switch } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { loadCredentialSettings } from '../../../lib/credentials'
import { loadIntegrations, saveIntegrations } from '../../../lib/integrations'
import { applyInitialHubtelDefault, smsProviderReady } from '../../../lib/smsGateway'
import type { MessagingConfig } from '../../../types'

type Mode = MessagingConfig['smsMode']
const labels: Record<Mode,string> = {mnotify:'mNotify',wigal:'Wigal (FROG)',hubtel:'Hubtel',twilio:'Twilio',webhook:'Custom Gateway (webhook)',link:'Manual SMS app',clickatell:'Clickatell',msg91:'MSG91',africastalking:"Africa’s Talking",textlocal:'TextLocal (India)',smscountry:'SMS Country Gateway'}
const modes: Mode[] = ['mnotify','wigal','hubtel','twilio','clickatell','msg91','africastalking','textlocal','smscountry','webhook','link']
const secrets = ['hubtelClientSecret','mnotifyApiKey','wigalApiKey','twilioAuthToken'] as const
const fields: Record<Mode, {key:keyof MessagingConfig; label:string; secret?:boolean}[]> = {
 hubtel:[{key:'hubtelClientId',label:'Client ID'},{key:'hubtelClientSecret',label:'Client secret',secret:true},{key:'hubtelFrom',label:'Sender name / number'}],
 mnotify:[{key:'mnotifyApiKey',label:'API key',secret:true},{key:'mnotifySender',label:'Sender ID (maximum 11 characters)'}],
 wigal:[{key:'wigalUsername',label:'Username'},{key:'wigalApiKey',label:'API key',secret:true},{key:'wigalSender',label:'Approved sender ID'}],
 twilio:[{key:'twilioAccountSid',label:'Account SID'},{key:'twilioAuthToken',label:'Auth token',secret:true},{key:'twilioSender',label:'Sender number or ID'}],
 webhook:[{key:'smsWebhookUrl',label:'HTTPS webhook URL'}], link:[], clickatell:[],msg91:[],africastalking:[],textlocal:[],smscountry:[],
}
function legacyStates(m: MessagingConfig): Partial<Record<Mode,boolean>> {
 if (m.smsProviderStates) return {...m.smsProviderStates}
 // Preserve the existing selected mode as a row; a default manual mode is not a provider configuration.
 return m.smsMode === 'link' ? {} : {[m.smsMode]:true}
}
function blankSecrets(m: MessagingConfig): MessagingConfig {
 const out = {...m}; for (const k of secrets) out[k] = ''; return out
}
const extraFields: Partial<Record<Mode,{key:string;label:string;secret?:boolean}[]>> = {
 clickatell:[{key:'apiKey',label:'API key',secret:true},{key:'sender',label:'Sender ID (optional)'}],
 msg91:[{key:'apiKey',label:'Auth key',secret:true},{key:'sender',label:'Sender ID'},{key:'route',label:'Route (e.g. 4)'}],
 africastalking:[{key:'username',label:'Username'},{key:'apiKey',label:'API key',secret:true},{key:'sender',label:'Sender ID (optional)'}],
 textlocal:[{key:'apiKey',label:'API key',secret:true},{key:'sender',label:'Approved sender ID'}],
 smscountry:[{key:'username',label:'Username'},{key:'password',label:'Password',secret:true},{key:'sender',label:'Approved sender ID'}],
}
function sender(m:MessagingConfig, mode:Mode) {
 return mode==='hubtel' ? m.hubtelFrom : mode==='mnotify' ? m.mnotifySender : mode==='wigal' ? m.wigalSender : mode==='twilio' ? m.twilioSender : mode==='webhook' ? 'Webhook' : mode==='link' ? 'Device SMS app' : m.smsExtraProviders?.[mode]?.sender || '—'
}
export function SmsGateways() {
 const {setCredentialSettings} = useApp(); const {hasRole} = useAuth(); const toast=useToast()
 const canManage=hasRole('super_admin','gym_manager')
 const [messaging,setMessaging]=useState(() => loadCredentialSettings().messaging)
 useEffect(()=>{
  if (!canManage) return
  const latest=loadCredentialSettings(); const updated=applyInitialHubtelDefault(latest.messaging)
  if(updated !== latest.messaging){setCredentialSettings({...latest,messaging:updated});setMessaging(updated)}
 },[canManage,setCredentialSettings])
 const [integration,setIntegration]=useState(() => loadIntegrations().find(r=>r.id==='int_sms'))
 const [query,setQuery]=useState(''); const [filter,setFilter]=useState('all')
 const [editing,setEditing]=useState<Mode|null>(null); const [creating,setCreating]=useState(false)
 const [draft,setDraft]=useState<MessagingConfig>(()=>blankSecrets(loadCredentialSettings().messaging))
 const [draftActive,setDraftActive]=useState(true)
 const [extraDraft,setExtraDraft]=useState<Record<string,string>>({})
 const states=legacyStates(messaging); const defaultSet=messaging.smsDefaultSet !== false
 const rows=useMemo(()=>modes.filter(mode=>Object.prototype.hasOwnProperty.call(states,mode) && (filter==='all'||(filter==='active' ? states[mode] : !states[mode])) && `${labels[mode]} ${sender(messaging,mode)}`.toLowerCase().includes(query.toLowerCase().trim())),[messaging,query,filter])
 const persist=(next:MessagingConfig)=>{ const latest=loadCredentialSettings();setCredentialSettings({...latest,messaging:next});setMessaging(next) }
 const open=(mode:Mode, add:boolean)=>{const m=loadCredentialSettings().messaging;setDraft({...blankSecrets(m),smsMode:mode});setDraftActive(add ? true : !!legacyStates(m)[mode]);setExtraDraft({...m.smsExtraProviders?.[mode],apiKey:'',password:''});setCreating(add);setEditing(mode)}
 const save=()=>{
  if(!canManage || !editing) return
  const latest=loadCredentialSettings().messaging; const before=legacyStates(latest); const chosen=draft.smsMode
  if(creating && Object.prototype.hasOwnProperty.call(before,chosen)) {toast.error('This provider is already configured. Edit its existing row.');return}
  const next={...latest} as MessagingConfig
  if(extraFields[chosen]) {const old=latest.smsExtraProviders?.[chosen] || {};const saved={...old};for(const f of extraFields[chosen] || []) {const value=(extraDraft[f.key] || '').trim();if(!f.secret || value)saved[f.key]=value}next.smsExtraProviders={...latest.smsExtraProviders,[chosen]:saved}}
  for (const field of fields[chosen]) {const value=String(draft[field.key]??'').trim(); if(!field.secret || value) (next as unknown as Record<string,unknown>)[field.key]=value}
  if(chosen==='webhook' && next.smsWebhookUrl && !/^https:\/\//i.test(next.smsWebhookUrl)) {toast.error('Webhook URL must use HTTPS.');return}
  if(chosen==='mnotify' && next.mnotifySender.length>11) {toast.error('mNotify sender ID must be at most 11 characters.');return}
  next.smsProviderStates={...before,[chosen]:draftActive}
  // Editing a different provider must never change the default.
  next.smsDefaultSet=latest.smsDefaultSet !== false && (latest.smsMode==='link' && !Object.prototype.hasOwnProperty.call(before,'link') ? false : !!next.smsProviderStates[latest.smsMode])
  persist(next);setEditing(null);toast.success('SMS provider saved', 'Provider connection and delivery have not been verified.')
 }
 const makeDefault=(mode:Mode)=>{
  if(!canManage)return
  const next=loadCredentialSettings().messaging; const st=legacyStates(next)
  if(!st[mode]){toast.error('Activate the provider before making it the default.');return}
  if(mode!=='link' && !smsProviderReady({...next,smsMode:mode})) {toast.error('Complete this provider’s settings before making it the default.');return}
  persist({...next,smsProviderStates:st,smsMode:mode,smsDefaultSet:true});toast.success(`${labels[mode]} is the default`, 'The provider has not been verified.')
 }
 const setProviderActive=async (mode:Mode, active:boolean)=>{
  if(!canManage)return
  const before=loadCredentialSettings().messaging
  if (!active && before.smsMode===mode && before.smsDefaultSet!==false) {
   const result=await Swal.fire({width:'25rem', customClass:{popup:'sms-status-alert'}, title:`Deactivate ${labels[mode]}?`,text:'This is the default provider. SMS will stop until another active default is selected. Saved settings will be retained.',icon:'warning',showCancelButton:true,confirmButtonText:'Deactivate',cancelButtonText:'Cancel',reverseButtons:true})
   if(!result.isConfirmed)return
  }
  const latest=loadCredentialSettings().messaging; const st=legacyStates(latest)
  if(!Object.prototype.hasOwnProperty.call(st,mode)){toast.error('This provider is no longer in the list.');return}
  st[mode]=active
  persist({...latest,smsProviderStates:st,smsDefaultSet:!active && latest.smsMode===mode ? false : latest.smsDefaultSet})
  toast.success(`${labels[mode]} ${active ? 'activated' : 'deactivated'}`)
 }
 const remove=(mode:Mode)=>{
  if(!canManage || !window.confirm(`Remove ${labels[mode]} from this list? Its saved credentials will be retained.`))return
  const next=loadCredentialSettings().messaging; const st=legacyStates(next); delete st[mode]
  persist({...next,smsProviderStates:st,smsDefaultSet:next.smsMode===mode ? false : next.smsDefaultSet});toast.success('Provider removed from the list')
 }
 const setGatewayActive=async (active:boolean)=>{
  if(!canManage)return
  if(!active) {
   const result = await Swal.fire({title:'Disable the SMS gateway?', text:'Supported SMS features will stop; settings will be retained.', icon:'warning', showCancelButton:true, confirmButtonText:'Disable gateway', cancelButtonText:'Cancel', reverseButtons:true})
   if(!result.isConfirmed) return
  }
  const list=loadIntegrations();const found=list.find(r=>r.id==='int_sms');if(!found){toast.error('SMS gateway record not found.');return}
  const updated={...found,active,updatedAt:new Date().toISOString()}; saveIntegrations(list.map(r=>r.id==='int_sms'?updated:r));setIntegration(updated)
 }
 return <div className="mt-4 space-y-4">
  <div><p className="font-semibold">SMS gateway</p><p className="text-sm text-mist">Configure providers and choose one active default for supported SMS features. Provider connections and delivery are not verified.</p><p className="text-xs text-mist">Credentials are browser-backed and may sync to the database. The API lacks server-side authorization; use only in a trusted, restricted environment. Automatic fee reminders remain unavailable.</p></div>
  {integration && !integration.active && <div className="flex flex-wrap items-center gap-3 text-sm text-mist"><span>The SMS gateway is disabled.</span><Button variant="outline" disabled={!canManage} onClick={()=>void setGatewayActive(true)}>Enable SMS gateway</Button></div>}
  <div className="card p-4 space-y-4"><div className="flex flex-wrap items-center gap-3"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search providers or sender IDs" className="max-w-xs"/><Select value={filter} onChange={e=>setFilter(e.target.value)} className="w-36"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select><span className="text-sm text-mist">{rows.length} entries</span><div className="ml-auto"><Button disabled={!canManage} onClick={()=>open('hubtel',true)}>+ Add provider</Button></div></div>
   <div className="table-wrap"><table className="data"><thead><tr><th>Provider</th><th>Sender ID</th><th>Status</th><th>Default</th><th>Action</th></tr></thead><tbody>{rows.map(mode=><tr key={mode}><td>{labels[mode]}</td><td>{sender(messaging,mode)||'—'}</td><td><div className="flex items-center gap-2"><Switch checked={!!states[mode]} disabled={!canManage} aria-label={`${labels[mode]} status`} onChange={active=>void setProviderActive(mode,active)} /><span>{states[mode]?'Active':'Inactive'}</span></div></td><td>{defaultSet && messaging.smsMode===mode ? <>Default{mode!=='link' && !smsProviderReady({...messaging,smsMode:mode}) && <span className="ml-2 text-amber-600">Setup required</span>}</> : '—'}</td><td><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!canManage} onClick={()=>open(mode,false)}>Edit</Button><Button variant="outline" disabled={!canManage || !states[mode] || (defaultSet && messaging.smsMode===mode)} onClick={()=>makeDefault(mode)}>Set default</Button><Button variant="outline" disabled={!canManage} onClick={()=>remove(mode)}>Remove</Button></div></td></tr>)}{!rows.length && <tr><td colSpan={5} className="py-8 text-center text-mist">No provider configurations match.</td></tr>}</tbody></table></div>
  </div>
  <Modal open={editing!==null} onClose={()=>setEditing(null)} title={creating?'Add SMS provider':'Edit SMS provider'}>
   <div className="space-y-4"><Field label="SMS provider"><Select value={draft.smsMode} disabled={!creating} onChange={e=>{const mode=e.target.value as Mode;setDraft({...draft,smsMode:mode});setExtraDraft({...loadCredentialSettings().messaging.smsExtraProviders?.[mode],apiKey:'',password:''})}}>{modes.filter(mode=>!creating || mode!=='link').map(mode=><option key={mode} value={mode}>{labels[mode]}</option>)}</Select></Field>
   {fields[draft.smsMode].map(field=><Field key={field.key} label={field.label}><Input type={field.secret?'password':'text'} value={String(draft[field.key]??'')} placeholder={field.secret?'Leave blank to retain saved value':undefined} onChange={e=>setDraft({...draft,[field.key]:e.target.value})}/></Field>)}
   {(extraFields[draft.smsMode] || []).map(field=><Field key={field.key} label={field.label}><Input type={field.secret?'password':'text'} value={extraDraft[field.key] || ''} placeholder={field.secret?'Leave blank to retain saved value':undefined} onChange={e=>setExtraDraft({...extraDraft,[field.key]:e.target.value})}/></Field>)}
   {draft.smsMode==='msg91' && <p className="text-xs text-mist">Approved templates, sender IDs and DLT requirements may apply to your destination and account.</p>}
   {draft.smsMode==='textlocal' && <p className="text-xs text-mist">Uses the TextLocal India API; approved templates and sender IDs may be required.</p>}
   {draft.smsMode==='mnotify' && <p className="text-xs text-mist">International destinations may require an approved template and are not supported by the quick SMS endpoint.</p>}
   <Field label="Status"><Select value={draftActive?'active':'inactive'} onChange={e=>setDraftActive(e.target.value==='active')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field><p className="text-xs text-mist">Deactivating the default stops SMS until another active default is selected. Saved credentials are retained.</p><Button onClick={save} disabled={!canManage}>Save provider</Button></div>
  </Modal>
 </div>
}
