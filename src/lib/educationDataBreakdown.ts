type MenuLeaf = { id:string; key:string }
type MenuGroup = { id:string; key:string; leaves:MenuLeaf[] }
type TableCount = { id:string; key:string; count:number|null }
const additional:Record<string,string[]> = {
 studentFinance:['feesInvoicePayments','scholarshipPostings','scholarshipAllocations'],
}
/** Inspect the existing shared education store without changing or seeding it. */
export function educationDataBreakdown(raw:string|null, menu:MenuGroup[]) {
 let branches:Record<string,unknown>={};let readable=true
 try {if(raw!==null){const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))readable=false;else {const record=parsed as Record<string,unknown>;branches=Object.values(record).some(Array.isArray)?{__legacy__:record}:record}}}catch{readable=false}
 const counts=new Map<string,number>();if(readable)for(const tables of Object.values(branches)){if(!tables||typeof tables!=='object'||Array.isArray(tables)){readable=false;continue}for(const [name,rows] of Object.entries(tables as Record<string,unknown>)){if(Array.isArray(rows))counts.set(name,(counts.get(name)||0)+rows.length)}}
 const used=new Set<string>()
 const groups=menu.map(group=>{const leaves:TableCount[]=group.leaves.map(leaf=>{used.add(leaf.id);return {id:leaf.id,key:leaf.key,count:readable&&counts.has(leaf.id)?counts.get(leaf.id)!:null}});for(const id of additional[group.id]||[]){used.add(id);if(counts.has(id))leaves.push({id,key:'',count:readable?counts.get(id)!:null})}return {id:group.id,key:group.key,leaves}})
 const other=[...counts.entries()].filter(([id])=>!used.has(id)&&id!=='__maintenanceClearedTables').sort(([a],[b])=>a.localeCompare(b)).map(([id,count])=>({id,key:'',count:readable?count:null}))
 return {readable,groups,other}
}
export function readableEduTableName(id:string){return id.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase())}
