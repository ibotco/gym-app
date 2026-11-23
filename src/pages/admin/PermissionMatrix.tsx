import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { PageHeader, SearchField, Select } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { permissionModuleCatalog } from '../../lib/permissionModuleCatalog'
import { loadMatrix } from '../../lib/permissionMatrix'
import { useAuth } from '../../context/AuthContext'

export function PermissionMatrix(){
 const app=useApp(),{user}=useAuth();const [q,setQ]=useState(''),[roleId,setRoleId]=useState('')
 const scope=user?.role==='super_admin'?'global':user?.companyId||app.activeCompanyId||'global'
 const old=loadMatrix(scope)[roleId]||{}
 const modules=useMemo(()=>permissionModuleCatalog(),[])
 const visible=modules.map(m=>({...m,rows:m.rows.filter(r=>!q||`${m.label} ${r.label}`.toLowerCase().includes(q.toLowerCase().trim()))})).filter(m=>m.rows.length)
 return <div><PageHeader title="Permission Matrix" desc="Module catalog and planned granular actions."/>
 <div role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><strong>Preview only — not access control.</strong> The legacy matrix was not connected to authorization. View, create, edit and delete controls are unavailable until each module is secured and tested. Previously saved matrix selections are retained but do not restrict access. Student portal permissions are enforced separately through the Student role editor.</div>
 <div className="mb-4 flex flex-wrap gap-2"><Select value={roleId} onChange={e=>setRoleId(e.target.value)} className="w-64"><option value="">Select a role to inspect legacy selections…</option>{app.roles.filter(r=>r.portal==='admin').map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select><SearchField value={q} onChange={setQ} placeholder="Search modules or menus…" className="w-full max-w-xs"/></div>
 <div className="card table-wrap"><table className="data"><thead><tr><th>Module / menu</th><th className="text-center">View</th><th className="text-center">Create</th><th className="text-center">Edit</th><th className="text-center">Delete</th><th>Status</th></tr></thead><tbody>{visible.map(m=><ModuleRows key={m.key} module={m} old={old}/>)}{!visible.length&&<tr><td colSpan={6} className="text-center text-mist">No modules match your search.</td></tr>}</tbody></table></div></div>
}
function ModuleRows({module,old}:{module:ReturnType<typeof permissionModuleCatalog>[number];old:Record<string,{view:boolean;create:boolean;edit:boolean;delete:boolean}>}){
 const [open,setOpen]=useState(true)
 return <><tr className="bg-black/5 dark:bg-white/5"><td colSpan={6}><button className="flex items-center gap-2 font-bold" onClick={()=>setOpen(!open)} aria-expanded={open}><ChevronRight className={`size-4 transition-transform ${open?'rotate-90':''}`}/>{module.label}</button></td></tr>{open&&module.rows.map(row=><tr key={row.key}><td className="pl-8">{row.label}</td>{(['view','create','edit','delete'] as const).map(action=><td className="text-center" key={action}><input type="checkbox" checked={!!old[row.key]?.[action]} disabled aria-label={`${row.label} ${action}: legacy selection, not enforced`} title="Unavailable; any checked value is an unenforced legacy selection"/></td>)}<td className="text-xs text-mist">Not enforced</td></tr>)}</>
}
