// Project Management — Contracts data layer. Tenant-scoped like other records.

import type { ContractStatus, ProjectContract } from '../types'

export const CONTRACTS_KEY = 'fitpro_contracts_v1'

/** Pipeline metadata — `card` for the summary buttons, `badge` for the table pill. */
export const CONTRACT_STATUSES: { id: ContractStatus; label: string; card: string; badge: string }[] = [
  { id: 'open',      label: 'Open',      card: '#17a2b8', badge: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'pending',   label: 'Pending',   card: '#a855f7', badge: 'bg-purple-50 text-purple-500 border-purple-200' },
  { id: 'declined',  label: 'Declined',  card: '#e91e63', badge: 'bg-pink-50 text-pink-500 border-pink-200' },
  { id: 'accepted',  label: 'Accepted',  card: '#f5a623', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'completed', label: 'Completed', card: '#2ecc71', badge: 'bg-green-50 text-green-600 border-green-200' },
]

export const contractStatusMeta = (id: ContractStatus) =>
  CONTRACT_STATUSES.find((s) => s.id === id) || CONTRACT_STATUSES[0]

/** Overdue when the end date has passed but the contract is not closed. */
export function isContractOverdue(c: ProjectContract, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (c.status === 'completed' || c.status === 'declined') return false
  return Boolean(c.endDate) && c.endDate < today
}

export const SEED_CONTRACTS: ProjectContract[] = [
  { id: 'ct_1', companyId: 'co_fitpro', branchId: 'br_airport', subject: 'Spinning Studio Build-Out Contract', clientName: 'Kaba Aniagdaga', projectId: 'pr_1', projectName: 'Spinning Studio Build-Out', value: 120000, startDate: '2026-06-01', endDate: '2026-12-31', status: 'open' },
  { id: 'ct_2', companyId: 'co_fitpro', branchId: 'br_osu', subject: 'Osu Sauna & Steam Supply Agreement', clientName: 'Isaac Kojo Botchwey', projectId: 'pr_2', projectName: 'Osu Sauna & Steam Install', value: 85000, startDate: '2026-07-01', endDate: '2027-01-31', status: 'open' },
  { id: 'ct_3', companyId: 'co_fitpro', branchId: 'br_legon', subject: 'Legon Free-Weights Refit Contract', clientName: 'Isaac Kojo Botchwey', projectId: 'pr_4', projectName: 'Legon Free-Weights Refit', value: 64000, startDate: '2025-05-18', endDate: '2025-05-18', status: 'pending' },
  { id: 'ct_4', companyId: 'co_fitpro', branchId: 'br_tema', subject: 'Tema Community Outreach Gym Contract', clientName: 'Kaba Aniagdaga', projectId: 'pr_5', projectName: 'Tema Community Outreach Gym', value: 98000, startDate: '2026-08-01', endDate: '2027-02-28', status: 'pending' },
  { id: 'ct_5', companyId: 'co_fitpro', subject: 'Member App Development Contract', clientName: 'Isaac Kojo Botchwey', projectId: 'pr_3', projectName: 'Member App Launch', value: 150000, startDate: '2026-05-01', endDate: '2026-10-31', status: 'declined' },
  { id: 'ct_6', companyId: 'co_fitpro', branchId: 'br_legon', subject: 'East Legon Yoga Deck Contract', clientName: 'Kaba Aniagdaga', projectId: 'pr_6', projectName: 'East Legon Yoga Deck', value: 45000, startDate: '2026-02-01', endDate: '2026-06-30', status: 'accepted' },
  { id: 'ct_7', companyId: 'co_fitpro', subject: 'Reception & CRM Revamp Contract', clientName: 'Kaba Aniagdaga', projectId: 'pr_7', projectName: 'Reception & CRM Revamp', value: 72000, startDate: '2026-03-01', endDate: '2026-09-30', status: 'accepted' },
  { id: 'ct_8', companyId: 'co_fitpro', branchId: 'br_airport', subject: 'Airport Annex HVAC Upgrade Contract', clientName: 'Isaac Kojo Botchwey', projectId: 'pr_8', projectName: 'Airport Annex HVAC Upgrade', value: 110000, startDate: '2026-01-10', endDate: '2026-05-30', status: 'completed' },
]

export function loadContracts(): ProjectContract[] {
  try {
    const raw = localStorage.getItem(CONTRACTS_KEY)
    if (raw) return JSON.parse(raw) as ProjectContract[]
  } catch { /* ignore */ }
  return SEED_CONTRACTS.map((c) => ({ ...c }))
}

export function saveContracts(list: ProjectContract[]) {
  try { localStorage.setItem(CONTRACTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export type ContractCounts = Record<string, number> & { overdue: number }

export function contractCounts(list: ProjectContract[]): ContractCounts {
  const counts = { overdue: 0 } as ContractCounts
  for (const s of CONTRACT_STATUSES) counts[s.id] = 0
  for (const c of list) {
    counts[c.status] = (counts[c.status] || 0) + 1
    if (isContractOverdue(c)) counts.overdue += 1
  }
  return counts
}
