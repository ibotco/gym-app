/** Scheduling details are drafts only; no scheduler consumes them yet. */
export type SmsScheduleDraft = { mode:'now'|'once'|'recurring'; date:string; time:string; repeat:'daily'|'weekly'|'monthly'; days:string[]; starts:string; ends:string }
export const SMS_WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const
export function normalizeSmsScheduleDraft(value:unknown): SmsScheduleDraft {
  const v = value && typeof value === 'object' ? value as Record<string,unknown> : {}
  return {
    mode:v.mode === 'once' || v.mode === 'recurring' ? v.mode : 'now',
    date:typeof v.date === 'string' ? v.date : '', time:typeof v.time === 'string' ? v.time : '',
    repeat:v.repeat === 'daily' || v.repeat === 'monthly' ? v.repeat : 'weekly',
    days:Array.isArray(v.days) ? v.days.filter((day):day is string => typeof day === 'string' && (SMS_WEEKDAYS as readonly string[]).includes(day)) : [],
    starts:typeof v.starts === 'string' ? v.starts : '', ends:typeof v.ends === 'string' ? v.ends : '',
  }
}
