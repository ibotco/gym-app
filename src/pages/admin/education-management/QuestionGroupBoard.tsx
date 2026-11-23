import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, Select } from '../../../components/ui'
import { DataTable } from '../../../components/DataTable'
import type { EduRow } from '../../../lib/eduRecords'

type Props={rows:EduRow[];canManage:boolean;teacherSubjects:string[]|null;onSave:(name:string,subject:string,original:EduRow|null)=>string|null;onDelete:(row:EduRow)=>string|null}
export function QuestionGroupBoard({rows,canManage,teacherSubjects,onSave,onDelete}:Props){
 const [name,setName]=useState(''),[subject,setSubject]=useState(''),[editing,setEditing]=useState<EduRow|null>(null),[deleting,setDeleting]=useState<EduRow|null>(null),[error,setError]=useState('')
 const reset=()=>{setName('');setSubject('');setEditing(null);setError('')}
 const save=()=>{if(!name.trim()){setError('Group Name is required.');return}if(teacherSubjects&&!editing&&!subject){setError('Choose an assigned subject.');return}const err=onSave(name.trim(),subject,editing);if(err)setError(err);else reset()}
 return <div className="grid items-start gap-4 lg:grid-cols-5"><div className="card overflow-hidden lg:col-span-2"><h2 className="border-b border-line p-4 font-semibold">{editing?'Edit Group':'Add Group'}</h2><div className="space-y-4 p-4"><Field label="Group Name" required><Input value={name} onChange={e=>setName(e.target.value)} disabled={!canManage}/></Field>{teacherSubjects&&!editing&&<Field label="Subject" required><Select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Select assigned subject…</option>{teacherSubjects.map(x=><option key={x}>{x}</option>)}</Select></Field>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2">{editing&&<Button variant="ghost" onClick={reset}>Cancel</Button>}<Button disabled={!canManage} onClick={save}>Save</Button></div></div></div><div className="card overflow-hidden lg:col-span-3"><h2 className="border-b border-line p-4 font-semibold">Group List</h2><DataTable data={rows} rowKey={r=>r.id} pageSize={50} emptyTitle="No groups found" columns={[
 {key:'serial',header:'SL',render:(_r,i)=>String(i+1)},
 {key:'groupName',header:'Name',sortValue:r=>String(r.groupName??''),render:r=>r.groupName||'—'},
 {key:'groupNumber',header:'Group ID',render:(_r,i)=>String(i+1)},
 {key:'action',header:'Action',render:r=>canManage?<div className="flex justify-end gap-1"><button type="button" title="Edit Group" aria-label={`Edit ${r.groupName}`} className="grid size-9 place-items-center border border-line text-mist hover:bg-black/5 dark:hover:bg-white/10" onClick={()=>{setEditing(r);setName(String(r.groupName??''));setSubject(String(r.subject??''));setError('')}}><Pencil className="size-4"/></button><button type="button" title="Delete Group" aria-label={`Delete ${r.groupName}`} className="grid size-9 place-items-center bg-red-600 text-white hover:bg-red-700" onClick={()=>{setDeleting(r);setError('')}}><Trash2 className="size-4"/></button></div>:null}
 ]}/></div><Modal open={!!deleting} title="Delete Group?" onClose={()=>setDeleting(null)}>{deleting&&<><p className="text-sm text-mist">Delete {deleting.groupName}? Groups in use by questions cannot be deleted.</p><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={()=>{const err=onDelete(deleting);setDeleting(null);if(err)setError(err);else if(editing?.id===deleting.id)reset()}}>Delete</Button></div></>}</Modal></div>
}
