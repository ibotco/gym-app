import { useEffect, useMemo, useState } from 'react'
import { Archive, MessageSquareText, Plus } from 'lucide-react'
import { Button, Modal, SearchField, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { formatDateTime, uid } from '../../../lib/utils'
import { ComposeSms } from './ComposeSms'
import type { SmsAttempt } from './DirectNotifications'

type SmsRecord = { id:string; to:string; message:string; status:'submitted'|'unconfirmed'; authorId:string; author:string; createdAt:string; priority?:'low'|'normal'|'high'|'urgent' }
const key = (companyId:string) => `fitpro_sms_notification_history_v1_${companyId}`
function load(companyId:string): SmsRecord[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key(companyId)) || '[]'); return Array.isArray(data) ? data.filter(x => x && typeof x.id === 'string' && typeof x.to === 'string' && typeof x.message === 'string' && (x.status === 'submitted' || x.status === 'unconfirmed')) : [] } catch { return [] }
}
export function SmsNotifications() {
  const { activeCompanyId, companies } = useApp()
  const { user } = useAuth()
  const [composing,setComposing] = useState(false)
  const [records,setRecords] = useState<SmsRecord[]>(() => load(activeCompanyId))
  const [tab,setTab] = useState<'all'|'mine'>('all')
  const [search,setSearch] = useState('')
  const [filter,setFilter] = useState<'all'|'submitted'|'unconfirmed'>('all')
  const [view,setView] = useState<SmsRecord | null>(null)
  const [storeError,setStoreError] = useState('')
  useEffect(() => {
    setRecords(load(activeCompanyId)); setComposing(false); setView(null); setStoreError('')
    const onStorage = (e:StorageEvent) => { if (e.key === key(activeCompanyId)) setRecords(load(activeCompanyId)) }
    window.addEventListener('storage',onStorage); return () => window.removeEventListener('storage',onStorage)
  },[activeCompanyId])
  function recordAttempt(attempt:SmsAttempt) {
    const entry:SmsRecord = {id:uid('smsnotice'),to:attempt.to,message:attempt.message,status:attempt.ok?'submitted':'unconfirmed',authorId:user?.id || '',author:user?.name || 'Unknown',createdAt:new Date().toISOString(),priority:attempt.priority}
    try {
      const next = [entry,...load(attempt.companyId)]
      localStorage.setItem(key(attempt.companyId),JSON.stringify(next))
      if (attempt.companyId === activeCompanyId) setRecords(next)
    } catch { setStoreError('The request was processed, but its history could not be saved. Check the provider before retrying.') }
  }
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter(r => (tab === 'all' || r.authorId === user?.id) && (filter === 'all' || r.status === filter) && (!q || `${r.message} ${r.to} ${r.author || ''}`.toLowerCase().includes(q)))
  },[records,tab,filter,search,user?.id])
  const ownCount = records.filter(r => r.authorId === user?.id).length
  const submitted = records.filter(r => r.status === 'submitted').length
  const unconfirmed = records.filter(r => r.status === 'unconfirmed').length
  const company = companies.find(c => c.id === activeCompanyId)?.name || 'this company'
  if (composing) return <div><ComposeSms onSmsResult={recordAttempt} onBack={() => setComposing(false)} />{storeError && <p role="alert" className="mt-3 text-sm text-amber-600">{storeError}</p>}</div>
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#193a66] px-5 py-5 text-white sm:px-6">
      <div className="flex items-center gap-4"><div className="rounded-lg border border-white/20 bg-white/10 p-3"><MessageSquareText className="size-6" /></div><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Communication</p><h1 className="text-2xl font-bold">SMS Notifications</h1><p className="mt-1 text-sm text-blue-100">SMS attempts recorded in this browser for {company}.</p></div></div>
      <Button variant="outline" className="border-white bg-white text-[#193a66] hover:bg-blue-50" onClick={() => setComposing(true)}><Plus className="size-4" /> New SMS</Button>
    </div>
    <div className="card grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
      {[{name:'Notifications',value:String(records.length),note:`${ownCount} created by you`},{name:'Submitted',value:String(submitted),note:'Provider request returned success'},{name:'Unconfirmed',value:String(unconfirmed),note:'Check provider before retrying'},{name:'Scheduled',value:'—',note:'Scheduling not available'}].map(stat => <div key={stat.name} className="border-b border-line p-5 last:border-0 sm:border-r xl:border-b-0"><p className="text-xs font-semibold uppercase tracking-wide text-mist">{stat.name}</p><p className="mt-2 text-2xl font-bold">{stat.value}</p><p className="mt-1 text-xs text-mist">{stat.note}</p></div>)}
    </div>
    <div className="rounded-lg border border-line bg-surface px-5 py-4 text-sm text-mist">Delivery is not verified. History includes only attempts made on this page, including setup failures, and is stored in browser-backed storage; cross-device sync and hierarchical visibility are not guaranteed. Messages and phone numbers may be synchronized to the app database.</div>
    {storeError && <p role="alert" className="text-sm text-amber-600">{storeError}</p>}
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="flex rounded-lg border border-line p-1"><button type="button" aria-pressed={tab==='all'} onClick={()=>setTab('all')} className={`rounded px-3 py-2 text-xs ${tab==='all'?'bg-black/10 font-semibold dark:bg-white/10':'text-mist'}`}>All visible</button><button type="button" aria-pressed={tab==='mine'} onClick={()=>setTab('mine')} className={`rounded px-3 py-2 text-xs ${tab==='mine'?'bg-black/10 font-semibold dark:bg-white/10':'text-mist'}`}>My messages</button></div>
        <SearchField className="min-w-[180px] flex-1 sm:max-w-xs" placeholder="Search message or recipient" value={search} onChange={setSearch} />
        <div className="w-40"><Select aria-label="Filter by status" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="unconfirmed">Unconfirmed</option></Select></div><span className="text-sm text-mist">{visible.length} records</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-mist"><th className="px-5 py-3">Notification</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Delivery</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Date</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className="border-b border-line last:border-0"><td className="max-w-xs px-5 py-3"><button className="block max-w-full truncate text-left font-semibold text-violet-600 hover:underline dark:text-violet-400" onClick={()=>setView(r)}>{r.message}</button><span className="text-xs text-mist">{r.to}</span></td><td className="px-5 py-3">{r.status==='submitted'?'Submitted':'Unconfirmed'}</td><td className="px-5 py-3 capitalize">{r.priority || '—'}</td><td className="px-5 py-3 text-mist">Not verified</td><td className="px-5 py-3">{r.author}</td><td className="whitespace-nowrap px-5 py-3 text-mist">{formatDateTime(r.createdAt)}</td></tr>)}</tbody></table>{!visible.length && <div className="grid place-items-center gap-3 px-4 py-14 text-sm text-mist"><Archive className="size-10 opacity-40" /><p>{records.length ? 'No matching notifications' : 'No data'}</p></div>}</div>
    </div>
    {view && <Modal open title="SMS notification" onClose={()=>setView(null)} maxWidth="2xl"><div className="space-y-3 text-sm"><p><strong>Recipient:</strong> {view.to}</p><p><strong>Priority:</strong> <span className="capitalize">{view.priority || 'Not recorded'}</span></p><p><strong>Status:</strong> {view.status === 'submitted' ? 'Submitted' : 'Unconfirmed'} · delivery not verified</p><p className="whitespace-pre-wrap break-words rounded-lg border border-line p-3">{view.message}</p><p className="text-xs text-mist">{view.author} · {formatDateTime(view.createdAt)}</p></div></Modal>}
  </div>
}
