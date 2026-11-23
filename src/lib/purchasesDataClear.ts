export const PURCHASE_DATA_MENUS=[
 {id:'requisitions',label:'Purchase requisitions',desc:'Procurement requisitions only. Linked purchase orders are not removed.'},
 {id:'orders',label:'Purchase orders',desc:'Procurement purchase orders only. Requisitions, receipts, invoices and legacy purchase orders are not removed.'},
 {id:'receipts',label:'Goods receipts (GRN)',desc:'Goods receipt records only. Stock movements and inventory balances are not reversed.'},
 {id:'invoices',label:'Purchase invoices',desc:'Supplier purchase invoices only. Payments, stock and accounting entries are not reversed.'},
 {id:'payments',label:'Supplier payments',desc:'Supplier payment records only. Invoice balances and accounting entries are not repaired or reversed.'},
 {id:'returns',label:'Purchase returns',desc:'Procurement return records only. Stock movements, inventory balances and accounting entries are not reversed; legacy returns are separate.'},
 {id:'reports',label:'Purchase reports',desc:'Calculated from purchase records; no independently stored report collection.'},
] as const
export const PURCHASE_DATA_KEYS:Record<string,string[]>={requisitions:['fitpro_requisitions'],orders:['fitpro_proc_purchase_orders'],receipts:['fitpro_goods_receipts'],invoices:['fitpro_supplier_invoices'],payments:['fitpro_supplier_payments'],returns:['fitpro_proc_returns']}
export function planPurchasesDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={reports:0};for(const [id,keys] of Object.entries(PURCHASE_DATA_KEYS)){counts[id]=0;for(const key of keys){let value:unknown;try{value=key in stores?JSON.parse(stores[key]):fallbacks[key]}catch{throw new Error(`Cannot inspect ${key}.`)}if(!Array.isArray(value))throw new Error(`Invalid purchase data in ${key}.`);counts[id]+=value.length;if(selected.has(id))changes[key]='[]'}}return {changes,counts}}
