import type { ReactNode } from 'react'
import type { EduRow } from '../../../lib/eduRecords'
import { Button, Input, Select, Textarea } from '../../../components/ui'

type Props={row:EduRow;hostels:string[];onChange:(key:string,value:string)=>void;onCancel:()=>void;onSave:()=>void}
export function HostelRoomForm({row,hostels,onChange,onCancel,onSave}:Props){
 const selected=String(row.hostelName??''),names=[...new Set([...hostels,selected].filter(Boolean))].sort(),category=String(row.category??'')
 const field=(id:string,label:string,control:ReactNode,required=false)=><div className="grid min-w-0 grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]"><label htmlFor={id} className="min-w-0 break-words text-sm font-medium sm:text-right">{label} {required&&<span className="text-rose-500">*</span>}</label><div className="min-w-0 max-w-full">{control}</div></div>
 return <div className="min-w-0 space-y-4"><div className="min-w-0 divide-y divide-line overflow-hidden rounded-xl border border-line">
 {field('room-hostel','Hostel',<Select id="room-hostel" aria-label="Hostel" value={selected} onChange={e=>onChange('hostelName',e.target.value)} placeholder="Select…">{names.map(x=><option key={x} value={x}>{x}</option>)}</Select>,true)}
 {field('room-number','Room number',<Input id="room-number" value={String(row.roomNumber??'')} onChange={e=>onChange('roomNumber',e.target.value)}/>,true)}
 {field('room-floor','Floor / block',<Input id="room-floor" value={String(row.floor??'')} onChange={e=>onChange('floor',e.target.value)}/>)}
 {field('room-category','Category',<Select id="room-category" aria-label="Category" value={category} onChange={e=>onChange('category',e.target.value)} placeholder="Select…"><option value="Residential">Residential</option>{category && category!=='Residential'&&<option value={category}>{category}</option>}</Select>,true)}
 {field('room-beds','No Of Beds',<Input id="room-beds" type="number" min="1" step="1" value={String(row.capacity??'')} onChange={e=>onChange('capacity',e.target.value)}/>,true)}
 {field('room-cost','Cost Per Bed',<Input id="room-cost" type="number" min="0" step="0.01" value={String(row.costPerBed??'')} onChange={e=>onChange('costPerBed',e.target.value)}/>,true)}
 {field('room-remarks','Remarks',<Textarea id="room-remarks" className="max-w-full resize-y" rows={3} value={String(row.remarks??'')} onChange={e=>onChange('remarks',e.target.value)}/>)}
 {field('room-status','Status',<Select id="room-status" aria-label="Status" value={String(row.status??'')} onChange={e=>onChange('status',e.target.value)} placeholder="Select…">{[...new Set(['Available','Full','Maintenance',String(row.status??'')].filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</Select>)}
 </div><div className="sticky bottom-0 z-10 -mb-4 flex flex-col-reverse gap-2 border-t border-line bg-white pb-4 pt-3 dark:bg-[#141416] sm:flex-row"><Button className="flex-1" onClick={onSave}>Save</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div></div>
}
