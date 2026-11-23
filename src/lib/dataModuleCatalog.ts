import { MODULES } from './modules'
import type { DataCollection } from './dataReset'

// Legacy collection categories predate the sidebar module names. These aliases
// change presentation only; collection keys and the reset/backup scopes stay intact.
const aliases: Record<string,string> = { Education:'Education Management', Projects:'Project Management' }
const gymNames = 'memberships classes qr check-in'
const mediaNames = 'media uploads file sharing settings'
const userNames = 'all users roles permissions audit logs'
const organizationNames = 'companies branches cost centers licensing subscriptions subscription packages app marketplace my subscription my package'
const inventoryNames = 'products and services update price print labels import products import opening stock product settings stock management'
const certificateNames = 'certificate types certificate register certificate templates certificate generation bulk generation certificate verification certificate reports certificate settings'
const peopleNames = 'imageshop members supplier management leads crm customer management'
const cardNames = 'templates generation issuance verification'
const purchaseNames = 'purchase requisitions purchase orders goods receipts grn purchase invoices supplier payments purchase returns purchase reports'
const projectNames = 'projects contracts tasks assign tasks template timesheet project invoice project reports project settings'
const assetNames = 'asset register assignments maintenance depreciation asset transactions asset setup asset audit'
const approvalNames = 'pending approvals approval history approval rule builder approval reports'
const communicationNames = 'events notice board system message sms notifications email notifications email template sms template approval notifications'
const notes: Record<string,string> = {
  'Overview': 'Dashboard data comes from other modules; there is no separate clearable collection.',
  'Certificate Management': 'Certificate records are stored with Education records. Clearing Education records also affects certificates.',
}
export function dataModuleCatalog(collections:DataCollection[], search='') {
 const query=search.trim().toLowerCase(),groups=new Map<string,DataCollection[]>()
 for(const module of MODULES)groups.set(module.label,[])
 for(const c of collections){const label=c.key==='fileSharing'?'Media Library':aliases[c.module]||c.module;const group=groups.get(label)||[];group.push(c);groups.set(label,group)}
 return [...groups.entries()].map(([module,items])=>{const matchingModule=module.toLowerCase().includes(query);return {module,collections:items.filter(c=>!query||matchingModule||`${c.label} ${c.desc} ${c.key}`.toLowerCase().includes(query)).sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'})),note:notes[module]||'No separately supported clearable collection is listed for this module.'}}).filter(group=>!query||group.module.toLowerCase().includes(query)||group.collections.length>0||(group.module==='Communications'&&communicationNames.includes(query))||(group.module==='Approvals'&&approvalNames.includes(query))||(group.module==='Assets Management'&&assetNames.includes(query))||(group.module==='Project Management'&&projectNames.includes(query))||(group.module==='Purchases'&&purchaseNames.includes(query))||(group.module==='Card Management'&&cardNames.includes(query))||(group.module==='People'&&peopleNames.includes(query))||(group.module==='Certificate Management'&&certificateNames.includes(query))||(group.module==='Inventory'&&inventoryNames.includes(query))||(group.module==='Organizations'&&organizationNames.includes(query))||(group.module==='User Management'&&userNames.includes(query))||(group.module==='Media Library'&&mediaNames.includes(query))||(group.module==='Gym Management'&&gymNames.includes(query))).sort((a,b)=>a.module.localeCompare(b.module,undefined,{sensitivity:'base'}))
}
