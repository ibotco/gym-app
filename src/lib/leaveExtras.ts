/**
 * Leave Management extensions — policies, balance ledger and approval rules.
 * Pure helpers + localStorage persistence, mirroring lib/leaveTypes.ts.
 */
import type { LeaveRequest, LeaveTypeDef } from '../types'

export const LEAVE_POLICIES_KEY = 'fitpro_leave_policies_v1'
export const LEAVE_TXNS_KEY = 'fitpro_leave_balance_txns_v1'
export const LEAVE_RULES_KEY = 'fitpro_leave_approval_rules_v1'

export interface LeavePolicy {
  id: string
  companyId?: string
  leaveTypeId: string
  /** Annual entitlement in days (falls back to the type's daysPerYear). */
  allocationDays?: number
  /** Max unused days that may roll into the next year. */
  carryOverMaxDays?: number
  /** Supporting document required above this many days. */
  requiresDocAboveDays?: number
  active: boolean
}

export interface BalanceTxn {
  id: string
  companyId?: string
  staffUserId: string
  leaveTypeId: string
  kind: 'accrual' | 'adjustment' | 'carryover' | 'deduction'
  /** Signed day count. */
  days: number
  date: string
  note?: string
  refId?: string
}

export interface LeaveApprovalRule {
  id: string
  companyId?: string
  name: string
  /** '' = applies to any leave type. */
  leaveTypeId: string
  /** Requests up to this many days match the rule. */
  maxDays: number
  /** Auto-approve matching requests without manual action. */
  autoApprove: boolean
  approverRoles: string[]
  active: boolean
  /** Lower wins when several rules match. */
  priority: number
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return seed
    return JSON.parse(raw) as T
  } catch { return seed }
}
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

export const loadLeavePolicies = (types: LeaveTypeDef[]): LeavePolicy[] =>
  load<LeavePolicy[]>(LEAVE_POLICIES_KEY, types.map((t) => ({ id: `lp_${t.id}`, leaveTypeId: t.id, allocationDays: t.daysPerYear, carryOverMaxDays: 5, requiresDocAboveDays: 3, active: true })))
export const saveLeavePolicies = (v: LeavePolicy[]) => save(LEAVE_POLICIES_KEY, v)

export const loadLeaveTxns = () => load<BalanceTxn[]>(LEAVE_TXNS_KEY, [])
export const saveLeaveTxns = (v: BalanceTxn[]) => save(LEAVE_TXNS_KEY, v)

export const SEED_LEAVE_RULES: LeaveApprovalRule[] = [
  { id: 'lr_auto', name: 'Auto-approve short leave', leaveTypeId: '', maxDays: 2, autoApprove: true, approverRoles: ['gym_manager'], active: true, priority: 1 },
  { id: 'lr_std', name: 'Standard manager approval', leaveTypeId: '', maxDays: 365, autoApprove: false, approverRoles: ['gym_manager', 'super_admin'], active: true, priority: 2 },
]
export const loadLeaveRules = () => load<LeaveApprovalRule[]>(LEAVE_RULES_KEY, SEED_LEAVE_RULES)
export const saveLeaveRules = (v: LeaveApprovalRule[]) => save(LEAVE_RULES_KEY, v)

// ---------------------------------------------------------------------------
// Pure leave math
// ---------------------------------------------------------------------------
/** Inclusive calendar days of a request (from..to). */
export function leaveDays(r: Pick<LeaveRequest, 'from' | 'to'>): number {
  const a = new Date(`${r.from}T00:00:00Z`).getTime()
  const b = new Date(`${r.to}T00:00:00Z`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

/** Approved days taken by a staff member on a type within a year. */
export function usedDays(leaves: LeaveRequest[], staffId: string, typeId: string, year: number): number {
  return leaves
    .filter((l) => l.staffUserId === staffId && l.type === typeId && l.status === 'approved' && Number(l.from.slice(0, 4)) === year)
    .reduce((n, l) => n + leaveDays(l), 0)
}

export interface BalanceLine {
  allocation: number
  adjustments: number
  used: number
  remaining: number
}

/**
 * Balance for one staff member / type / year:
 * allocation = explicit accrual transactions, else the policy allocation for the current year;
 * adjustments = adjustment + carryover + deduction transactions;
 * remaining = allocation + adjustments − used (approved requests).
 */
export function balanceLine(
  txns: BalanceTxn[],
  leaves: LeaveRequest[],
  policy: LeavePolicy | undefined,
  type: LeaveTypeDef,
  staffId: string,
  year: number,
  currentYear: number,
): BalanceLine {
  const mine = txns.filter((t) => t.staffUserId === staffId && t.leaveTypeId === type.id && Number(t.date.slice(0, 4)) === year)
  const accruals = mine.filter((t) => t.kind === 'accrual').reduce((n, t) => n + t.days, 0)
  const adjustments = mine.filter((t) => t.kind !== 'accrual').reduce((n, t) => n + t.days, 0)
  const allocation = accruals !== 0 ? accruals : (year === currentYear ? (policy?.allocationDays ?? type.daysPerYear ?? 0) : 0)
  const used = usedDays(leaves, staffId, type.id, year)
  return { allocation, adjustments, used, remaining: allocation + adjustments - used }
}

/** First active rule matching a request (lowest priority number), or undefined. */
export function ruleForRequest(rules: LeaveApprovalRule[], req: LeaveRequest, days: number): LeaveApprovalRule | undefined {
  return [...rules]
    .filter((r) => r.active && (r.leaveTypeId === '' || r.leaveTypeId === req.type) && days <= r.maxDays)
    .sort((a, b) => a.priority - b.priority)[0]
}
