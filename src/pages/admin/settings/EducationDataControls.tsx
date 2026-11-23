import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Badge, Button, Modal } from '../../../components/ui'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { flushEducationBeforeNotification, getMysqlState } from '../../../lib/mysqlBridge'
import { downloadText } from '../../../lib/utils'
import { educationClearMenus, planEducationMenuClear } from '../../../lib/educationMenuClear'
import { readableEduTableName } from '../../../lib/educationDataBreakdown'
import menu from '../../../data/eduMenu.json'

export function EducationDataControls({canClear,version,onChanged}:{canClear:boolean;version:number;onChanged:()=>void}) {
 const {t}=useI18n(),toast=useToast(),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
 const menus=useMemo(()=>educationClearMenus(menu.groups),[])
 const data=useMemo(()=>{try{const raw=localStorage.getItem('fitpro_edu_records_v1');if(!raw)return {raw:null,error:'No education data store is available.'};return {raw,error:''}}catch{return {raw:null,error:'Education storage is unavailable.'}}},[version])
 const inspect=(id:string)=>{if(!data.raw)return null;try{return planEducationMenuClear(data.raw,menus,[id])}catch{return null}}
 const items=menus.map(m=>({...m,plan:inspect(m.id)}))
 const selectedMenus=items.filter(m=>selected.includes(m.id))
 const run=async()=>{if(!canClear||busy||!data.raw||!selected.length)return;setBusy(true)
  try {
   const state=getMysqlState();if(!state.connected||state.syncing||state.error)throw new Error('Database is disconnected, busy or has unsynced changes. Resolve these before clearing.')
   const original=localStorage.getItem('fitpro_edu_records_v1');if(original!==data.raw)throw new Error('Education data changed. Close the dialog and review the latest counts.')
   const plan=planEducationMenuClear(original!,menus,selected)
   const backup=JSON.stringify({createdAt:new Date().toISOString(),description:'Education store before selected menu clear; contains private data',educationStore:JSON.parse(original!)},null,2)
   if(!await downloadText(`education-before-clear-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,backup,'application/json'))throw new Error('Backup download failed. No data was cleared.')
   if(localStorage.getItem('fitpro_edu_records_v1')!==original)throw new Error('Education data changed during backup. No data was cleared; review and try again.')
   localStorage.setItem('fitpro_edu_records_v1',plan.next)
   const saved=await flushEducationBeforeNotification()
   onChanged();setSelected([]);setConfirm(false)
   if(saved)toast.success('Selected Education tables cleared',`${plan.count} stored records cleared. Related records in other modules were not changed.`)
   else toast.error('Database save not confirmed','The change remains in this browser’s sync queue. Do not refresh; resolve the sync error and review the database.')
  } catch(error){toast.error('Education data was not cleared',error instanceof Error?error.message:'Unable to prepare the clear operation.')}
  finally{setBusy(false)}
 }
 return <div className="space-y-2 px-2 py-2"><p className="text-xs text-mist">Select menus independently. Each checkbox covers only its listed education tables across all branches. Reports and overview may have no stored tables. Counts exclude related data in other modules.</p>
  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-700 dark:text-amber-300">Clearing student or fee records does not repair linked invoices, scholarship credits, accounting receipts, or history. Review affected records first. A backup download is required.</div>
  <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm opacity-60"><input type="checkbox" disabled aria-label="Overview: no independent data"/><span className="flex-1 font-semibold">Overview</span><span className="text-xs text-mist">Calculated dashboard</span></div>
  {items.map(item=><div key={item.id} className="rounded-lg border border-line px-3 py-2"><label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#c8f542]" checked={selected.includes(item.id)} disabled={!canClear||busy||!item.plan||item.plan.count===0} onChange={e=>{const checked=e.target.checked;setSelected(v=>checked?[...v,item.id]:v.filter(id=>id!==item.id))}}/><span className="flex-1 font-semibold">{t(item.key)}</span><Badge tone={item.plan?.count?'lime':'zinc'}>{item.plan?`${item.plan.count} records`:'Unavailable'}</Badge></label><details className="ml-7 mt-1 text-xs text-mist"><summary className="cursor-pointer">Tables included</summary><p className="mt-1 break-words">{item.tables.map(readableEduTableName).join(', ')}</p></details></div>)}
  <div className="flex flex-wrap items-center justify-between gap-2 pt-2"><span className="text-xs text-mist">{selected.length} Education menus selected</span><Button variant="danger" size="sm" disabled={!canClear||!selected.length||busy} onClick={()=>setConfirm(true)}><Trash2 className="size-4"/> Clear selected Education menus</Button></div>
  <Modal open={confirm} onClose={()=>!busy&&setConfirm(false)} title="Clear selected Education menus?" wide><div className="space-y-3"><p className="flex items-start gap-2 text-sm text-amber-600"><AlertTriangle className="size-4 shrink-0"/>This empties the listed tables in every branch. Linked data outside those tables remains unchanged, which can cause inconsistencies. This cannot be undone here.</p>{selectedMenus.map(m=><div key={m.id} className="rounded border border-line p-2 text-sm"><strong>{t(m.key)}</strong> · {m.plan?.count??0} records<div className="mt-1 text-xs text-mist">{m.tables.map(readableEduTableName).join(', ')}</div></div>)}<p className="text-xs text-mist">A private backup of the complete Education store will be downloaded before clearing. The browser-coordinated save is not atomic with other modules; concurrent or older clients may overwrite changes.</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={()=>void run()}>{busy?'Saving…':'Download backup and clear'}</Button></div></div></Modal>
 </div>
}
