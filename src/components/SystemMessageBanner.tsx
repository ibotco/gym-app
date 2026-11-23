import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { loadSystemMessages, systemMessageKey, visibleSystemMessages } from '../lib/systemMessages'

export function SystemMessageBanner(){
 const {activeCompanyId}=useApp();const {user}=useAuth();const [tick,setTick]=useState(0)
 const userId=user?.id||'';const mailboxKey=`fitpro_system_mail_state_v1_${activeCompanyId}_${userId}`;const dismissKey=`fitpro_system_messages_dismissed_v1_${activeCompanyId}_${userId}`
 useEffect(()=>{const refresh=()=>setTick(v=>v+1);const storage=(e:StorageEvent)=>{if(e.key===systemMessageKey(activeCompanyId)||e.key===dismissKey||e.key===mailboxKey)refresh()};window.addEventListener('storage',storage);window.addEventListener('fitpro:system-messages',refresh);return ()=>{window.removeEventListener('storage',storage);window.removeEventListener('fitpro:system-messages',refresh)}},[activeCompanyId,dismissKey,mailboxKey])
 let dismissed:string[]=[];try{const v=JSON.parse(localStorage.getItem(dismissKey)||'[]');if(Array.isArray(v))dismissed=v.filter(x=>typeof x==='string')}catch{/* no dismissals */}
 let trash:string[]=[];try{const value=JSON.parse(localStorage.getItem(mailboxKey)||'{}');if(Array.isArray(value.trash))trash=value.trash.filter((id:unknown)=>typeof id==='string')}catch{/* no local trash state */}
 void tick
 const messages=visibleSystemMessages(loadSystemMessages(activeCompanyId),userId).filter(m=>!dismissed.includes(m.id)&&!trash.includes(m.id))
 function dismiss(id:string){try{localStorage.setItem(dismissKey,JSON.stringify([...dismissed,id]));setTick(v=>v+1)}catch{/* keep visible if dismissal cannot be saved */}}
 return <div className={messages.length?'mb-4 space-y-2':''}>{messages.map(m=><div key={m.id} role="status" className="flex gap-3 rounded-xl border border-blue-400/40 bg-blue-500/10 p-4 text-sm"><Bell className="mt-0.5 size-4 shrink-0"/><div className="min-w-0 flex-1"><div className="font-semibold">{m.title}</div><p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p><p className="mt-1 text-xs text-mist">{m.author}</p></div><button type="button" className="self-start p-1 text-mist" aria-label={`Dismiss ${m.title}`} onClick={()=>dismiss(m.id)}><X className="size-4" /></button></div>)}</div>
}
