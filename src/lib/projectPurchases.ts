import type { ProjectPurchase } from '../types'

export const PURCHASES_KEY = 'fitpro_project_purchases'

export const PROJECT_PURCHASES: ProjectPurchase[] = [
  {
    id: 'pp_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    item: 'Rubber floor tiles (120 m2)', supplier: 'Accra Build Supplies', qty: 120, cost: 18400,
    status: 'received', purchasedBy: 'Kwesi Ampofo', date: '2026-07-14',
  },
  {
    id: 'pp_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    item: 'Rig rack + spotter arms', supplier: 'Tema Steel Works', qty: 1, cost: 9600,
    status: 'ordered', purchasedBy: 'Ekow Asante', date: '2026-08-18', notes: 'Delivery expected week 36.',
  },
]

export function loadProjectPurchases(): ProjectPurchase[] {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY)
    if (raw) return JSON.parse(raw) as ProjectPurchase[]
  } catch { /* ignore */ }
  return PROJECT_PURCHASES
}

export function saveProjectPurchases(list: ProjectPurchase[]) {
  try { localStorage.setItem(PURCHASES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
