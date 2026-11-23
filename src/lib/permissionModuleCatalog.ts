import { MODULES } from './modules'
import { PERMISSION_MATRIX, type MatrixModule } from './permissionMatrix'
import eduMenu from '../data/eduMenu.json'

type EduLeaf={id:string;hidden?:boolean}
type EduGroup={id:string;leaves:EduLeaf[];subgroups?:{leaves:EduLeaf[]}[]}
const words=(id:string)=>id.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,s=>s.toUpperCase())
const aliases:Record<string,string[]>={organizations:['organization'],userManagement:['users'],people:['people'],accounting:['accounting'],approvals:['approvals'],inventory:['inventory'],assets:['assets'],sales:['sales'],purchases:['purchases'],hrm:['hrm'],communications:['communication'],programs:['subscriptions'],settings:['system']}
/** Catalog is informational: none of its matrix rows are authorization checks. */
export function permissionModuleCatalog():MatrixModule[]{
 const groups=eduMenu.groups as EduGroup[]
 return MODULES.map(module=>{
  const legacy=(aliases[module.id]||[]).flatMap(key=>PERMISSION_MATRIX.find(m=>m.key===key)?.rows||[])
  if(module.id==='educationManagement'){
   const rows=groups.flatMap(g=>[...g.leaves,...(g.subgroups||[]).flatMap(s=>s.leaves)].filter(l=>!l.hidden).map(l=>({key:`preview.education.${g.id}.${l.id}`,label:`${words(g.id)} — ${words(l.id)}`})))
   return {key:module.id,label:module.label,rows}
  }
  return {key:module.id,label:module.label,rows:legacy.length?legacy:[{key:`preview.${module.id}`,label:module.label}]}
 })
}
