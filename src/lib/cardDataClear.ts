export const CARD_DATA_MENUS=[
 {id:'templates',label:'Templates',desc:'Saved card templates across available branches. Default template settings and existing cards remain; their template references may no longer resolve.'},
 {id:'generation',label:'Generation',desc:'Only “Generated” entries in card history. Generated card records are shared with Issuance and are not removed.'},
 {id:'issuance',label:'Issuance',desc:'All card records, including generated cards, and recognised issuance, print, replacement and status history. Template, generation and verification history are preserved.'},
 {id:'verification',label:'Verification',desc:'Only “Verified” card history entries. Card records are shared with Issuance and are not removed.'},
] as const
const issuance=new Set(['issued','printed','activated','marked lost','marked damaged','expired','replaced','edited'])
const action=(r:any)=>typeof r?.action==='string'?r.action.trim().toLowerCase():''
export function planCardDataClear(raw:string,markerRaw:string|null,ids:readonly string[]){
 let stores:any,markers:any;try{stores=JSON.parse(raw);markers=markerRaw?JSON.parse(markerRaw):{}}catch{throw new Error('Cannot inspect the card store or clear markers.')}
 if(!stores||typeof stores!=='object'||Array.isArray(stores)||!markers||typeof markers!=='object'||Array.isArray(markers))throw new Error('Invalid card store or clear markers.')
 const selected=new Set(ids),counts:Record<string,number>={templates:0,generation:0,issuance:0,verification:0}
 for(const [branch,v] of Object.entries(stores)){
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(`Invalid card data for branch ${branch}.`)
  const record=v as Record<string,unknown>,mark=markers[branch]??[];if(!Array.isArray(mark)||mark.some(x=>typeof x!=='string'))throw new Error(`Invalid card clear marker for branch ${branch}.`)
  for(const key of ['idCardTemplates','idCards','idCardHistory'])if(record[key]!==undefined&&!Array.isArray(record[key]))throw new Error(`Invalid ${key} for branch ${branch}.`)
  const templates=(record.idCardTemplates??[]) as unknown[],cards=(record.idCards??[]) as unknown[],history=(record.idCardHistory??[]) as unknown[]
  counts.templates+=templates.length;counts.issuance+=cards.length;for(const h of history){const a=action(h);if(a==='generated')counts.generation++;else if(a==='verified')counts.verification++;else if(issuance.has(a))counts.issuance++}
  if(selected.has('templates')){record.idCardTemplates=[];if(!mark.includes('idCardTemplates'))mark.push('idCardTemplates')}
  if(selected.has('issuance')){record.idCards=[];if(!mark.includes('idCards'))mark.push('idCards')}
  if(selected.has('generation')||selected.has('verification')||selected.has('issuance')){record.idCardHistory=history.filter(h=>{const a=action(h);return !(a==='generated'&&selected.has('generation')||a==='verified'&&selected.has('verification')||issuance.has(a)&&selected.has('issuance'))});if(history.length>0&&(record.idCardHistory as unknown[]).length===0&&!mark.includes('idCardHistory'))mark.push('idCardHistory')}
  if(mark.length)markers[branch]=mark
 }
 return {next:JSON.stringify(stores),markers:JSON.stringify(markers),counts}
}
