/**
 * Shared store for the Asset setup → Locations records.
 * The Asset Locations page owns the CRUD; other asset screens (e.g. Asset
 * Transactions) read from the same localStorage key so every form offers the
 * same canonical list of locations.
 */

export type LocationType = 'Building' | 'Floor' | 'Room' | 'Warehouse' | 'Site'

export type AssetLocationRec = {
  id: string
  name: string
  code: string
  type: LocationType
  parentId?: string
  status: 'active' | 'inactive'
}

export const ASSET_LOCATIONS_KEY = 'fitpro_asset_locations_v1'

export const LOCATION_TYPES: LocationType[] = ['Building', 'Floor', 'Room', 'Warehouse', 'Site']

export const ASSET_LOCATION_SEED: AssetLocationRec[] = [
  { id: 'loc_1', name: 'Main Office Building', code: 'MOB-001', type: 'Building', status: 'active' },
  { id: 'loc_2', name: 'Warehouse District A', code: 'WH-A-001', type: 'Warehouse', status: 'active' },
  { id: 'loc_3', name: 'Tech Campus Site', code: 'TECH-001', type: 'Site', status: 'active' },
  { id: 'loc_4', name: 'Floor 2 - Administration', code: 'FL2-ADM-001', type: 'Floor', parentId: 'loc_1', status: 'active' },
  { id: 'loc_5', name: 'Floor 3 - IT Department', code: 'FL3-IT-001', type: 'Floor', parentId: 'loc_1', status: 'active' },
  { id: 'loc_6', name: 'Conference Room A', code: 'CONF-A-001', type: 'Room', parentId: 'loc_4', status: 'active' },
  { id: 'loc_7', name: 'Server Room', code: 'SRV-001', type: 'Room', parentId: 'loc_5', status: 'active' },
  { id: 'loc_8', name: 'Warehouse District B', code: 'WH-B-001', type: 'Warehouse', status: 'active' },
  { id: 'loc_9', name: 'Production Floor', code: 'PROD-FL-001', type: 'Floor', parentId: 'loc_2', status: 'active' },
  { id: 'loc_10', name: 'Regional Office Dallas', code: 'REG-DAL-001', type: 'Building', status: 'active' },
]

export function loadAssetLocations(): AssetLocationRec[] {
  try {
    const raw = localStorage.getItem(ASSET_LOCATIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AssetLocationRec[]
    }
  } catch { /* fall through to seed */ }
  return ASSET_LOCATION_SEED
}

export function saveAssetLocations(list: AssetLocationRec[]) {
  try { localStorage.setItem(ASSET_LOCATIONS_KEY, JSON.stringify(list)) } catch { /* storage may be unavailable */ }
}

/** Full hierarchical label, e.g. "Main Office Building / Floor 2 - Administration / Conference Room A". */
export function assetLocationPath(l: AssetLocationRec, all: AssetLocationRec[]): string {
  const parts: string[] = [l.name]
  let cur = all.find((x) => x.id === l.parentId)
  let guard = 0
  while (cur && guard < 10) {
    parts.unshift(cur.name)
    const nextId = cur.parentId
    cur = all.find((x) => x.id === nextId)
    guard++
  }
  return parts.join(' / ')
}
