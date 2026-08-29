import type { DepreciationEntry, DepreciationMethod } from '../types'

export const DEPRECIATION_KEY = 'fitpro_depreciation'

export const DEPRECIATION_METHODS: { id: DepreciationMethod; label: string }[] = [
  { id: 'straight_line', label: 'Straight-line' },
  { id: 'reducing_balance', label: 'Reducing balance' },
  { id: 'manual', label: 'Manual adjustment' },
]

export const DEPRECIATION_ENTRIES: DepreciationEntry[] = [
  {
    id: 'dep_1', assetId: 'ast_1', amount: 1050, date: '2026-01-31', method: 'straight_line',
    notes: 'Monthly charge — Treadmill LF T3', createdAt: '2026-01-31T16:00:00',
  },
  {
    id: 'dep_2', assetId: 'ast_3', amount: 400, date: '2026-02-28', method: 'straight_line',
    notes: 'Monthly charge — Squat rack', createdAt: '2026-02-28T16:00:00',
  },
  {
    id: 'dep_3', assetId: 'ast_5', amount: 620, date: '2026-03-31', method: 'manual',
    notes: 'Impairment adjustment — AC unit', createdAt: '2026-03-31T16:00:00',
  },
]

export function loadDepreciation(): DepreciationEntry[] {
  try {
    const raw = localStorage.getItem(DEPRECIATION_KEY)
    if (raw) return JSON.parse(raw) as DepreciationEntry[]
  } catch { /* ignore */ }
  return DEPRECIATION_ENTRIES
}

export function saveDepreciation(list: DepreciationEntry[]) {
  try { localStorage.setItem(DEPRECIATION_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
