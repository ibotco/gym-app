import type { Branch, Company, User } from '../types'
import { DEFAULT_COMPANY_ID } from './companies'
import { loadRoles } from './permissions'

/** The organisation boundary used when deciding what an admin can see. */
export type OrgAccessLevel = 'global' | 'company' | 'branch' | 'none'

/** Roles pinned to a single branch. */
export const BRANCH_SCOPED_ROLES = ['branch_admin', 'staff', 'trainer', 'member', 'supplier', 'customer'] as const

/** Roles that span every branch inside their own company — but no other company. */
export const COMPANY_SCOPED_ROLES = ['company_admin', 'head_office', 'gym_manager', 'receptionist', 'accountant'] as const

/**
 * Every role the platform ships with. Anything outside this list is a custom
 * role and is scoped by its own definition instead.
 */
export const BUILTIN_SCOPED_ROLES = [
  ...BRANCH_SCOPED_ROLES,
  ...COMPANY_SCOPED_ROLES,
  'super_admin',
] as const

export function isBuiltinRole(role: string | undefined): boolean {
  return Boolean(role && (BUILTIN_SCOPED_ROLES as readonly string[]).includes(role))
}

export function userCompanyId(user: User | null | undefined, branches: Branch[]): string {
  if (user?.companyId) return user.companyId
  const assignedBranch = branches.find((branch) => branch.id === user?.branchId)
  return assignedBranch?.companyId || DEFAULT_COMPANY_ID
}

/**
 * The company a user is actually assigned to, or `undefined` when they have no
 * assignment at all. Unlike `userCompanyId` this does NOT fall back to the
 * default company — callers use it to fail closed so an unassigned user sees no
 * tenant data instead of silently inheriting the default company's.
 */
export function assignedCompanyId(user: User | null | undefined, branches: Branch[]): string | undefined {
  if (!user) return undefined
  if (user.companyId) return user.companyId
  const assignedBranch = branches.find((branch) => branch.id === user.branchId)
  // A branch that predates multi-company belongs to the default company; no
  // branch at all means no assignment, which must stay undefined (fail closed).
  if (!assignedBranch) return undefined
  return assignedBranch.companyId || DEFAULT_COMPANY_ID
}

function customRoleFor(user: User | null | undefined) {
  if (!user || isBuiltinRole(user.role)) return undefined
  const definition = loadRoles().find((role) => role.id === user.role)
  return definition && !definition.builtin ? definition : undefined
}

/**
 * The organisation boundary a user operates inside.
 *
 * Only `super_admin` is ever `'global'`. Every other role resolves to a
 * company or a branch, and unknown roles fail closed rather than widening:
 * a role we cannot classify is treated as the tightest scope the user's own
 * assignment supports.
 */
export function accessLevel(user: User | null | undefined): OrgAccessLevel {
  if (!user) return 'none'
  if (user.role === 'super_admin') return 'global'
  if ((BRANCH_SCOPED_ROLES as readonly string[]).includes(user.role)) return 'branch'
  if ((COMPANY_SCOPED_ROLES as readonly string[]).includes(user.role)) return 'company'
  const customRole = customRoleFor(user)
  if (customRole) return customRole.portal === 'admin' ? 'company' : 'branch'
  // Unclassifiable role with no definition: pin to whatever the user was
  // assigned, never to every company.
  return user.branchId ? 'branch' : 'company'
}

export function visibleCompanies(user: User | null | undefined, companies: Company[], branches: Branch[]): Company[] {
  if (!user || user.role === 'super_admin') return companies
  const own = assignedCompanyId(user, branches)
  // Fail closed: an unassigned user has no company to show.
  if (!own) return []
  return companies.filter((company) => company.id === own)
}

export function visibleBranches(
  user: User | null | undefined,
  branches: Branch[],
  activeCompanyId?: string,
): Branch[] {
  if (!user) return []
  const level = accessLevel(user)
  if (level === 'branch') return branches.filter((branch) => branch.id === user.branchId)
  if (level === 'company') {
    const own = assignedCompanyId(user, branches)
    if (!own) return []
    return branches.filter((branch) => (branch.companyId || DEFAULT_COMPANY_ID) === own)
  }
  // Only `super_admin` reaches here. The active-company selector narrows the
  // list for convenience but is never a restriction on their access.
  if (activeCompanyId) {
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
  // `none` is the signed-out/public case, which sees no tenant data anyway.
  if (level === 'global') return true
  if (level === 'none') return true
  const own = assignedCompanyId(user, branches)
  // Unassigned users fail closed: no company, no data.
  if (!own) return false
  return (companyId || DEFAULT_COMPANY_ID) === own
}

export function canAccessBranch(
  user: User | null | undefined,
  branchId: string | undefined,
  branches: Branch[],
  activeCompanyId?: string,
): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  const level = accessLevel(user)
  if (level === 'none') return false
  const own = assignedCompanyId(user, branches)
  if (!own) return false
  const branch = branches.find((candidate) => candidate.id === branchId)
  if (!branch) return false
  if ((branch.companyId || DEFAULT_COMPANY_ID) !== own) return false
  if (level === 'branch') return branchId === user.branchId
  return true
}

/**
 * Check a branch/company-owned record. Records without a branch remain visible
 * to company-level users for legacy compatibility, while branch-scoped users
 * only see records explicitly tied to their assigned branch.
 */
export function canAccessOrgRecord(
  user: User | null | undefined,
  record: { companyId?: string; branchId?: string },
  branches: Branch[],
): boolean {
  if (!user) return false
  const level = accessLevel(user)
  if (level === 'global') return true
  if (level === 'none') return true
  const own = assignedCompanyId(user, branches)
  if (!own) return false
  if ((record.companyId || DEFAULT_COMPANY_ID) !== own) return false
  if (level === 'branch') return Boolean(record.branchId && record.branchId === user.branchId)
  return true
}

/** Direct children of a branch. */
export function childBranches(branches: Branch[], parentId: string): Branch[] {
  return branches.filter((branch) => branch.parentId === parentId)
}

/** The branch plus every descendant — the "closure" used when scoping a parent. */
export function branchClosure(branches: Branch[], rootId: string): string[] {
  const out = [rootId]
  const stack = [rootId]
  while (stack.length) {
    const current = stack.pop()!
    for (const child of branches) {
      if (child.parentId === current && !out.includes(child.id)) {
        out.push(child.id)
        stack.push(child.id)
      }
    }
  }
  return out
}

/** Depth of a branch in the hierarchy (root = 0). Cycles count as 0. */
export function branchDepth(branches: Branch[], id: string): number {
  let depth = 0
  let current = branches.find((b) => b.id === id)
  const seen = new Set<string>([id])
  while (current?.parentId && !seen.has(current.parentId)) {
    depth += 1
    const parentId: string = current.parentId
    seen.add(parentId)
    current = branches.find((b) => b.id === parentId)
  }
  return depth
}

/** Branches in tree order (parents before children, siblings by name). */
export function branchesTreeOrder(branches: Branch[]): Branch[] {
  const byParent = new Map<string, Branch[]>()
  for (const b of branches) {
    const key = b.parentId && branches.some((x) => x.id === b.parentId) ? b.parentId : ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(b)
  }
  const out: Branch[] = []
  const walk = (parentId: string) => {
    for (const b of (byParent.get(parentId) || []).sort((a, b2) => a.name.localeCompare(b2.name))) {
      out.push(b)
      walk(b.id)
    }
  }
  walk('')
  return out
}
