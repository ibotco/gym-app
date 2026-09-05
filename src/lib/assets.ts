import type { Asset, AssetStatus, DepreciationMethod } from '../types'

export const ASSETS_KEY = 'fitpro_assets'

export const ASSET_STATUSES: { id: AssetStatus; label: string }[] = [
  { id: 'in_use', label: 'In use' },
  { id: 'available', label: 'Available' },
  { id: 'maintenance', label: 'In maintenance' },
  { id: 'retired', label: 'Retired' },
]

export const ASSETS: Asset[] = [
  {
    id: 'ast_1', tag: 'AST-0001', name: 'Treadmill — Life Fitness T3', category: 'Cardio equipment',
    serialNumber: 'LF-T3-10482', status: 'in_use', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Kofi Mensah', purchaseDate: '2024-02-10', purchaseCost: 28000, currentValue: 19600,
    salvageValue: 2800, depreciationStart: '2024-02-10', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2027-02-10', createdAt: '2024-02-10T09:00:00', updatedAt: '2024-02-10T09:00:00',
  },
  {
    id: 'ast_2', tag: 'AST-0002', name: 'Spin Bike — Keiser M3i', category: 'Cardio equipment',
    serialNumber: 'KS-M3I-2201', status: 'in_use', condition: 'Excellent', location: 'Accra — Airport City',
    assignedTo: 'Ama Owusu', purchaseDate: '2024-06-18', purchaseCost: 18500, currentValue: 14800,
    salvageValue: 1850, depreciationStart: '2024-06-18', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2026-06-18', createdAt: '2024-06-18T10:00:00', updatedAt: '2024-06-18T10:00:00',
  },
  {
    id: 'ast_3', tag: 'AST-0003', name: 'Squat Rack — Rogue R-3', category: 'Strength equipment',
    serialNumber: 'RG-R3-99120', status: 'in_use', condition: 'Good', location: 'Tema — Community 1',
    purchaseDate: '2023-11-05', purchaseCost: 12000, currentValue: 8400,
    salvageValue: 1200, depreciationStart: '2023-11-05', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2028-11-05', createdAt: '2023-11-05T08:00:00', updatedAt: '2023-11-05T08:00:00',
  },
  {
    id: 'ast_4', tag: 'AST-0004', name: 'Dumbbell set 2.5–50 kg', category: 'Functional / free weights',
    status: 'available', condition: 'Fair', location: 'Kumasi — Adum',
    purchaseDate: '2022-08-22', purchaseCost: 9500, currentValue: 3800,
    salvageValue: 950, depreciationStart: '2022-08-22', depreciationMethod: 'reducing_balance', usefulLifeYears: 8,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2024-08-22', createdAt: '2022-08-22T11:00:00', updatedAt: '2022-08-22T11:00:00',
  },
  {
    id: 'ast_5', tag: 'AST-0005', name: 'Air conditioning unit — LG 2HP', category: 'Other',
    serialNumber: 'LG-AC-77551', status: 'maintenance', condition: 'Fair', location: 'Takoradi — Beach Rd',
    purchaseDate: '2023-04-12', purchaseCost: 6400, currentValue: 4160,
    salvageValue: 640, depreciationStart: '2023-04-12', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2025-04-12', notes: 'Compressor service scheduled.', createdAt: '2023-04-12T09:30:00', updatedAt: '2026-07-28T09:00:00',
  },
  {
    id: 'ast_6', tag: 'AST-0006', name: 'Reception POS terminal', category: 'IT & electronics',
    serialNumber: 'POS-778-DT', status: 'in_use', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Reception desk', purchaseDate: '2025-01-15', purchaseCost: 5200, currentValue: 4420,
    salvageValue: 520, depreciationStart: '2025-01-15', depreciationMethod: 'straight_line', usefulLifeYears: 4,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2027-01-15', createdAt: '2025-01-15T10:00:00', updatedAt: '2025-01-15T10:00:00',
  },
]

