/** Browser-local announcements. Recipient filtering is presentation only, not security. */
export type SystemMessage={id:string;title:string;body:string;recipientIds:string[];createdAt:string;author:string;authorId?:string}
export const systemMessageKey=(companyId:string)=>`fitpro_system_messages_v1_${companyId}`
export function loadSystemMessages(companyId:string):SystemMessage[] {
 if(!companyId)return []
 try {const value=JSON.parse(localStorage.getItem(systemMessageKey(companyId))||'[]');return Array.isArray(value)?value.filter((m:unknown):m is SystemMessage=>!!m && typeof m==='object' && typeof (m as SystemMessage).id==='string' && typeof (m as SystemMessage).title==='string' && typeof (m as SystemMessage).body==='string' && Array.isArray((m as SystemMessage).recipientIds) && (m as SystemMessage).recipientIds.every(id=>typeof id==='string') && typeof (m as SystemMessage).createdAt==='string' && typeof (m as SystemMessage).author==='string'):[]}catch{return []}
}
export function visibleSystemMessages(messages:SystemMessage[],userId:string):SystemMessage[]{return userId?messages.filter(m=>m.recipientIds.includes(userId)):[]}
export function saveSystemMessages(companyId:string,messages:SystemMessage[]){localStorage.setItem(systemMessageKey(companyId),JSON.stringify(messages));window.dispatchEvent(new CustomEvent('fitpro:system-messages',{detail:companyId}))}
