import type { AuditLog, User } from '../types'
export type AuditCriteria = { query:string; actor:string; action:string; entity:string; from:string; to:string }
export function filterAuditRows(rows:AuditLog[], users:User[], c:AuditCriteria):AuditLog[]{
 const query=c.query.trim().toLocaleLowerCase()
 return rows.filter(row=>{
  const actor=users.find(u=>u.id===row.userId)?.name||row.userId
  if(query&&!`${actor} ${row.userId} ${row.action} ${row.entity} ${row.details}`.toLocaleLowerCase().includes(query))return false
  if(c.actor&&row.userId!==c.actor)return false
  if(c.action&&row.action!==c.action)return false
  if(c.entity&&row.entity!==c.entity)return false
  if(c.from||c.to){const date=new Date(row.createdAt);if(Number.isNaN(date.getTime()))return false;const start=c.from?new Date(`${c.from}T00:00:00`).getTime():-Infinity;const end=c.to?new Date(`${c.to}T23:59:59.999`).getTime():Infinity;if(date.getTime()<start||date.getTime()>end)return false}
  return true
 })
}
/** Excel and CSV cells derived from logs can contain untrusted formula prefixes. */
export function safeAuditCell(value:unknown):string {const v=String(value??'');return /^[\s\u0000-\u001f]*[=+@\-]/.test(v)?`'${v}`:v}
export function auditOlderThan(rows:AuditLog[], cutoff:string):number {if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))return 0;const time=new Date(`${cutoff}T00:00:00`).getTime();if(!Number.isFinite(time))return 0;return rows.filter(row=>{const t=Date.parse(row.createdAt);return Number.isFinite(t)&&t<time}).length}
