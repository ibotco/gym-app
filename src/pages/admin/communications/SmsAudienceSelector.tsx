import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { SmsAudienceDraft } from '../../../lib/smsAudienceDraft'
import { Field, Input, Select } from '../../../components/ui'
import { canSendSelectedStudents } from '../../../lib/smsAudienceDraft'

type Option = {id:string;name:string}
function MultiPicker({label,options,selected,onChange,empty}:{label:string; options:Option[]; selected:string[]; onChange:(v:string[])=>void; empty?:string}) {
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const ref=useRef<HTMLDivElement>(null)
  const all=[...options,...selected.filter(id=>!options.some(o=>o.id===id)).map(id=>({id,name:`Unavailable: ${id}`}))]
  const shown=all.filter(option=>option.name.toLowerCase().includes(query.trim().toLowerCase()))
  useEffect(()=>{
    if (!open) return
    const close=(e:PointerEvent)=>{if (!ref.current?.contains(e.target as Node)) setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)}
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',escape)
    return ()=>{document.removeEventListener('pointerdown',close); document.removeEventListener('keydown',escape)}
  },[open])
  return <div ref={ref} className="relative">
    <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-line px-2 py-1.5 focus-within:border-violet-500">
      {selected.map(id=>{const name=all.find(o=>o.id===id)?.name || id; return <span key={id} className="inline-flex max-w-full items-center gap-1 rounded bg-black/5 px-1.5 py-1 text-xs dark:bg-white/10"><span className="truncate">{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={()=>onChange(selected.filter(x=>x!==id))}><X className="size-3" /></button></span>})}
      <input value={query} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} aria-label={`Search ${label}`} aria-expanded={open} placeholder={selected.length ? 'Search…' : 'Select or search…'} className="min-w-16 flex-1 bg-transparent px-1 py-1 text-xs outline-none" />
      <button type="button" aria-label={`${open ? 'Close' : 'Open'} ${label} options`} aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="p-1 text-mist"><ChevronDown className="size-4" /></button>
    </div>
    {open && <div className="relative z-10 mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lg" aria-label={`${label} options`}>
      {!shown.length && <p className="px-1 py-2 text-xs text-mist">{query ? 'No matching options.' : empty || 'No options available.'}</p>}
      {shown.map(option=><label className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5" key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={e=>onChange(e.target.checked ? [...selected,option.id] : selected.filter(x=>x!==option.id))} />{option.name}</label>)}
    </div>}
  </div>
}
export function SmsAudienceSelector({value,onChange,roles,groups,students,audienceOptions,branchId,showChurch,to,onToChange,priority,onPriorityChange,channel='sms'}:{value:SmsAudienceDraft;onChange:(v:SmsAudienceDraft)=>void;roles:Option[];groups:Option[];students:Option[];audienceOptions:Record<string,Option[]>;branchId:string;showChurch:boolean;to:string;onToChange:(v:string)=>void;priority:'low'|'normal'|'high'|'urgent';onPriorityChange:(v:'low'|'normal'|'high'|'urgent')=>void;channel?:'sms'|'email'}) {
  const churchTypes:Option[] = showChurch ? [
    {id:'church:level',name:'Everyone in my level'},
    {id:'church:locations',name:'Specific regions, areas, districts or assemblies'},
    {id:'church:ministries',name:'Ministries'},
    {id:'church:committees',name:'Committees'},
    {id:'church:officers',name:'Officers / Roles'},
    {id:'church:homeCells',name:'Home cells'},
    {id:'church:bibleStudy',name:'Bible study groups'},
    {id:'church:guilds',name:'Guilds'},
    {id:'groups',name:'Church groups'},
  ] : []
  const types:Option[]=[{id:'custom',name:channel==='email' ? 'Custom email address' : 'Custom number'},...roles.map(role=>({id:`audience:${role.id}`,name:role.name})),...churchTypes]
  const groupSelected=value.targetTypes.some(t=>t !== 'custom')
  return <div className="space-y-5">
    <Field label="Target types"><MultiPicker label="Target types" options={types} selected={value.targetTypes} onChange={targetTypes=>{ const student='audience:audience_student'; const addingStudent=!value.targetTypes.includes(student) && targetTypes.includes(student); const addingCustom=!value.targetTypes.includes('custom') && targetTypes.includes('custom'); if (addingStudent && value.targetTypes.length===1 && value.targetTypes[0]==='custom') targetTypes=targetTypes.filter(t=>t!=='custom'); if (addingCustom && value.targetTypes.length===1 && value.targetTypes[0]===student) targetTypes=targetTypes.filter(t=>t!==student); onChange({...value,targetTypes,studentBranchId:addingStudent ? branchId : value.studentBranchId}) }} /><p className="mt-1 text-xs text-mist">Search and select multiple audiences based on available modules and roles.</p></Field>
    {value.targetTypes.includes('custom') && <Field label={channel==='email' ? 'Email address' : 'Phone number'} required><Input type={channel==='email' ? 'email' : 'tel'} value={to} onChange={e=>onToChange(e.target.value)} placeholder={channel==='email' ? 'name@example.com' : '+233 24 000 0000'} required />{channel==='sms' && <p className="mt-1 text-xs text-mist">Include + and the country code.</p>}</Field>}
    {value.targetTypes.includes('audience:audience_student') && <Field label="Student"><MultiPicker label="Student" options={students} selected={value.students} onChange={students=>onChange({...value,students,studentBranchId:branchId})} empty="No saved students in the current branch." /><p className="mt-1 text-xs text-mist">{channel==='email' ? 'Leave empty to indicate all students in this branch, or select specific students. Student email targeting is draft-only and cannot be sent.' : 'Leave empty to target ALL students in the current branch, or select specific students. Every included student must have an active record and a valid international Student Phone. Review recipients before sending.'}</p></Field>}
    {value.targetTypes.filter(id=>id !== 'custom' && id !== 'audience:audience_student' && id !== 'groups').map(id=>{
      const name=types.find(t=>t.id===id)?.name || id
      const available=Object.prototype.hasOwnProperty.call(audienceOptions,id)
      return <Field label={name} key={id}><MultiPicker label={name} options={audienceOptions[id] || []} selected={value.selections[id] || []} onChange={selected=>onChange({...value,selections:{...value.selections,[id]:selected}})} empty={available ? 'No matching saved records in this branch.' : 'No linked records are available for this target type.'} /><p className="mt-1 text-xs text-mist">{available ? 'Leave empty to indicate all in this target type; selecting records narrows the audience. Sending for this type is not connected.' : 'A reliable source of linked records is not configured. Sending is unavailable.'}</p></Field>
    })}
    {value.targetTypes.includes('groups') && <Field label="Church groups"><MultiPicker label="Church groups" options={groups} selected={value.groups} onChange={groups=>onChange({...value,groups})} empty="No saved groups for this branch." /><p className="mt-1 text-xs text-mist">Leave empty to indicate all groups in the current branch. Group sending is not connected.</p></Field>}
    <Field label="Priority"><Select value={priority} onChange={e=>onPriorityChange(e.target.value as 'low'|'normal'|'high'|'urgent')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select><p className="mt-1 text-xs text-mist">Saved as a label only; it does not change sending order or provider delivery.</p></Field>
    {(groupSelected || value.excludeTypes.length > 0) && (channel==='email' || !canSendSelectedStudents(value)) && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">{channel==='email' ? 'Only one Custom email address can be sent. Other target types are draft-only and cannot be sent.' : 'Only Student targeting or one Custom number can be sent. Other target types are draft-only and cannot be sent.'}</p>}
    {!value.targetTypes.length && <p className="text-xs text-mist">Select at least one target type.</p>}
  </div>
}
