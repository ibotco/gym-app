import type { RoleDef } from '../types'

type Audience = { id: string; name: string }
type ModuleRule = { module: string; packageIds?: string[]; prefixes: string[] }
// In the current registry Education, Church and Approvals have no package IDs.
const RULES: ModuleRule[] = [
  {module:'educationManagement', prefixes:['education.']},
  {module:'churchManagement', prefixes:['church.']},
  {module:'programs', packageIds:['plans','classes','checkin'], prefixes:['plans.','classes.','checkin.','coach.','member.']},
  {module:'hrm', packageIds:['hrm','hrmAttendance','hrmShifts','hrmTraining','hrmRecruitment','hrmLeave','hrmPayroll','hrmPerformance','hrmAdvanceSalary','hrmLoans'], prefixes:['staff.','departments.','leave.','attendance.','payroll.','recruitment.','performance.']},
  {module:'assets', packageIds:['assets'], prefixes:['assets.']},
  {module:'projects', packageIds:['projects'], prefixes:['projects.','project.']},
  {module:'accounting', packageIds:['accounting','payments'], prefixes:['accounting.','payments.']},
  {module:'inventory', packageIds:['inventory'], prefixes:['inventory.']},
  {module:'sales', packageIds:['sales','pos','salesOrders','estimates','proposals'], prefixes:['sales.','pos.']},
  {module:'purchases', packageIds:['procurementOrders','supplierInvoices','supplierPayments','procurementReturns','procurementReports'], prefixes:['purchases.']},
  {module:'people', packageIds:['members','customers','suppliers','leads'], prefixes:['members.','customers.','suppliers.','customer.','supplier.','leads.']},
  {module:'approvals', prefixes:['approvals.']},
]
const CORE = new Set(['super_admin','company_admin','branch_admin','head_office'])
const RESTRICTED_BUILTINS: Record<string,string> = { teacher:'educationManagement', trainer:'programs', member:'programs', gym_manager:'programs', customer:'people', supplier:'people' }
export function getNoticeAudiences(roles: RoleDef[], companyId: string, modules: Record<string,boolean>, packageModules: readonly string[] | undefined, packageActive: boolean): Audience[] {
  const enabled = (rule: ModuleRule) => modules[rule.module] === true && (!rule.packageIds || (packageActive && !!packageModules && rule.packageIds.some(id => packageModules.includes(id))))
  const activeRules = RULES.filter(enabled)
  const moduleEnabled = (id: string) => activeRules.some(r => r.module === id)
  const result: Audience[] = []
  if (moduleEnabled('educationManagement')) result.push({id:'audience_student',name:'Student'}, {id:'audience_parent',name:'Parent / Guardian'})
  if (moduleEnabled('churchManagement')) result.push({id:'audience_congregation',name:'Congregation'})
  for (const role of roles) {
    if (!role.builtin && role.companyId && role.companyId !== companyId) continue
    const restrict = role.builtin && RESTRICTED_BUILTINS[role.id]
    if (restrict && !moduleEnabled(restrict)) continue
    // Broad built-in administrators remain available independently of industry.
    const isCore = !!role.builtin && CORE.has(role.id)
    const matches = role.permissions.some(p => activeRules.some(r => r.prefixes.some(prefix => p.startsWith(prefix))))
    const corePermission = role.permissions.some(p => p === 'notifications.manage' || p === 'users.manage' || p === 'roles.manage')
    if (isCore || matches || corePermission) result.push({id:role.id,name:role.name})
  }
  return result.filter((item, index) => result.findIndex(x => x.id === item.id) === index)
}
