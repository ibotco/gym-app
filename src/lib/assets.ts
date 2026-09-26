import type { Asset, AssetStatus, DepreciationMethod, DepreciationPolicy } from '../types'

export const ASSETS_KEY = 'fitpro_assets'

export const ASSET_STATUSES: { id: AssetStatus; label: string }[] = [
  { id: 'in_use', label: 'In use' },
  { id: 'available', label: 'Available' },
  { id: 'maintenance', label: 'In maintenance' },
  { id: 'retired', label: 'Retired' },
  { id: 'disposed', label: 'Disposed' },
  { id: 'written_off', label: 'Written off' },
]

export const ASSETS: Asset[] = [
  {
    id: 'ast_1', tag: 'AST-0001', name: 'Treadmill — Life Fitness T3', category: 'Cardio equipment',
    serialNumber: 'LF-T3-10482', status: 'in_use', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Kofi Mensah', purchaseDate: '2024-02-10', purchaseCost: 28000, currentValue: 19600,
    salvageValue: 2800, depreciationStart: '2024-02-10', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2026-10-15', warrantyProvider: 'Life Fitness Ghana', createdAt: '2024-02-10T09:00:00', updatedAt: '2024-02-10T09:00:00',
  },
  {
    id: 'ast_2', tag: 'AST-0002', name: 'Spin Bike — Keiser M3i', category: 'Cardio equipment',
    serialNumber: 'KS-M3I-2201', status: 'disposed', condition: 'Excellent', location: 'Accra — Airport City',
    assignedTo: 'Ama Owusu', purchaseDate: '2024-06-18', purchaseCost: 18500, currentValue: 14800,
    salvageValue: 1850, depreciationStart: '2024-06-18', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2026-06-18', warrantyProvider: 'Kingson Equipment Ltd', createdAt: '2024-06-18T10:00:00', updatedAt: '2024-06-18T10:00:00',
  },
  {
    id: 'ast_3', tag: 'AST-0003', name: 'Squat Rack — Rogue R-3', category: 'Strength equipment',
    serialNumber: 'RG-R3-99120', status: 'in_use', condition: 'Good', location: 'Tema — Community 1',
    purchaseDate: '2023-11-05', purchaseCost: 12000, currentValue: 8400,
    salvageValue: 1200, depreciationStart: '2023-11-05', depreciationMethod: 'straight_line', usefulLifeYears: 5,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2028-11-05', warrantyProvider: 'Rogue Athletics EMEA', createdAt: '2023-11-05T08:00:00', updatedAt: '2023-11-05T08:00:00',
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
    serialNumber: 'POS-778-DT', status: 'written_off', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Reception desk', purchaseDate: '2025-01-15', purchaseCost: 5200, currentValue: 4420,
    salvageValue: 520, depreciationStart: '2025-01-15', depreciationMethod: 'straight_line', usefulLifeYears: 4,
    assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100', accumulatedDepreciationAccountId: 'ac_5',
    warrantyExpiry: '2027-01-15', createdAt: '2025-01-15T10:00:00', updatedAt: '2025-01-15T10:00:00',
  },
  {
    id: 'ast_7', tag: 'AST-0007', name: 'Logitech Wireless Mouse', category: 'Peripherals', assetType: 'accessory',
    serialNumber: 'M185', status: 'in_use', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Isaac Koji Botchwey', purchaseDate: '2025-07-16', purchaseCost: 250, qty: 3, checkedOut: 1,
    orderNumber: '0242507161', createdAt: '2025-07-16T09:00:00', updatedAt: '2025-07-16T09:00:00',
  },
  {
    id: 'ast_8', tag: 'AST-0008', name: 'USB-C Docking Station', category: 'Docking & hubs', assetType: 'accessory',
    serialNumber: 'D6000', status: 'in_use', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Kaba Aniadaga', purchaseDate: '2025-06-23', purchaseCost: 800, qty: 3, checkedOut: 1,
    orderNumber: '0246423357', createdAt: '2025-06-23T09:00:00', updatedAt: '2025-06-23T09:00:00',
  },
  {
    id: 'ast_9', tag: 'AST-0009', name: 'Treadmill Drive Belt', category: 'Spare parts', assetType: 'component',
    serialNumber: 'TB-330', status: 'available', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Ama Owusu', purchaseDate: '2025-03-11', purchaseCost: 450, qty: 5, checkedOut: 2,
    orderNumber: 'ORD-1103', createdAt: '2025-03-11T09:00:00', updatedAt: '2025-03-11T09:00:00',
  },
  {
    id: 'ast_10', tag: 'AST-0010', name: 'Spin Bike Brake Pad', category: 'Repair kits', assetType: 'component',
    serialNumber: 'BP-12', status: 'available', condition: 'Excellent', location: 'Accra — Airport City',
    assignedTo: 'Kofi Mensah', purchaseDate: '2025-01-29', purchaseCost: 180, qty: 8, checkedOut: 0,
    orderNumber: 'ORD-0129', createdAt: '2025-01-29T09:00:00', updatedAt: '2025-01-29T09:00:00',
  },
  {
    id: 'ast_11', tag: 'AST-0011', name: 'Cleaning Wipes (Box)', category: 'Cleaning supplies', assetType: 'consumable',
    serialNumber: 'CW-90', status: 'available', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Efua Hammond', purchaseDate: '2025-05-05', purchaseCost: 90, qty: 12, checkedOut: 3,
    orderNumber: 'ORD-0505', createdAt: '2025-05-05T09:00:00', updatedAt: '2025-05-05T09:00:00',
  },
  {
    id: 'ast_12', tag: 'AST-0012', name: 'Grip Tape Roll', category: 'Tape & grips', assetType: 'consumable',
    serialNumber: 'GT-5', status: 'available', condition: 'Good', location: 'Accra — Airport City',
    assignedTo: 'Yaw Darko', purchaseDate: '2025-02-14', purchaseCost: 60, qty: 10, checkedOut: 2,
    orderNumber: 'ORD-0214', createdAt: '2025-02-14T09:00:00', updatedAt: '2025-02-14T09:00:00',
  },
  {
    id: 'ast_13', tag: 'AST-0013', name: 'Microsoft Office 365 License', category: 'Subscriptions', assetType: 'license',
    serialNumber: 'E3', status: 'in_use', condition: 'Excellent', location: 'Head office',
    assignedTo: 'Abena Sarpong', purchaseDate: '2024-12-31', purchaseCost: 750, qty: 25, checkedOut: 20,
    orderNumber: 'LIC-0365', billingInterval: 'annually', renewalDate: '2026-12-31', autoRenew: true, createdAt: '2024-12-31T09:00:00', updatedAt: '2024-12-31T09:00:00',
  },
  {
    id: 'ast_14', tag: 'AST-0014', name: 'POS Software License', category: 'Software licenses', assetType: 'license',
    serialNumber: 'v5', status: 'in_use', condition: 'Good', location: 'Head office',
    assignedTo: 'Kwesi Appiah', purchaseDate: '2025-04-09', purchaseCost: 1200, qty: 4, checkedOut: 4,
    orderNumber: 'LIC-POS', billingInterval: 'annually', renewalDate: '2027-04-09', autoRenew: false, createdAt: '2025-04-09T09:00:00', updatedAt: '2025-04-09T09:00:00',
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

const MS_YEAR = 365.25 * 24 * 3600 * 1000

/** Salvage value of an asset: explicit override, else policy residual percent. */
export function salvageOf(a: Asset, policy: DepreciationPolicy): number {
  return a.salvageValue ?? residualValue(a.purchaseCost || 0, policy.residualPercent)
}

/**
 * Straight-line accumulated depreciation charged up to `asOfMs`, using the
 * asset's own parameters with policy fallbacks (same basis as the
 * Depreciation page). Used for disposal / write-off ledger entries.
 */
export function accumulatedDepreciationTo(a: Asset, policy: DepreciationPolicy, asOfMs: number): number {
  const cost = a.purchaseCost || 0
  const dep = cost - salvageOf(a, policy)
  const start = a.depreciationStart ?? a.purchaseDate ?? ''
  const t = new Date(start).getTime()
  const life = a.usefulLifeYears ?? policy.usefulLifeYears
  if (!Number.isFinite(t) || dep <= 0) return 0
  const age = Math.max(0, (asOfMs - t) / MS_YEAR)
  return Math.round(dep * Math.min(1, age / (life || 1)))
}

/** Net book value at `asOfMs` (never below salvage). */
export function netBookValueTo(a: Asset, policy: DepreciationPolicy, asOfMs: number): number {
  return Math.max(salvageOf(a, policy), (a.purchaseCost || 0) - accumulatedDepreciationTo(a, policy, asOfMs))
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
export function depreciationSchedule(cost: number, purchaseDate: string, lifeYears = 8, residualPercent = 20, method: DepreciationMethod = 'straight_line'): DepreciationRow[] {
  if (!cost) return []
  const start = new Date(purchaseDate)
  if (!Number.isFinite(start.getTime())) return []
  const residual = residualValue(cost, residualPercent)
  const depreciable = cost - residual
  const life = Math.max(1, lifeYears)
  const annual = Math.round(depreciable / life)
  const sumY = (life * (life + 1)) / 2
  const rbRate = 1 - Math.pow(residual / cost, 1 / life)
  const rows: DepreciationRow[] = []
  let opening = cost
  const startYear = start.getFullYear()
  for (let i = 0; i < life; i++) {
    const charge = method === 'sum_of_years'
      ? Math.round(depreciable * (life - i) / sumY)
      : method === 'reducing_balance'
        ? Math.round(opening * rbRate)
        : annual
    const closing = Math.max(residual, opening - charge)
    rows.push({ year: startYear + i, openingValue: opening, depreciation: opening - closing, closingValue: closing })
    opening = closing
  }
  return rows
}


