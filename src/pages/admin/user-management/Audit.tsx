import { useMemo, useState } from 'react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { apiUrl, flushDataMaintenanceChanges, getAppBasePath } from '../../../lib/mysqlBridge'
import { trustedLogin, trustedLogout, trustedRestore } from '../../../lib/trustedSession'
import { useToast } from '../../../context/ToastContext'
import { exportCsv, exportExcel } from '../../../lib/export'
import { auditOlderThan, filterAuditRows, safeAuditCell, type AuditCriteria } from '../../../lib/auditManagement'
import { formatDateTime } from '../../../lib/utils'
import type { AuditLog } from '../../../types'

const blank=():AuditCriteria=>({query:'',actor:'',action:'',entity:'',from:'',to:''})
const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}))
export function Audit() {
 const { audit, users } = useApp();const {user}=useAuth();const toast=useToast();const [criteria,setCriteria]=useState<AuditCriteria>(blank),[cutoff,setCutoff]=useState('')
 const [clearOpen,setClearOpen]=useState(false),[busy,setBusy]=useState(false),[clearError,setClearError]=useState(''),[serverPassword,setServerPassword]=useState(''),[confirmation,setConfirmation]=useState('')
 const [review,setReview]=useState<{count:number;revision:string;csrf:string}|null>(null)
 async function prepare(signIn=false){if(!user||user.role!=='super_admin'||busy)return;setBusy(true);setClearError('');setReview(null);try{
  const session=signIn ? await trustedLogin(getAppBasePath(),user.email,serverPassword) : await trustedRestore(getAppBasePath());setServerPassword('')
  if(session.user.id!==user.id||session.user.role!=='super_admin'){await trustedLogout(getAppBasePath()).catch(()=>{});throw new Error('A matching trusted super administrator account is required.')}
  const response=await fetch(apiUrl('/api/audit/management'),{credentials:'same-origin',cache:'no-store'});const body=await response.json();if(!response.ok||!body?.ok||typeof body.count!=='number'||typeof body.revision!=='string')throw new Error(body?.error||'Unable to review server audit records.')
  setReview({count:body.count,revision:body.revision,csrf:session.csrf})
 }catch(e){setServerPassword('');setClearError(e instanceof Error?e.message:'Unable to verify the trusted session.')}finally{setBusy(false)}}
 async function clearAll(){if(!review||confirmation!=='CLEAR'||busy)return;setBusy(true);setClearError('');try{
  if(!await flushDataMaintenanceChanges())throw new Error('Database is disconnected or has unsynced changes. Reload or resolve the sync error before clearing.')
  const response=await fetch(apiUrl('/api/audit/management'),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:review.csrf,revision:review.revision,confirmation})});const body=await response.json();if(!response.ok||!body?.ok)throw new Error(body?.error||'Unable to clear audit records.');setReview(null);setClearOpen(false);toast.success(`${body.cleared} audit records cleared`, 'A private server backup was saved. Reloading the app.');window.setTimeout(()=>window.location.reload(),800)
 }catch(e){setReview(null);setConfirmation('');setClearError(e instanceof Error?e.message:'Unable to clear audit records. Review the count again.')}finally{setBusy(false)}}

 const rows=useMemo(()=>filterAuditRows(audit,users,criteria),[audit,users,criteria])
 const actors=unique(audit.map(row=>row.userId));const actions=unique(audit.map(row=>row.action));const entities=unique(audit.map(row=>row.entity))
 const actorName=(id:string)=>users.find(user=>user.id===id)?.name||id
 const columns:Column<AuditLog>[]=[
  {key:'sl',header:'SL',align:'center',render:(_row,index)=>String(index+1)},
  {key:'createdAt',header:'When',sortValue:r=>r.createdAt,render:r=><span className="whitespace-nowrap text-mist">{r.createdAt?formatDateTime(r.createdAt):'—'}</span>},
  {key:'actor',header:'Actor',sortValue:r=>actorName(r.userId),render:r=>actorName(r.userId)},
  {key:'action',header:'Action',sortValue:r=>r.action,render:r=><Badge tone="lime">{r.action}</Badge>},
  {key:'entity',header:'Entity',sortValue:r=>r.entity,render:r=>r.entity},
  {key:'details',header:'Details',sortValue:r=>r.details,render:r=><span className="text-mist">{r.details}</span>},
 ]
 const download=async(kind:'csv'|'excel')=>{if(!rows.length){toast.error('No matching audit entries to export.');return}const out=rows.map(row=>({When:safeAuditCell(row.createdAt),Actor:safeAuditCell(actorName(row.userId)),'Actor ID':safeAuditCell(row.userId),Action:safeAuditCell(row.action),Entity:safeAuditCell(row.entity),Details:safeAuditCell(row.details)}));const ok=kind==='csv'?await exportCsv('audit-logs',out):await exportExcel('audit-logs',out);if(!ok)toast.error('Export failed.');}
 const cutoffCount=auditOlderThan(audit,cutoff)
 return <div className="space-y-4">
  <PageHeader title="Audit logs" desc="Review and export recorded activity."/>
  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">These are application activity records, not an immutable or independently verified audit trail. Company isolation and secure retention are not yet complete.</p>
  <section className="card space-y-4 p-4"><h2 className="font-semibold">Search and filters</h2><SearchInput value={criteria.query} onChange={query=>setCriteria(c=>({...c,query}))} placeholder="Search actor, action, entity or details…"/>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <Field label="Actor"><Select aria-label="Filter audit logs by actor" value={criteria.actor} onChange={e=>setCriteria(c=>({...c,actor:e.target.value}))}><option value="">All actors</option>{actors.map(id=><option key={id} value={id}>{actorName(id)} ({id})</option>)}</Select></Field>
    <Field label="Action"><Select aria-label="Filter audit logs by action" value={criteria.action} onChange={e=>setCriteria(c=>({...c,action:e.target.value}))}><option value="">All actions</option>{actions.map(v=><option key={v} value={v}>{v}</option>)}</Select></Field>
    <Field label="Entity"><Select aria-label="Filter audit logs by entity" value={criteria.entity} onChange={e=>setCriteria(c=>({...c,entity:e.target.value}))}><option value="">All entities</option>{entities.map(v=><option key={v} value={v}>{v}</option>)}</Select></Field>
    <Field label="From"><Input type="date" aria-label="Audit from date" value={criteria.from} onChange={e=>setCriteria(c=>({...c,from:e.target.value}))}/></Field>
    <Field label="To"><Input type="date" aria-label="Audit to date" value={criteria.to} onChange={e=>setCriteria(c=>({...c,to:e.target.value}))}/></Field>
   </div>{criteria.from&&criteria.to&&criteria.from>criteria.to&&<p role="alert" className="text-sm text-rose-600">The start date is after the end date.</p>}
   <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" onClick={()=>setCriteria(blank())}>Reset filters</Button><div className="flex gap-2"><Button variant="outline" disabled={!rows.length} onClick={()=>void download('csv')}>Export CSV</Button><Button variant="outline" disabled={!rows.length} onClick={()=>void download('excel')}>Export Excel</Button></div></div>
  </section>
  <section className="card overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="font-semibold">Activity records</h2><p className="text-xs text-mist">{rows.length} matching {rows.length===1?'entry':'entries'} in the current view</p></div><DataTable columns={columns} data={rows} rowKey={r=>r.id} pageSize={25} emptyTitle="No matching activity" emptyDesc="Adjust the filters or search."/></section>
  {user?.role==='super_admin' && <section className="card space-y-3 p-4"><h2 className="font-semibold">Clear audit logs</h2><p className="text-sm text-mist">Clear all main Audit Logs across the workspace. Other audit stores are not included. A private server backup is required and created before clearing.</p><Button variant="danger" onClick={()=>{setClearOpen(true);setConfirmation('');void prepare()}}>Review and clear all</Button></section>}
  <Modal open={clearOpen} onClose={()=>{if(!busy){setClearOpen(false);setReview(null);setServerPassword('');setConfirmation('');setClearError('')}}} title="Clear all audit logs?" wide><div className="space-y-4"><p className="text-sm text-amber-700 dark:text-amber-300">This permanently removes all entries in the main Audit Logs store across the workspace, not just filtered rows. Other audit stores are unchanged. A private server backup is saved first. Stale or legacy clients may still overwrite this store.</p>{busy&&<p role="status">Checking or clearing records…</p>}{clearError&&<p role="alert" className="text-sm text-rose-600">{clearError}</p>}{!review&&!busy&&<div className="space-y-3"><p className="text-sm text-mist">Sign in using the separate trusted Super Admin server password, or retry an existing trusted session.</p><Field label="Trusted server password"><Input type="password" autoComplete="current-password" value={serverPassword} onChange={e=>setServerPassword(e.target.value)}/></Field><div className="flex gap-2"><Button variant="outline" onClick={()=>void prepare()}>Retry session</Button><Button disabled={!serverPassword} onClick={()=>void prepare(true)}>Sign in and review</Button></div></div>}{review&&<div className="space-y-3"><p className="font-semibold">Server records to clear: {review.count}</p><Field label="Type CLEAR to confirm"><Input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></Field><div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={()=>setClearOpen(false)}>Cancel</Button><Button variant="danger" disabled={busy||confirmation!=='CLEAR'||review.count===0} onClick={()=>void clearAll()}>Back up and clear all</Button></div></div>}</div></Modal>
  <section className="card space-y-3 p-4"><h2 className="font-semibold">Retention review</h2><p className="text-sm text-mist">Preview all currently accessible records older than a chosen date, regardless of search filters. This does not set an automatic retention policy.</p><div className="max-w-xs"><Field label="Records before"><Input type="date" value={cutoff} onChange={e=>setCutoff(e.target.value)}/></Field></div>{cutoff&&<p className="text-sm">{cutoffCount} accessible {cutoffCount===1?'entry has':'entries have'} a valid date before {cutoff}.</p>}<Button variant="danger" disabled>Clear older logs unavailable</Button><p className="text-sm text-amber-700 dark:text-amber-300">Deletion is disabled until server-side authorization, retention controls and concurrency protection are complete. No audit records are changed here.</p></section>
 </div>
}