export function loadAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY)
    if (raw) return JSON.parse(raw) as Asset[]
  } catch { /* ignore */ }
  return ASSETS
}

export function saveAssets(list: Asset[]) {
  try { localStorage.setItem(ASSETS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

/** Suggest the next asset tag, e.g. AST-0007. */
export function nextAssetTag(list: Asset[]): string {
  let max = 0
  for (const a of list) {
    const m = /^AST-(\d+)$/i.exec(a.tag || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `AST-${String(max + 1).padStart(4, '0')}`
}

/** Straight-line depreciation to a residual value over `lifeYears`. */
export function depreciatedValue(cost: number, purchaseDate: string, lifeYears = 8, residualPercent = 20): number {
  const d = new Date(purchaseDate).getTime()
  if (!cost || !Number.isFinite(d)) return cost || 0
  const age = Math.max(0, (Date.now() - d) / (365.25 * 24 * 3600 * 1000))
  const residual = residualValue(cost, residualPercent)
  const loss = (cost - residual) * Math.min(1, age / lifeYears)
  return Math.round(cost - loss)
}

/** Residual (salvage) value — a percentage of cost. */
export function residualValue(cost: number, residualPercent = 20): number {
  return Math.round((cost || 0) * residualPercent / 100)
}

/**
 * Estimated current value from explicit per-asset depreciation parameters.
 * Returns null when the parameters are not complete enough to compute.
 */
export function estimatedCurrentValue(params: {
  cost: number
  startDate?: string
  lifeYears?: number
  salvage?: number
  method?: DepreciationMethod
}): number | null {
  const { cost, startDate, lifeYears, method } = params
  if (!cost || cost <= 0 || !lifeYears || lifeYears <= 0) return null
  const start = new Date(startDate || '').getTime()
  if (!Number.isFinite(start)) return null
  const age = Math.max(0, (Date.now() - start) / (365.25 * 24 * 3600 * 1000))
  const years = Math.min(age, lifeYears)
  const salvage = Math.min(Math.max(params.salvage || 0, 0), cost)
  if (method === 'reducing_balance') {
    const rate = 1 - Math.pow(salvage / cost, 1 / lifeYears)
    return Math.round(cost * Math.pow(1 - rate, years))
  }
  return Math.round(cost - ((cost - salvage) * years) / lifeYears)
}

/** Annual depreciation charge (straight-line over `lifeYears`). */
export function annualDepreciation(cost: number, lifeYears = 8, residualPercent = 20): number {
  return Math.round((cost - residualValue(cost, residualPercent)) / lifeYears)
}

/** Accumulated depreciation from purchase date to today. */
export function accumulatedDepreciation(cost: number, purchaseDate: string, lifeYears = 8, residualPercent = 20): number {
  if (!cost) return 0
  const d = new Date(purchaseDate).getTime()
  if (!Number.isFinite(d)) return 0
  const age = Math.max(0, (Date.now() - d) / (365.25 * 24 * 3600 * 1000))
  const depreciable = cost - residualValue(cost, residualPercent)
  return Math.round(depreciable * Math.min(1, age / lifeYears))
}

export interface DepreciationRow {
  year: number
  openingValue: number
  depreciation: number
  closingValue: number
}

/** Year-by-year straight-line depreciation schedule for an asset. */
export function depreciationSchedule(cost: number, purchaseDate: string, lifeYears = 8, residualPercent = 20): DepreciationRow[] {
  if (!cost) return []
  const start = new Date(purchaseDate)
  if (!Number.isFinite(start.getTime())) return []
  const residual = residualValue(cost, residualPercent)
  const depreciable = cost - residual
  const annual = Math.round(depreciable / lifeYears)
  const rows: DepreciationRow[] = []
  let opening = cost
  const startYear = start.getFullYear()
  for (let i = 0; i < lifeYears; i++) {
    const closing = Math.max(residual, opening - annual)
    rows.push({ year: startYear + i, openingValue: opening, depreciation: opening - closing, closingValue: closing })
    opening = closing
  }
  return rows
}


