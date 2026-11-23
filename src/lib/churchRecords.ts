import { isCollectionMarkedCleared } from './dataReset'

export const CHURCH_RECORDS_KEY = 'fitpro_church_records_v1'

export type ChurchTabKey = 'congregation' | 'services' | 'giving' | 'ministries'

export interface ChurchRow {
  id: string
  name: string
  category: string
  phone?: string
  email?: string
  date?: string
  amount?: number
  status: string
  notes?: string
}

export type ChurchBranchRecords = Record<ChurchTabKey, ChurchRow[]>
type ChurchStoreMap = Record<string, ChurchBranchRecords>

export const DEFAULT_CHURCH_SEED: ChurchBranchRecords = {
  congregation: [
    { id: 'ch_m1', name: 'Elder Kwame Mensah', category: 'Mens Fellowship', phone: '+233 24 410 1101', email: 'kwame.mensah@church.gh', date: '2024-02-11', status: 'Active', notes: 'Choir patron & Airport cell leader' },
    { id: 'ch_m2', name: 'Deaconess Abena Osei', category: 'Womens Ministry', phone: '+233 24 410 1102', email: 'abena.osei@church.gh', date: '2024-05-19', status: 'Active', notes: 'Welfare committee chair' },
    { id: 'ch_m3', name: 'Yaw Boakye', category: 'Youth Ministry', phone: '+233 55 310 2204', email: 'yaw.boakye@church.gh', date: '2026-01-14', status: 'First-Timer', notes: 'Visited Sunday First Service' },
  ],
  services: [
    { id: 'ch_s1', name: 'Sunday Celebration Service', category: 'Main Service', date: '2026-11-15', amount: 340, status: 'Scheduled', notes: '08:30 AM · Main Sanctuary (Attendance target: 340)' },
    { id: 'ch_s2', name: 'Mid-Week Teaching & Prayer', category: 'Bible Study', date: '2026-11-18', amount: 145, status: 'Scheduled', notes: '06:00 PM · Fellowship Hall' },
  ],
  giving: [
    { id: 'ch_g1', name: 'Elder Kwame Mensah — Monthly Tithe', category: 'Tithe', date: '2026-11-01', amount: 1500, status: 'Posted', notes: 'Mobile Money receipt #MM-9081' },
    { id: 'ch_g2', name: 'Sunday First Service Offering', category: 'Offering', date: '2026-11-08', amount: 4850, status: 'Posted', notes: 'Counted & banked in Main Sanctuary Fund' },
    { id: 'ch_g3', name: 'Youth Building Project Seed', category: 'Building Fund', date: '2026-11-08', amount: 2200, status: 'Pledged', notes: 'Annual harvest pledge' },
  ],
  ministries: [
    { id: 'ch_g_1', name: 'Airport Hills Home Cell', category: 'Cell Group', phone: '+233 24 410 1101', date: 'Thursdays 6:30 PM', status: 'Active', notes: '22 members · Host: Mensah Residence' },
    { id: 'ch_g_2', name: 'Sanctuary Choir & Worship Team', category: 'Ministry', phone: '+233 24 410 1102', date: 'Saturdays 4:00 PM', status: 'Active', notes: '28 vocalists & instrumentalists' },
  ],
}

function readAll(): ChurchStoreMap {
  try {
    const raw = localStorage.getItem(CHURCH_RECORDS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ChurchStoreMap) : {}
  } catch {
    return {}
  }
}

const hasAnyChurchRows = (b?: Partial<ChurchBranchRecords>) =>
  Boolean(b) &&
  (['congregation', 'services', 'giving', 'ministries'] as const).some(
    (k) => Array.isArray(b?.[k]) && (b?.[k]?.length ?? 0) > 0,
  )

export function loadChurchRecords(branchId: string): ChurchBranchRecords {
  const key = branchId || 'br_airport'
  const all = readAll()
  if (isCollectionMarkedCleared('churchRecords')) {
    const cur = all[key]
    return {
      congregation: Array.isArray(cur?.congregation) ? cur.congregation : [],
      services: Array.isArray(cur?.services) ? cur.services : [],
      giving: Array.isArray(cur?.giving) ? cur.giving : [],
      ministries: Array.isArray(cur?.ministries) ? cur.ministries : [],
    }
  }
  if (all[key] && hasAnyChurchRows(all[key])) {
    return {
      congregation: Array.isArray(all[key].congregation) ? all[key].congregation : [],
      services: Array.isArray(all[key].services) ? all[key].services : [],
      giving: Array.isArray(all[key].giving) ? all[key].giving : [],
      ministries: Array.isArray(all[key].ministries) ? all[key].ministries : [],
    }
  }
  const seeded: ChurchBranchRecords = {
    congregation: DEFAULT_CHURCH_SEED.congregation.map((r) => ({ ...r })),
    services: DEFAULT_CHURCH_SEED.services.map((r) => ({ ...r })),
    giving: DEFAULT_CHURCH_SEED.giving.map((r) => ({ ...r })),
    ministries: DEFAULT_CHURCH_SEED.ministries.map((r) => ({ ...r })),
  }
  saveChurchRecords(key, seeded)
  return seeded
}

export function saveChurchRecords(branchId: string, records: ChurchBranchRecords): void {
  const key = branchId || 'br_airport'
  const all = readAll()
  all[key] = records
  try {
    localStorage.setItem(CHURCH_RECORDS_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}
