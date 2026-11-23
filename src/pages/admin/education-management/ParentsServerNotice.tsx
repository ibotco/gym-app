import { useEffect, useState, type FormEvent } from 'react'
import { Button, Field, Input } from '../../../components/ui'
import { getAppBasePath, getMysqlState, subscribeMysqlState } from '../../../lib/mysqlBridge'
import { trustedLogin, trustedLogout } from '../../../lib/trustedSession'

type Props={user:{id:string;email:string;role:string}|null|undefined}
export function ParentsServerNotice({user}:Props){
 const [bridge,setBridge]=useState(getMysqlState),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false)
 useEffect(()=>subscribeMysqlState(()=>setBridge(getMysqlState())),[])
 if(bridge.connected&&!bridge.error&&!signedIn)return null
 const maySignIn=user&&['super_admin','company_admin'].includes(user.role)
 async function signIn(e:FormEvent){e.preventDefault();if(!user||!password||busy)return;setBusy(true);setError('');try{
  const session=await trustedLogin(getAppBasePath(),user.email,password);setPassword('')
  if(session.user.id!==user.id||!['super_admin','company_admin'].includes(session.user.role)){await trustedLogout(getAppBasePath()).catch(()=>{});throw new Error('The trusted server account must match the signed-in administrator.')}
  setSignedIn(true)
 }catch(e){setPassword('');setError(e instanceof Error?e.message:'Unable to sign in to the server.')}finally{setBusy(false)}}
 return <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status"><p className="font-semibold">Server records are not connected</p><p className="mt-1">The parent list below may be an older browser copy. Sign in to the trusted server and reload to see the latest records. Reloading may replace unsynced browser changes; save or export any work first.</p>{bridge.error&&<p className="mt-1 text-xs">Connection: {bridge.error}</p>}{signedIn?<Button className="mt-3" onClick={()=>{if(window.confirm('Reload server data? Unsynced browser changes may be replaced.'))window.location.reload()}}>Reload server records</Button>:maySignIn?<form onSubmit={signIn} className="mt-3 max-w-sm space-y-2"><Field label="Trusted administrator server password"><Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></Field>{error&&<p role="alert" className="text-rose-600 dark:text-rose-300">{error}</p>}<Button type="submit" disabled={busy||!password}>{busy?'Signing in…':'Sign in to server'}</Button></form>:<p className="mt-2">Ask a trusted administrator to reconnect the server.</p>}</div>
}
