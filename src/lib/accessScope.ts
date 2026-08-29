import type { Branch, Company, User } from '../types'
import { DEFAULT_COMPANY_ID } from './companies'
import { loadRoles } from './permissions'

/** The organisation boundary used when deciding what an admin can see. */
export type OrgAccessLevel = 'global' | 'company' | 'branch' | 'none'

export function userCompanyId(user: User | null | undefined, branches: Branch[]): string {
  if (user?.companyId) return user.companyId
  const assignedBranch = branches.find((branch) => branch.id === user?.branchId)
  return assignedBranch?.companyId || DEFAULT_COMPANY_ID
}

function customRoleFor(user: User | null | undefined) {
  if (!user || ['super_admin', 'gym_manager', 'company_admin', 'head_office', 'branch_admin', 'staff', 'trainer', 'member', 'supplier', 'customer', 'receptionist', 'accountant'].includes(user.role)) return undefined
  const definition = loadRoles().find((role) => role.id === user.role)
  return definition && !definition.builtin ? definition : undefined
}

export function accessLevel(user: User | null | undefined): OrgAccessLevel {
  if (!user) return 'none'
  if (user.role === 'super_admin') return 'global'
  if (user.role === 'branch_admin' || user.role === 'staff' || user.role === 'trainer' || user.role === 'member' || user.role === 'supplier' || user.role === 'customer') return 'branch'
  if (user.role === 'company_admin' || user.role === 'head_office') return 'company'
  const customRole = customRoleFor(user)
  if (customRole && (customRole.companyId || user?.companyId)) return customRole.portal === 'admin' ? 'company' : 'branch'
  return 'global'
}

export function visibleCompanies(user: User | null | undefined, companies: Company[], branches: Branch[]): Company[] {
  if (!user || user.role === 'super_admin') return companies
  const level = accessLevel(user)
  if (level !== 'company' && level !== 'branch') return companies
  const companyId = userCompanyId(user, branches)
  return companies.filter((company) => company.id === companyId)
}

export function visibleBranches(
  user: User | null | undefined,
  branches: Branch[],
  activeCompanyId?: string,
): Branch[] {
  if (!user) return []
  if (accessLevel(user) === 'branch') return branches.filter((branch) => branch.id === user.branchId)
  if (accessLevel(user) === 'company') {
    const companyId = userCompanyId(user, branches)
    return branches.filter((branch) => (branch.companyId || DEFAULT_COMPANY_ID) === companyId)
  }
  if (user.role === 'super_admin' && activeCompanyId) {
    return branches.filter((branch) => (branch.companyId || DEFAULT_COMPANY_ID) === activeCompanyId)
  }
  return branches
}

export function canAccessCompany(
  user: User | null | undefined,
  companyId: string | undefined,
  branches: Branch[],
): boolean {
  if (!user) return false
  const level = accessLevel(user)
  if (level === 'global' || level === 'none') return true
  return (companyId || DEFAULT_COMPANY_ID) === userCompanyId(user, branches)
}

export function canAccessBranch(
  user: User | null | undefined,
  branchId: string | undefined,
  branches: Branch[],
  activeCompanyId?: string,
): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (accessLevel(user) === 'branch') return Boolean(branchId && branchId === user.branchId)
  if (accessLevel(user) === 'company') {
    const branch = branches.find((candidate) => candidate.id === branchId)
    return Boolean(branch && (branch.companyId || DEFAULT_COMPANY_ID) === userCompanyId(user, branches))
  }
  if (activeCompanyId && branchId) {
    const branch = branches.find((candidate) => candidate.id === branchId)
    return Boolean(branch && (branch.companyId || DEFAULT_COMPANY_ID) === activeCompanyId)
  }
  return true
}

/**
 * Check a branch/company-owned record. Records without a branch remain visible
 * to company-level users for legacy compatibility, while branch admins only
 * see records explicitly tied to their assigned branch.
 */
export function canAccessOrgRecord(
  user: User | null | undefined,
  record: { companyId?: string; branchId?: string },
  branches: Branch[],
): boolean {
  if (!user) return false
  const level = accessLevel(user)
  if (level === 'global') return true
  if (!canAccessCompany(user, record.companyId, branches)) return false
  if (level === 'branch') return Boolean(record.branchId && record.branchId === user.branchId)
  return true
}
