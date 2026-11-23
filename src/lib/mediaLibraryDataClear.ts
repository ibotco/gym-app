export const MEDIA_DATA_MENUS=[
 {id:'uploads',label:'Media Uploads',desc:'The current uploads page keeps files and folders in page memory only; sample items return on reopening. There is no persistent upload collection to clear here. Imageshop and server files are separate.'},
 {id:'sharing',label:'File Sharing',desc:'Saved file-sharing records and their activity in this browser. This does not delete underlying files or guarantee that external links are revoked.'},
 {id:'settings',label:'Settings',desc:'Restore saved Media Library settings to the application defaults. Files and shares remain unchanged.'},
] as const
export const MEDIA_DATA_KEYS=['fitpro_file_sharing','fitpro_media_settings']
export function planMediaDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){
 const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={uploads:0,sharing:0,settings:0}
 let shares:unknown;try{shares='fitpro_file_sharing' in stores?JSON.parse(stores.fitpro_file_sharing):fallbacks.fitpro_file_sharing}catch{throw new Error('Cannot inspect file sharing records.')}
 if(!Array.isArray(shares))throw new Error('Invalid file sharing records.');counts.sharing=shares.length
 if('fitpro_media_settings' in stores){let settings:unknown;try{settings=JSON.parse(stores.fitpro_media_settings)}catch{throw new Error('Cannot inspect media settings.')};if(!settings||typeof settings!=='object'||Array.isArray(settings))throw new Error('Invalid media settings.');counts.settings=1}
 if(selected.has('sharing'))changes.fitpro_file_sharing='[]'
 if(selected.has('settings')){const defaults=fallbacks.defaultMediaSettings;if(!defaults||typeof defaults!=='object'||Array.isArray(defaults))throw new Error('Invalid default media settings.');changes.fitpro_media_settings=JSON.stringify(defaults)}
 return {changes,counts}
}
