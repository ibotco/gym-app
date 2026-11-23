import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Badge, Button, Modal } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { loadProjects } from '../../../lib/projects'
import { loadContracts } from '../../../lib/contracts'
import { loadTasks } from '../../../lib/tasks'
import { loadWorkStages, loadTaskTemplates } from '../../../lib/taskTemplates'
import { loadTimesheets } from '../../../lib/timesheets'
import { loadProjectInvoices } from '../../../lib/projectInvoices'
import { loadProjectTypes, loadContractTypes } from '../../../lib/projectTypes'
import { loadProjectStatuses, loadProjectPriorities, loadProjectCategories } from '../../../lib/projectSettings'
import { loadMilestones } from '../../../lib/milestones'
import { loadProjectFiles } from '../../../lib/projectFiles'
import { loadProjectNotes } from '../../../lib/projectNotes'
import { loadProjectDiscussions } from '../../../lib/projectDiscussions'
import { loadProjectTickets } from '../../../lib/projectTickets'
import { loadProjectPurchases } from '../../../lib/projectPurchases'
import { PROJECT_DATA_MENUS, PROJECT_DATA_KEYS, planProjectDataClear } from '../../../lib/projectDataClear'
import { flushDataMaintenanceChanges, getMysqlState } from '../../../lib/mysqlBridge'
import { downloadText } from '../../../lib/utils'
const keys=Object.values(PROJECT_DATA_KEYS).flat()
function snapshot(){const out:Record<string,string>={};for(const k of keys){const raw=localStorage.getItem(k);if(raw!==null)out[k]=raw}return out}
function fallbacks():Record<string,unknown>{return {fitpro_projects_v1:loadProjects(),fitpro_contracts_v1:loadContracts(),fitpro_tasks_v1:loadTasks(),fitpro_work_stages_v1:loadWorkStages(),fitpro_task_templates_v1:loadTaskTemplates(),fitpro_timesheets_v1:loadTimesheets(),fitpro_project_invoices_v1:loadProjectInvoices(),fitpro_project_types_v1:loadProjectTypes(),fitpro_contract_types_v1:loadContractTypes(),fitpro_project_statuses_v1:loadProjectStatuses(),fitpro_project_priorities_v1:loadProjectPriorities(),fitpro_project_categories_v1:loadProjectCategories(),fitpro_milestones:loadMilestones(),fitpro_project_files:loadProjectFiles(),fitpro_project_notes:loadProjectNotes(),fitpro_project_discussions:loadProjectDiscussions(),fitpro_project_tickets:loadProjectTickets(),fitpro_project_purchases:loadProjectPurchases()}}
export function ProjectDataControls({canClear,version,onChanged}:{canClear:boolean;version:number;onChanged:()=>void}){
 const toast=useToast(),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
 const data=useMemo(()=>{try{const stores=snapshot(),defaults=fallbacks();return {stores,defaults,counts:planProjectDataClear(stores,defaults,[]).counts,error:''}}catch(e){return {stores:{},defaults:{},counts:{} as Record<string,number>,error:e instanceof Error?e.message:'Storage unavailable'}}},[version])
 async function run(){if(!canClear||busy||!selected.length||data.error)return;setBusy(true);try{
  const state=getMysqlState();if(!state.connected||state.syncing||state.error)throw new Error('Database is disconnected, busy or has unsynced changes. Resolve these before clearing.')
  const before=snapshot();if(JSON.stringify(before)!==JSON.stringify(data.stores))throw new Error('Project data changed. Refresh counts before trying again.')
  const plan=planProjectDataClear(before,data.defaults,selected)
  if(!await downloadText(`projects-before-clear-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify({createdAt:new Date().toISOString(),description:'Private project data before selected menu clear',selected,stores:before,visibleSeedData:data.defaults},null,2),'application/json'))throw new Error('Backup download failed; no data was cleared.')
  if(JSON.stringify(snapshot())!==JSON.stringify(before))throw new Error('Project data changed during backup; no data was cleared.')
  for(const [key,value] of Object.entries(plan.changes))localStorage.setItem(key,value)
  const saved=await flushDataMaintenanceChanges();onChanged();setSelected([]);setConfirm(false)
  if(saved){toast.success('Selected project data cleared','Reloading to refresh the application state.');window.setTimeout(()=>window.location.reload(),600)}else toast.error('Database save not confirmed','Changes remain in this browser’s sync queue. Do not refresh; resolve the sync error before continuing.')
 }catch(e){onChanged();toast.error('Clear operation could not be completed',e instanceof Error?e.message:'Review backup and sync state.')}finally{setBusy(false)}}
 return <div className="space-y-2 px-2 py-2"><p className="text-xs text-mist">Select menus independently. Counts include saved records and visible sample defaults across companies in this browser. Shared stores are changed only for the selected menus.</p><p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-700 dark:text-amber-300">A private backup is required. Clearing does not reverse linked accounting journals or repair related project records. Other clients can overwrite changes; this operation is not atomic.</p>{data.error&&<p role="alert" className="text-xs text-rose-500">{data.error}</p>}{PROJECT_DATA_MENUS.map(m=><div key={m.id} className="rounded-lg border border-line px-3 py-2"><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#c8f542]" checked={selected.includes(m.id)} disabled={m.id==='reports'||!canClear||busy||!!data.error||!data.counts[m.id]} onChange={e=>{const checked=e.target.checked;setSelected(v=>checked?[...v,m.id]:v.filter(x=>x!==m.id))}}/><span className="flex-1 font-semibold">{m.label}</span><Badge tone={data.counts[m.id]?'lime':'zinc'}>{m.id==='reports'?'Calculated':`${data.counts[m.id]??0} records`}</Badge></label><p className="ml-7 mt-1 text-xs text-mist">{m.desc}</p></div>)}<div className="flex flex-wrap items-center justify-between gap-2 pt-2"><span className="text-xs text-mist">{selected.length} Project Management menus selected</span><Button variant="danger" size="sm" disabled={!canClear||!selected.length||busy} onClick={()=>setConfirm(true)}><Trash2 className="size-4"/> Clear selected project menus</Button></div><Modal open={confirm} onClose={()=>!busy&&setConfirm(false)} title="Clear selected project menus?" wide><div className="space-y-3"><p className="flex items-start gap-2 text-sm text-amber-600"><AlertTriangle className="size-4 shrink-0"/>Linked project records, sales invoices, payments and accounting entries are not repaired or reversed. This cannot be undone here.</p>{PROJECT_DATA_MENUS.filter(m=>selected.includes(m.id)).map(m=><div key={m.id} className="rounded border border-line p-2 text-sm"><strong>{m.label}</strong> · {data.counts[m.id]||0} records<p className="text-xs text-mist">{m.desc}</p></div>)}<p className="text-xs text-mist">A private backup will be downloaded. Browser writes and database sync are not atomic; on success the page reloads.</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={()=>void run()}>{busy?'Saving…':'Download backup and clear'}</Button></div></div></Modal></div>
}
