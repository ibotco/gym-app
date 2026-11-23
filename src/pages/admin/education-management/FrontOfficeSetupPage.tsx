import { frontOfficeUsage, usageDescription } from '../../../lib/frontOfficeUsage'
import { addFrontOfficeSamples } from '../../../lib/frontOfficeSamples'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, PageHeader } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { visibleBranches } from '../../../lib/accessScope'
import { loadEduRecords, saveEduRecords, EDU_RECORDS_KEY, type EduRow, type EduRecords } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { uid } from '../../../lib/utils'

const categories = ['Reference', 'Source', 'Response', 'Calling Purpose', 'Visiting Purpose', 'Complaint Type'] as const
type Category = typeof categories[number]

export function FrontOfficeSetupPage() {
  const { activeBranchId, activeCompanyId, branches } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const allowed = useMemo(() => visibleBranches(user, branches, activeCompanyId), [user, branches, activeCompanyId])
  const [category, setCategory] = useState<Category>('Reference')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState('')
  const [toDelete, setToDelete] = useState<EduRow | null>(null)
  const [rows, setRows] = useState<EduRow[]>([])
  const [snapshot, setSnapshot] = useState<EduRecords>({})
  const branch = allowed.find(b => b.id === activeBranchId)
  const refresh = () => { if (branch) { const current=loadEduRecords(branch.id, branch.name); const seeded=addFrontOfficeSamples(current); if (seeded.records!==current) saveEduRecords(branch.id,seeded.records); setRows(seeded.records.frontOfficeSetup ?? []); setSnapshot(seeded.records) } else { setRows([]); setSnapshot({}) } }
  useEffect(() => { setEditing(''); setName(''); setToDelete(null); setRows([]); setSnapshot({}) }, [activeBranchId])
  useEffect(() => { refresh(); const unsub=subscribeDbHydrated(refresh); const onFocus=()=>refresh(); window.addEventListener('focus',onFocus); return () => {unsub();window.removeEventListener('focus',onFocus)} }, [activeBranchId, branch?.name])
  const filtered = rows.filter(r => r.category === category)
  const reset = () => { setEditing(''); setName('') }
  const persist = (items: EduRow[], latest: ReturnType<typeof loadEduRecords>) => {
    if (!branch) throw new Error('Select an available branch in the header.')
    saveEduRecords(branch.id, {...latest,frontOfficeSetup:items})
    const raw=localStorage.getItem(EDU_RECORDS_KEY)
    const stored=raw ? JSON.parse(raw) : null
    if (!stored?.[branch.id] || JSON.stringify(stored[branch.id].frontOfficeSetup)!==JSON.stringify(items)) throw new Error('The browser could not save the changes.')
    setRows(items); setSnapshot({...latest,frontOfficeSetup:items})
  }
  const save = (e:FormEvent) => { e.preventDefault(); if (!branch) {toast.error('Select a branch in the header');return} const clean=name.trim(); if(!clean){toast.error('Enter a name');return}
    try {const latest=loadEduRecords(branch.id,branch.name), all=latest.frontOfficeSetup??[], old=all.find(r=>r.id===editing)
      if(editing&&!old)throw new Error('This entry no longer exists. Refresh and try again.')
      if(old && String(old.name ?? "").trim().toLocaleLowerCase() !== clean.toLocaleLowerCase()){ const usage=frontOfficeUsage(latest,old); if(usage.length)throw new Error(`This item is in use: ${usageDescription(usage)}. Remove or change those references first.`) }
      if(all.some(r=>r.id!==editing&&r.category===category&&String(r.name??'').trim().toLocaleLowerCase()===clean.toLocaleLowerCase()))throw new Error('An entry with that name already exists in this category and branch.')
      const row:EduRow={...(old??{}),id:editing||uid(),category,name:clean}
      persist(editing?all.map(r=>r.id===editing?row:r):[...all,row],latest); toast.success(editing?'Entry updated':'Entry added'); reset()
    }catch(err){toast.error('Unable to save',err instanceof Error?err.message:'Please try again.')}
  }
  const remove=()=>{if(!branch||!toDelete)return;try{const latest=loadEduRecords(branch.id,branch.name), all=latest.frontOfficeSetup??[];const current=all.find(r=>r.id===toDelete.id);if(!current)throw new Error('This entry no longer exists.');const usage=frontOfficeUsage(latest,current);if(usage.length)throw new Error(`This item is in use: ${usageDescription(usage)}. Remove or change those references first.`);persist(all.filter(r=>r.id!==toDelete.id),latest);if(editing===toDelete.id)reset();setToDelete(null);toast.success('Entry deleted','Existing records retain their saved values.')}catch(err){toast.error('Unable to delete',err instanceof Error?err.message:'Please try again.')}}
  const usageFor = (row:EduRow) => { try { return usageDescription(frontOfficeUsage(snapshot,row)) } catch { return 'Usage cannot be verified' } }
  return <div className="space-y-4"><PageHeader title="Setup Front Office" desc="Manage options for each branch." />
    <div role="tablist" aria-label="Front office setup categories" className="flex gap-1 overflow-x-auto border-b border-line">{categories.map(c=><button role="tab" aria-selected={category===c} key={c} type="button" onClick={()=>{setCategory(c);reset();setToDelete(null)}} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${category===c?'border-blue-600 text-blue-600':'border-transparent text-mist hover:text-inherit'}`}>{c}</button>)}</div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <form onSubmit={save} className="min-w-0 rounded-xl border border-line bg-surface p-4 space-y-4"><h2 className="border-b border-line pb-3 text-lg font-semibold">{editing?'Edit':'Add'} {category}</h2>
        <Field label="Name" required><Input aria-label="Name" value={name} onChange={e=>setName(e.target.value)} maxLength={191}/></Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">{editing&&<Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}<Button type="submit" disabled={!branch}><Plus className="size-4"/>{editing?'Update':'Save'}</Button></div>
      </form>
      <section className="min-w-0 rounded-xl border border-line bg-surface p-4"><h2 className="border-b border-line pb-3 text-lg font-semibold">{category} List</h2><p className="my-3 text-xs text-mist">Showing entries for the branch selected in the header.</p><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead className="bg-black/[0.03] dark:bg-white/[0.04]"><tr>{['SL','Branch','Name','Action'].map(h=><th key={h} className="border border-line px-3 py-2">{h}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id}><td className="border border-line px-3 py-2">{i+1}</td><td className="border border-line px-3 py-2">{branch?.name}</td><td className="border border-line px-3 py-2 break-words">{r.name}{usageFor(r) && <span className="mt-1 block text-xs text-mist">In use: {usageFor(r)}</span>}</td><td className="border border-line px-3 py-2"><div className="flex gap-1"><button type="button" aria-label={`Edit ${r.name}`} className="rounded p-2 hover:bg-muted" onClick={()=>{setEditing(r.id);setName(r.name??'')}}><Pencil className="size-4"/></button><button type="button" aria-label={`Delete ${r.name}`} title={usageFor(r) ? `In use: ${usageFor(r)}` : 'Delete'} disabled={!!usageFor(r)} className="rounded p-2 text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40" onClick={()=>setToDelete(r)}><Trash2 className="size-4"/></button></div></td></tr>)}</tbody></table>{!filtered.length&&<p className="p-4 text-sm text-mist">No {category.toLowerCase()} entries for this branch.</p>}</div></section>
    </div><Modal open={!!toDelete} onClose={()=>setToDelete(null)} title={`Delete ${category}?`}><p className="text-sm">Delete {toDelete?.name}? Existing records retain their saved values.</p><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setToDelete(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></div></Modal>
  </div>
}
