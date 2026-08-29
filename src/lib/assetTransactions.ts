import type { AssetTransaction, AssetTransactionType } from '../types'

export const ASSET_TRANSACTIONS_KEY = 'fitpro_asset_transactions'

export const ASSET_TRANSACTION_TYPES: { id: AssetTransactionType; label: string }[] = [
  { id: 'acquire', label: 'Acquired' },
  { id: 'assign', label: 'Assigned' },
  { id: 'transfer', label: 'Transferred' },
  { id: 'maintenance', label: 'Sent to maintenance' },
  { id: 'return', label: 'Returned from maintenance' },
  { id: 'dispose', label: 'Disposed' },
]

export const ASSET_TRANSACTIONS: AssetTransaction[] = [
  {
    id: 'atx_1', assetId: 'ast_1', type: 'acquire', date: '2024-02-10',
    to: 'Accra — Airport City', amount: 28000, performedBy: 'Yaw Boateng',
    notes: 'Initial purchase', createdAt: '2024-02-10T09:00:00',
  },
  {
    id: 'atx_2', assetId: 'ast_1', type: 'assign', date: '2024-02-15',
    from: '—', to: 'Kofi Mensah', performedBy: 'Yaw Boateng',
    notes: 'Assigned to head trainer', createdAt: '2024-02-15T10:00:00',
  },
  {
    id: 'atx_3', assetId: 'ast_5', type: 'maintenance', date: '2026-07-20',
    from: 'Takoradi — Beach Rd', to: 'LG Service Centre', amount: 850,
    performedBy: 'Ama Owusu', notes: 'Compressor service', createdAt: '2026-07-20T09:00:00',
  },
  {
    id: 'atx_4', assetId: 'ast_3', type: 'transfer', date: '2025-11-02',
    from: 'Accra — Airport City', to: 'Tema — Community 1', performedBy: 'Yaw Boateng',
    notes: 'Moved to new strength zone', createdAt: '2025-11-02T14:00:00',
  },
  {
    id: 'atx_5', assetId: 'ast_4', type: 'return', date: '2026-05-12',
    from: 'Repair workshop', to: 'Kumasi — Adum', amount: 300,
    performedBy: 'Ama Owusu', notes: 'Re-gripped and returned', createdAt: '2026-05-12T11:00:00',
  },
]

export function loadAssetTransactions(): AssetTransaction[] {
  try {
    const raw = localStorage.getItem(ASSET_TRANSACTIONS_KEY)
    if (raw) return JSON.parse(raw) as AssetTransaction[]
  } catch { /* ignore */ }
  return ASSET_TRANSACTIONS
}

export function saveAssetTransactions(list: AssetTransaction[]) {
  try { localStorage.setItem(ASSET_TRANSACTIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
