export type SmsAudienceDraft = { targetTypes:string[]; roles:string[]; groups:string[]; excludeTypes:string[]; excludeRoles:string[]; excludeGroups:string[]; students:string[]; studentBranchId:string; selections:Record<string,string[]> }
const strings = (x:unknown): string[] => Array.isArray(x) ? [...new Set(x.filter((v):v is string => typeof v === 'string' && v.length > 0))] : []
export function normalizeSmsAudienceDraft(value:unknown, legacyTarget?:unknown):SmsAudienceDraft {
 const v = value && typeof value === 'object' ? value as Record<string,unknown> : {}
 const legacy = typeof legacyTarget === 'string' && legacyTarget.startsWith('audience:') ? legacyTarget.slice(9) : ''
 const rawTypes = strings(v.targetTypes)
 const oldRoles = Array.isArray(v.roles) ? strings(v.roles) : legacy ? [legacy] : []
 const targets = Array.isArray(v.targetTypes) ? rawTypes : legacy ? ['roles'] : ['custom']
 // Migrate earlier drafts that grouped role selections under the generic roles type.
 const expanded = targets.includes('roles') && oldRoles.length ? [...new Set([...targets.filter(t=>t!=='roles'), ...oldRoles.map(id=>`audience:${id}`)])] : targets
 return {
  targetTypes: expanded,
  roles: oldRoles, groups:strings(v.groups),
  selections: v.selections && typeof v.selections === 'object' && !Array.isArray(v.selections) ? Object.fromEntries(Object.entries(v.selections).map(([k,val])=>[k,strings(val)])) : {},
  excludeTypes:strings(v.excludeTypes), excludeRoles:strings(v.excludeRoles), excludeGroups:strings(v.excludeGroups), students:strings(v.students), studentBranchId:typeof v.studentBranchId === 'string' ? v.studentBranchId : '',
 }
}
/** Direct send must never silently ignore any requested groups or exclusions. */
export function canSendIndividual(a:SmsAudienceDraft):boolean {
 return a.targetTypes.length === 1 && a.targetTypes[0] === 'custom' && a.excludeTypes.length === 0
}

/** Only student targeting without other audiences or exclusions is supported. */
export function canSendSelectedStudents(a:SmsAudienceDraft):boolean {
 return a.targetTypes.length === 1 && a.targetTypes[0] === 'audience:audience_student' && a.excludeTypes.length === 0
}
