export const reminderTags = ['{guardian_name}', '{child_name}', '{due_date}', '{due_amount}', '{fee_type}'] as const
export function insertReminderTag(message: string, tag: string, start: number, end: number): {message: string; cursor: number} {
 const a = Math.max(0, Math.min(message.length, start)), b = Math.max(a, Math.min(message.length, end))
 return {message: message.slice(0,a)+tag+message.slice(b), cursor: a+tag.length}
}
export function reminderRecipients(row?: { recipientsJson?: string; notify?: string } | null): {student:boolean;guardian:boolean} {
 if (!row) return {student:true, guardian:true}
 if (row.recipientsJson) {
  try { const v=JSON.parse(row.recipientsJson); if (Array.isArray(v)) return {student:v.includes('student'),guardian:v.includes('guardian')} } catch { /* fall back to stored label */ }
 }
 return {student:/student/i.test(row.notify ?? ''),guardian:/guardian/i.test(row.notify ?? '')}
}
