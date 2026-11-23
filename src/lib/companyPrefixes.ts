import type { NumberPrefix } from '../types'
export type PrefixDefinition = {key:string; label:string; prefix:string; module:string; packageIds:string[]; connected:boolean; group:string}
export const PREFIX_DEFINITIONS:PrefixDefinition[] = [
 {key:'invoice',label:'Sales invoice',prefix:'INV-',module:'sales',packageIds:['payments'],connected:true,group:'Sales'},
 {key:'estimate',label:'Estimate',prefix:'EST-',module:'sales',packageIds:['estimates'],connected:true,group:'Sales'},
 {key:'proposal',label:'Proposal',prefix:'PRO-',module:'sales',packageIds:['proposals'],connected:true,group:'Sales'},
 {key:'salesOrder',label:'Sales order',prefix:'SO-',module:'sales',packageIds:['salesOrders'],connected:true,group:'Sales'},
 {key:'salesReceipt',label:'Sales payment receipt',prefix:'SALE-',module:'sales',packageIds:['payments'],connected:true,group:'Sales'},
 {key:'purchaseOrder',label:'Purchase order',prefix:'PO-',module:'purchases',packageIds:['procurementOrders'],connected:false,group:'Purchases'},
 {key:'payment',label:'Payment',prefix:'PAY-',module:'accounting',packageIds:['accounting'],connected:false,group:'Accounting'},
 {key:'receipt',label:'Receipt',prefix:'RCT-',module:'accounting',packageIds:['accounting'],connected:false,group:'Accounting'},
 {key:'creditNote',label:'Credit note',prefix:'CN-',module:'sales',packageIds:['fulfillment'],connected:false,group:'Sales'},
 {key:'asset',label:'Asset tag',prefix:'AST-',module:'assets',packageIds:['assets'],connected:false,group:'Assets'},
 {key:'feeVoucher',label:'Fee payment voucher',prefix:'FV-',module:'educationManagement',packageIds:[],connected:true,group:'Education Management'},
]
export function prefixValue(list:readonly NumberPrefix[]|undefined,key:string,fallback:string):string {
 const found=list?.find(p=>p.key===key)?.prefix
 return typeof found==='string' && /^[A-Za-z]{1,12}[-/]?$/.test(found) ? found : fallback
}
export function mergePrefixes(saved:readonly NumberPrefix[]|undefined):NumberPrefix[] {
 const out=(saved||[]).map(x=>({...x}));for(const def of PREFIX_DEFINITIONS)if(!out.some(x=>x.key===def.key))out.push({key:def.key,label:def.label,prefix:def.prefix});return out
}
export function visiblePrefixDefinitions(modules:Record<string,boolean>,canModule:(id:string)=>boolean):PrefixDefinition[] {
 return PREFIX_DEFINITIONS.filter(d=>modules[d.module]===true && (!d.packageIds.length || d.packageIds.some(canModule)))
}
