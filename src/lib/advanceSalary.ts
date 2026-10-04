// Advance Salary data layer — seeded, deterministic, localStorage-backed.
import type { SalaryAdvance } from '../types'

export const ADVANCE_SALARY_KEY = 'fitpro_advance_salary_v1'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => iso(new Date())

export const addDays = (base: string, days: number) => {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

const T = todayIso()

export const SEED_SALARY_ADVANCES: SalaryAdvance[] = [
  { id: 'sa_1', staffUserId: 'u_staff', amount: 1500, reason: 'School fees — September term', date: addDays(T, -70), months: 3, recoveredMonths: 3, status: 'recovered', createdAt: addDays(T, -70) },
  { id: 'sa_2', staffUserId: 'u_trainer2', amount: 2400, reason: 'Emergency medical bill', date: addDays(T, -95), months: 4, recoveredMonths: 4, status: 'recovered', createdAt: addDays(T, -95) },
  { id: 'sa_3', staffUserId: 'u_trainer3', amount: 3000, reason: 'Rent advance — landlord request', date: addDays(T, -40), months: 3, recoveredMonths: 1, status: 'approved', createdAt: addDays(T, -40) },
  { id: 'sa_4', staffUserId: 'u_staff2', amount: 1200, reason: 'Car repair after accident', date: addDays(T, -25), months: 2, recoveredMonths: 1, status: 'approved', createdAt: addDays(T, -25) },
  { id: 'sa_5', staffUserId: 'u_trainer4', amount: 2000, reason: 'Family funeral expenses', date: addDays(T, -6), months: 4, recoveredMonths: 0, status: 'approved', createdAt: addDays(T, -6) },
  { id: 'sa_6', staffUserId: 'u_trainer', amount: 5000, reason: 'Coaching certification balance', date: addDays(T, -2), months: 5, recoveredMonths: 0, status: 'pending', createdAt: addDays(T, -2) },
  { id: 'sa_7', staffUserId: 'u_staff', amount: 800, reason: 'Phone replacement', date: addDays(T, -1), months: 2, recoveredMonths: 0, status: 'pending', createdAt: addDays(T, -1) },
  { id: 'sa_8', staffUserId: 'u_manager', amount: 10000, reason: 'Business investment', date: addDays(T, -15), months: 6, recoveredMonths: 0, status: 'rejected', createdAt: addDays(T, -15) },
]

export function loadSalaryAdvances(): SalaryAdvance[] {
  try {
    const raw = localStorage.getItem(ADVANCE_SALARY_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as SalaryAdvance[]
      if (Array.isArray(arr)) return arr
    }
  } catch { /* fall through */ }
  return SEED_SALARY_ADVANCES
}

export function saveSalaryAdvances(list: SalaryAdvance[]) {
  try { localStorage.setItem(ADVANCE_SALARY_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const monthlyDeduction = (a: SalaryAdvance) => Math.round((a.amount / Math.max(1, a.months)) * 100) / 100

export const outstandingOf = (a: SalaryAdvance) =>
  Math.round(a.amount * ((a.months - a.recoveredMonths) / Math.max(1, a.months)))

export const recoveredOf = (a: SalaryAdvance) => a.amount - outstandingOf(a)

export const ADV_STATUS_META: Record<SalaryAdvance['status'], { label: string; tone: 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' }> = {
  pending: { label: 'Pending', tone: 'sky' },
  approved: { label: 'Approved', tone: 'lime' },
  recovered: { label: 'Recovered', tone: 'violet' },
  rejected: { label: 'Rejected', tone: 'rose' },
}

export const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
