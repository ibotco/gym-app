export const GYM_DATA_MENUS=[
 {id:'memberships',label:'Memberships',desc:'Membership plans and membership records. Member profiles, payments, invoices and other linked records remain unchanged.'},
 {id:'classes',label:'Classes',desc:'Class records and class bookings. Attendance, trainer records and other linked records remain unchanged.'},
 {id:'checkin',label:'QR Check-in',desc:'Attendance entries of type check-in only. Class and personal-training attendance are preserved.'},
] as const
export const GYM_DATA_KEYS=['fitpro_plans','fitpro_memberships','fitpro_classes','fitpro_bookings','fitpro_attendance','fitpro_seed_merge_suppressed:fitpro_memberships']
export function planGymDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){
 const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={memberships:0,classes:0,checkin:0}
 const keys=['fitpro_plans','fitpro_memberships','fitpro_classes','fitpro_bookings','fitpro_attendance'],values:Record<string,any[]>={}
 for(const key of keys){let v:unknown;try{v=key in stores?JSON.parse(stores[key]):fallbacks[key]}catch{throw new Error(`Cannot inspect ${key}.`)}if(!Array.isArray(v))throw new Error(`Invalid gym data in ${key}.`);values[key]=v}
 const effective=fallbacks.fitpro_memberships;if(!Array.isArray(effective))throw new Error('Invalid membership data.')
 counts.memberships=values.fitpro_plans.length+effective.length;counts.classes=values.fitpro_classes.length+values.fitpro_bookings.length;counts.checkin=values.fitpro_attendance.filter(x=>x?.type==='checkin').length
 if(selected.has('memberships')){changes.fitpro_plans='[]';changes.fitpro_memberships='[]';changes['fitpro_seed_merge_suppressed:fitpro_memberships']='1'}
 if(selected.has('classes')){changes.fitpro_classes='[]';changes.fitpro_bookings='[]'}
 if(selected.has('checkin'))changes.fitpro_attendance=JSON.stringify(values.fitpro_attendance.filter(x=>x?.type!=='checkin'))
 return {changes,counts}
}
