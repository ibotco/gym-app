export const USER_DATA_MENUS=[
 {id:'users',label:'All users',desc:'All stored user accounts across companies, including administrators. Clearing can prevent login; credential-event history and linked people records are not removed.'},
 {id:'roles',label:'Roles & permissions',desc:'Custom roles and permissions and the permission matrix across companies. Built-in role and permission definitions are preserved; user assignments are not repaired.'},
 {id:'audit',label:'Audit logs',desc:'System activity log records. Credential events, approval history and accounting history are separate and are not removed.'},
] as const
export const USER_DATA_KEYS=['fitpro_users','fitpro_roles','fitpro_permissions','fitpro_permission_matrix','fitpro_audit_logs','fitpro_seed_merge_suppressed:fitpro_users']
export function planUserDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){
 const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={users:0,roles:0,audit:0}
 function array(key:string){let v:unknown;try{v=key in stores?JSON.parse(stores[key]):fallbacks[key]}catch{throw new Error(`Cannot inspect ${key}.`)}if(!Array.isArray(v))throw new Error(`Invalid data in ${key}.`);return v as any[]}
 const users=array('fitpro_users'),roles=array('fitpro_roles'),permissions=array('fitpro_permissions'),audit=array('fitpro_audit_logs')
 const effectiveUsers=fallbacks.fitpro_users,effectiveRoles=fallbacks.fitpro_roles,effectivePermissions=fallbacks.fitpro_permissions
 if(!Array.isArray(effectiveUsers)||!Array.isArray(effectiveRoles)||!Array.isArray(effectivePermissions))throw new Error('Invalid effective user or role data.')
 let matrix:any;try{matrix=stores.fitpro_permission_matrix?JSON.parse(stores.fitpro_permission_matrix):{}}catch{throw new Error('Cannot inspect the permission matrix.')}
 if(!matrix||typeof matrix!=='object'||Array.isArray(matrix))throw new Error('Invalid permission matrix.')
 counts.users=effectiveUsers.length;counts.roles=effectiveRoles.filter((r:any)=>!r.builtin).length+effectivePermissions.filter((r:any)=>!r.builtin).length+(Object.keys(matrix).length?1:0);counts.audit=audit.length
 if(selected.has('users')){changes.fitpro_users='[]';changes['fitpro_seed_merge_suppressed:fitpro_users']='1'}
 if(selected.has('roles')){changes.fitpro_roles=JSON.stringify(effectiveRoles.filter((r:any)=>r.builtin));changes.fitpro_permissions=JSON.stringify(effectivePermissions.filter((r:any)=>r.builtin));changes.fitpro_permission_matrix='{}'}
 if(selected.has('audit'))changes.fitpro_audit_logs='[]'
 return {changes,counts}
}
