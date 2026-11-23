import { useEffect, useState, type FormEvent } from 'react'
import { Button, Field, Input, Modal } from '../../../components/ui'
import { apiUrl, getAppBasePath } from '../../../lib/mysqlBridge'
import { trustedLogin, trustedLogout, trustedRestore } from '../../../lib/trustedSession'

type Account = { id:string; studentId:string; email:string; status:string; linked:boolean; branchId:string }
type Session = { ok:true; csrf:string; user:{id:string;role:string} }
type Props = { student:{id:string;name:string}; branchId:string; staffId:string; staffEmail:string; onClose:()=>void }
export function StudentLoginCredentials({student,branchId,staffId,staffEmail,onClose}:Props){
 const [session,setSession]=useState<Session|null>(null),[account,setAccount]=useState<Account|null>(null)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [adminPassword,setAdminPassword]=useState(''),[signingIn,setSigningIn]=useState(false)
 async function loadAccounts(body:Session, signal?:AbortSignal){
  if(body.user.id!==staffId||!['company_admin','super_admin'].includes(body.user.role))throw new Error('The server account must match the signed-in administrator.')
  const r=await fetch(apiUrl(`/api/student/accounts-list?branchId=${encodeURIComponent(branchId)}`),{credentials:'same-origin',cache:'no-store',signal});const data=await r.json()
  if(!r.ok||data?.ok!==true||!Array.isArray(data.accounts))throw new Error(data?.error||'Unable to load student login accounts.')
  const matches=data.accounts.filter((a:Account)=>a.branchId===branchId&&a.studentId===student.id)
  if(matches.length>1)throw new Error('Multiple linked accounts require administrator review.')
  if(!signal?.aborted){setAccount(matches[0]||null);setSession(body);setError('')}
 }
 useEffect(()=>{
  const controller=new AbortController()
  async function load(){try{const body=await trustedRestore(getAppBasePath());if(!controller.signal.aborted)await loadAccounts(body,controller.signal)}
   catch(e){if(!controller.signal.aborted)setError('Sign in with your trusted administrator password to manage student credentials.')}finally{if(!controller.signal.aborted)setLoading(false)}}
  void load();return ()=>controller.abort()
 },[branchId,staffId,student.id])
 async function signIn(event:FormEvent){event.preventDefault();if(signingIn)return;setSigningIn(true);setError('')
  try{const body=await trustedLogin(getAppBasePath(),staffEmail,adminPassword);setAdminPassword('');if(body.user.id!==staffId||!['company_admin','super_admin'].includes(body.user.role)){await trustedLogout(getAppBasePath()).catch(()=>{});throw new Error('The server account must match the signed-in administrator.')};await loadAccounts(body)}
  catch(e){setAdminPassword('');setError(e instanceof Error?e.message:'Trusted sign-in failed.') }finally{setSigningIn(false)}
 }
 async function create(event:FormEvent){event.preventDefault();if(!session||account||saving)return;setError('');setSaving(true)
  try{const res=await fetch(apiUrl('/api/student/accounts'),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({branchId,studentId:student.id,email:email.trim(),password,csrf:session.csrf})});const data=await res.json();if(!res.ok||data?.ok!==true)throw new Error(data?.error||'Unable to create login.');setAccount({id:'',studentId:student.id,email:email.trim().toLowerCase(),status:'active',linked:true,branchId});setEmail('');setPassword('')}
  catch(e){setError(e instanceof Error?e.message:'Unable to create login.')}finally{setSaving(false)}
 }
 return <Modal open onClose={onClose} title="Student login credentials" maxWidth="lg">
  <div className="space-y-4"><p className="text-sm text-mist">Student: <strong className="text-ink dark:text-white">{student.name}</strong></p>
   {loading?<p role="status" className="text-sm text-mist">Checking the trusted account…</p>:!session?<form onSubmit={signIn} className="space-y-3" autoComplete="off"><p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{error || 'A trusted administrator sign-in is required.'}</p><p className="text-sm text-mist">Server account: <strong>{staffEmail}</strong>. This password is separate from the app login.</p><Field label="Trusted administrator password" required><Input type="password" required value={adminPassword} autoComplete="current-password" onChange={e=>setAdminPassword(e.target.value)}/></Field><Button type="submit" disabled={signingIn}>{signingIn?'Signing in…':'Sign in securely'}</Button></form>:account?<div className="space-y-3"><p className="text-sm">Login email: <strong>{account.email}</strong></p><p className="text-sm">Account status: {account.status}</p>{!account.linked&&<p className="text-sm text-amber-600">The linked student record is unavailable or inactive. Contact an administrator.</p>}<p className="text-sm text-mist">Passwords are stored securely and cannot be displayed. Password reset is not yet available here.</p></div>:<form className="space-y-3" onSubmit={create} autoComplete="off"><p className="text-sm text-mist">No login is linked to this student. An administrator can create one manually.</p><Field label="Login email" required><Input type="email" required value={email} autoComplete="off" onChange={e=>setEmail(e.target.value)}/></Field><Field label="Initial password" required><Input type="password" required minLength={12} value={password} autoComplete="new-password" onChange={e=>setPassword(e.target.value)}/></Field><p className="text-xs text-mist">Use at least 12 characters and share the password securely. It cannot be retrieved later.</p>{error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}<Button type="submit" disabled={saving}>{saving?'Creating…':'Create student login'}</Button></form>}
   <div className="flex justify-end border-t border-line pt-3"><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </div>
 </Modal>
}
