/** Postal views share the legacy branch table. Never discard the other view or
 * unclassified legacy entries while editing a filtered list. */
export function postalRows<T extends {direction?:string}>(rows:T[],direction:string):T[]{return rows.filter(row=>String(row.direction??'').trim().toLowerCase()===direction.toLowerCase())}
export function replacePostalRows<T extends {direction?:string}>(rows:T[],direction:string,next:T[]):T[]{return [...rows.filter(row=>String(row.direction??'').trim().toLowerCase()!==direction.toLowerCase()),...next.map(row=>({...row,direction}))]}
