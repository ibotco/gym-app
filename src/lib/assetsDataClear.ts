export const ASSET_DATA_MENUS=[
 {id:'register',label:'Asset register',desc:'Asset records only. Does not delete assignments, depreciation, transactions, audits or accounting journals.'},
 {id:'assignments',label:'Assignments',desc:'Asset assignment records only; does not change the asset register.'},
 {id:'maintenance',label:'Maintenance',desc:'Asset maintenance records only; related transactions and accounting remain unchanged.'},
 {id:'depreciation',label:'Depreciation',desc:'Recorded depreciation entries only. Linked journal entries and asset values are not reversed.'},
 {id:'transactions',label:'Asset transactions',desc:'Asset transaction history only. Does not reverse asset status, stock or accounting journals.'},
 {id:'setup',label:'Asset setup',desc:'Categories, conditions, type categories, depreciation policies and asset locations. The default calculation policy is retained; existing asset links are not repaired.'},
 {id:'audit',label:'Asset Audit',desc:'Asset audit sessions, verification items and audit logs only.'},
] as const
export const ASSET_DATA_KEYS:Record<string,string[]>={register:['fitpro_assets'],assignments:['fitpro_asset_assignments_v1'],maintenance:['fitpro_asset_maintenance_v1'],depreciation:['fitpro_depreciation'],transactions:['fitpro_asset_transactions'],setup:['fitpro_asset_categories','fitpro_asset_conditions','fitpro_asset_kind_categories_v1','fitpro_depreciation_policies_v1','fitpro_asset_locations_v1'],audit:['fitpro_asset_audits_v1','fitpro_asset_audit_items_v1','fitpro_asset_audit_log_v1']}
export function planAssetsDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){
 const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={}
 for(const [id,keys] of Object.entries(ASSET_DATA_KEYS)){counts[id]=0;for(const key of keys){let value:unknown;try{value=key in stores?JSON.parse(stores[key]):fallbacks[key]}catch{throw new Error(`Cannot inspect ${key}.`)}
  if(key==='fitpro_asset_kind_categories_v1'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid asset setup in ${key}.`);const v=value as Record<string,unknown>;for(const k of ['component','accessory','consumable','license']){if(!Array.isArray(v[k]))throw new Error(`Invalid asset categories in ${key}.`);counts[id]+=(v[k] as unknown[]).length}if(selected.has(id))changes[key]=JSON.stringify({...v,component:[],accessory:[],consumable:[],license:[]})}
  else{if(!Array.isArray(value))throw new Error(`Invalid asset data in ${key}.`);counts[id]+=value.length;if(selected.has(id))changes[key]='[]'}
 }}return {changes,counts}
}
