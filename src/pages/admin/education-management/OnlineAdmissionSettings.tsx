import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Columns3, Copy, FileDown, FileSpreadsheet, FileText, Filter, Printer, Trash2, XCircle } from 'lucide-react'
import { Button, Field, PageHeader, SearchInput, Select, Switch } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { CMS_KEY, type CmsData } from '../../../lib/cms'
import { educationSite } from '../../../lib/educationCms'
import { loadEduRecords } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'

type AdmissionRow = { id:string; reference:string; name:string; gender:string; className:string; phone:string; status:string; paymentStatus:string; applyDate:string }
const applicationColumns: Column<AdmissionRow>[] = [
 {key:'sl',header:'SL',align:'center',render:(_row,index)=>String(index+1)},
 ...([['reference','Reference No'],['name','Name'],['gender','Gender'],['className','Class'],['phone','Mobile No']] as const).map(([key,header])=>({key,header,sortValue:(row:AdmissionRow)=>row[key],render:(row:AdmissionRow)=>row[key]||'—'})),
 {key:'status',header:'Status',sortValue:row=>row.status,render:row=>row.status ? <span className="inline-block rounded border border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-600">{row.status}</span> : '—'},
 {key:'paymentStatus',header:'Payment Status',sortValue:row=>row.paymentStatus,render:row=>row.paymentStatus ? <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${row.paymentStatus.toLowerCase()==='paid'?'border-emerald-500 text-emerald-600':'border-rose-500 text-rose-600'}`}>{row.paymentStatus}</span> : '—'},
 {key:'applyDate',header:'Apply Date',sortValue:row=>row.applyDate,render:row=>row.applyDate||'—'},
 {key:'action',header:'Action',render:row=><div className="flex gap-1">{([[Printer,'Print'],[FileDown,'Download'],[CheckCircle2,'Approve'],[XCircle,'Reject'],[Trash2,'Delete']] as const).map(([Icon,label])=><button type="button" key={label} disabled aria-label={`${label} application ${row.reference} unavailable`} title="Available when secure staff review is connected" className="grid size-8 place-items-center rounded border border-line opacity-40"><Icon className="size-4"/></button>)}</div>},
]

export function OnlineAdmissionSettings(){
 const {cms,setCms,activeBranchId,branches}=useApp();const branch=branches.find(b=>b.id===activeBranchId)
 const site=educationSite(cms.educationSite);const [open,setOpen]=useState(site.settings.applicationsOpen===true),[baseline,setBaseline]=useState(site.settings.applicationsOpen===true),[message,setMessage]=useState('')
 const [className,setClassName]=useState(''),[appliedClass,setAppliedClass]=useState(''),[search,setSearch]=useState(''),[classOptions,setClassOptions]=useState<string[]>([])
 useEffect(()=>{
  const refresh=()=>{if (!activeBranchId) { setClassOptions([]); return };const records=loadEduRecords(activeBranchId,branch?.name);setClassOptions([...new Set((records.classList??[]).map(r=>String(r.name??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})))}
  setClassName('');setAppliedClass('');setSearch('');refresh();return subscribeDbHydrated(refresh)
 },[activeBranchId,branch?.name])
 // The secure submission and staff review endpoints are not connected. Do not
 // fabricate records or read private applications from browser storage.
 const rows=useMemo<AdmissionRow[]>(()=>[],[activeBranchId,appliedClass,search])
 function save(){try{const raw=localStorage.getItem(CMS_KEY);const latest:CmsData=raw?JSON.parse(raw):cms;if(!latest||typeof latest!=='object'||Array.isArray(latest))throw Error('Invalid website data.');const latestSite=educationSite(latest.educationSite);if((latestSite.settings.applicationsOpen===true)!==baseline)throw Error('This setting changed elsewhere. Refresh before saving.');const next={...latest,educationSite:{...latestSite,settings:{...latestSite.settings,applicationsOpen:open}}};const expected=JSON.stringify(next);localStorage.setItem(CMS_KEY,expected);if(localStorage.getItem(CMS_KEY)!==expected)throw Error('Browser storage did not confirm the save.');setCms(next);setBaseline(open);setMessage('Setting saved in this browser and queued for database sync.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to save the setting.')}}
 return <div className="space-y-5">
  <PageHeader title="Online Admission" desc="Filter applications for the selected branch and manage availability."/>
  <section className="card overflow-hidden"><h2 className="border-b border-line px-5 py-4 font-semibold">Select Criteria</h2><div className="grid gap-4 p-5 sm:grid-cols-2">
   <Field label="Branch"><div className="flex min-h-10 items-center rounded-md border border-line bg-muted px-3 text-sm">{branch?.name||'No branch selected'}</div><p className="mt-1 text-xs text-mist">Change branch in the header.</p></Field>
   <Field label="Class"><Select aria-label="Admission class" value={className} onChange={e=>setClassName(e.target.value)}><option value="">All classes</option>{classOptions.map(c=><option key={c} value={c}>{c}</option>)}</Select></Field>
  </div><div className="flex justify-end border-t border-line px-5 py-3"><Button type="button" variant="outline" onClick={()=>setAppliedClass(className)}><Filter className="size-4"/> Filter</Button></div></section>
  <section className="card overflow-hidden"><h2 className="border-b border-line px-5 py-4 font-semibold">Online Admission List</h2>
   <p role="status" className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Application listing and review are not connected yet. No submitted applications can be displayed here; application actions are unavailable.</p>
   <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex flex-wrap gap-1">{([[Copy,'Copy'],[FileSpreadsheet,'Excel'],[FileText,'CSV'],[FileDown,'PDF'],[Printer,'Print'],[Columns3,'Columns']] as const).map(([Icon,label])=><button key={label} type="button" disabled aria-label={`${label} unavailable`} title="Available when application listing is connected" className="grid size-9 place-items-center rounded border border-line opacity-40"><Icon className="size-4"/></button>)}</div><SearchInput value={search} onChange={setSearch} placeholder="Search applications…" /></div>
   <DataTable columns={applicationColumns} data={rows} rowKey={r=>r.id} pageSize={25} emptyTitle="Application list unavailable" emptyDesc="Secure application submission and staff review are not yet connected."/>
  </section>
  <section className="card space-y-4 p-5"><h2 className="font-semibold">Admission Settings</h2><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Applications Open</p><p className="mt-1 text-sm text-mist">This is a website-wide setting, not a branch-specific setting.</p></div><Switch aria-label="Applications Open" checked={open} onChange={v=>{setOpen(v);setMessage('')}}/></div><p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">This saves the intended availability only. Secure online submission, form status and submitted-form downloads are not yet available, even when enabled. The website form remains disabled.</p><Button type="button" onClick={save}>Save</Button>{message&&<p role="status" className="text-sm">{message}</p>}</section>
 </div>
}
