import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Badge, Button, Modal } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { USERS, AUDIT } from '../../../data/seed'
import { isSeedMergeSuppressed, isCollectionMarkedCleared } from '../../../lib/dataReset'
import { loadRoles, loadPermissions } from '../../../lib/permissions'
import { USER_DATA_MENUS, USER_DATA_KEYS, planUserDataClear } from '../../../lib/userManagementDataClear'
import { flushDataMaintenanceChanges, getMysqlState } from '../../../lib/mysqlBridge'
import { downloadText } from '../../../lib/utils'
const keys=USER_DATA_KEYS
function snapshot(){const out:Record<string,string>={};for(const k of keys){const raw=localStorage.getItem(k);if(raw!==null)out[k]=raw}return out}
function fallbacks():Record<string,unknown>{
 let users:any[]=USERS
 const raw=localStorage.getItem('fitpro_users')
 if(raw){const saved=JSON.parse(raw);if(!Array.isArray(saved))throw new Error('Invalid user data.');if(isSeedMergeSuppressed('fitpro_users'))users=saved;else{const byId=new Map(saved.map((u:any)=>[u.id,u]));users=[...USERS.map(u=>({...u,...(byId.get(u.id) as object||{})})),...saved.filter((u:any)=>!USERS.some(s=>s.id===u.id))]}}
 else if(isSeedMergeSuppressed('fitpro_users'))users=[]
 return {fitpro_users:users,fitpro_roles:loadRoles(),fitpro_permissions:loadPermissions(),fitpro_audit_logs:isCollectionMarkedCleared('audit')?[]:AUDIT}
}
export function UserManagementDataControls({canClear,version,onChanged}:{canClear:boolean;version:number;onChanged:()=>void}){
 const toast=useToast(),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
 const data=useMemo(()=>{try{const stores=snapshot(),defaults=fallbacks();return {stores,defaults,counts:planUserDataClear(stores,defaults,[]).counts,error:''}}catch(e){return {stores:{},defaults:{},counts:{} as Record<string,number>,error:e instanceof Error?e.message:'Storage unavailable'}}},[version])
 async function run(){if(!canClear||busy||!selected.length||data.error)return;setBusy(true);try{
  const state=getMysqlState();if(!state.connected||state.syncing||state.error)throw new Error('Database is disconnected, busy or has unsynced changes. Resolve these before clearing.')
  const before=snapshot();if(JSON.stringify(before)!==JSON.stringify(data.stores))throw new Error('User data changed. Refresh counts before trying again.')
  const plan=planUserDataClear(before,data.defaults,selected)
  if(!await downloadText(`user-management-before-clear-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify({createdAt:new Date().toISOString(),description:'Private user management data before selected menu clear',selected,stores:before,visibleSeedData:data.defaults},null,2),'application/json'))throw new Error('Backup download failed; no data was cleared.')
  if(JSON.stringify(snapshot())!==JSON.stringify(before))throw new Error('User data changed during backup; no data was cleared.')
  for(const [key,value] of Object.entries(plan.changes))localStorage.setItem(key,value)
  const saved=await flushDataMaintenanceChanges();onChanged();setSelected([]);setConfirm(false)
  if(saved){toast.success('Selected user management data cleared','Reloading to refresh the application state.');window.setTimeout(()=>window.location.reload(),600)}else toast.error('Database save not confirmed','Changes remain in this browser’s sync queue. Do not refresh; resolve the sync error before continuing.')
 }catch(e){onChanged();toast.error('Clear operation could not be completed',e instanceof Error?e.message:'Review backup and sync state.')}finally{setBusy(false)}}
 return <div className="space-y-2 px-2 py-2"><p className="text-xs text-mist">Select menus independently. Counts include saved records and visible sample defaults across companies in this browser. Shared stores are changed only for the selected menus.</p><p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-700 dark:text-amber-300">A private backup containing sensitive account data is required. Clearing users or custom roles can prevent login or change access. Linked people and user-role assignments are not repaired. Other clients can overwrite changes; this operation is not atomic.</p>{data.error&&<p role="alert" className="text-xs text-rose-500">{data.error}</p>}{USER_DATA_MENUS.map(m=><div key={m.id} className="rounded-lg border border-line px-3 py-2"><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#c8f542]" checked={selected.includes(m.id)} disabled={!canClear||busy||!!data.error||!data.counts[m.id]} onChange={e=>{const checked=e.target.checked;setSelected(v=>checked?[...v,m.id]:v.filter(x=>x!==m.id))}}/><span className="flex-1 font-semibold">{m.label}</span><Badge tone={data.counts[m.id]?'lime':'zinc'}>{data.counts[m.id]??0} records</Badge></label><p className="ml-7 mt-1 text-xs text-mist">{m.desc}</p></div>)}<div className="flex flex-wrap items-center justify-between gap-2 pt-2"><span className="text-xs text-mist">{selected.length} User Management menus selected</span><Button variant="danger" size="sm" disabled={!canClear||!selected.length||busy} onClick={()=>setConfirm(true)}><Trash2 className="size-4"/> Clear selected user management menus</Button></div><Modal open={confirm} onClose={()=>!busy&&setConfirm(false)} title="Clear selected user management menus?" wide><div className="space-y-3"><p className="flex items-start gap-2 text-sm text-amber-600"><AlertTriangle className="size-4 shrink-0"/>Clearing all users can prevent login; clearing custom roles or the permission matrix can change access. Linked people and role assignments are not repaired. This cannot be undone here.</p>{USER_DATA_MENUS.filter(m=>selected.includes(m.id)).map(m=><div key={m.id} className="rounded border border-line p-2 text-sm"><strong>{m.label}</strong> · {data.counts[m.id]||0} records<p className="text-xs text-mist">{m.desc}</p></div>)}<p className="text-xs text-mist">A private backup will be downloaded. Browser writes and database sync are not atomic; on success the page reloads.</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={()=>void run()}>{busy?'Saving…':'Download backup and clear'}</Button></div></div></Modal></div>
}
