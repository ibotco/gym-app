import type { SalesReturn, SalesReturnStatus } from '../types'

export const SALES_RETURNS_KEY = 'fitpro_sales_returns'

export const SALES_RETURN_STATUSES: SalesReturnStatus[] = ['draft', 'returned', 'refunded', 'cancelled']

export const SALES_RETURNS: SalesReturn[] = [
  {
    id: 'sr_1', number: 'SR-2026-001', saleId: 'sa_1', memberId: 'mb_1', customerName: 'Ama Boateng',
    lines: [{ itemId: 'inv_6', quantity: 1, unitPrice: 22 }],
    total: 22, status: 'refunded', reason: 'Wrong flavour — refunded to MoMo.',
    date: '2026-08-13', createdAt: '2026-08-13T10:20:00',
  },
]

export function loadSalesReturns(): SalesReturn[] {
  try {
    const raw = localStorage.getItem(SALES_RETURNS_KEY)
    if (raw) return JSON.parse(raw) as SalesReturn[]
  } catch { /* ignore */ }
  return SALES_RETURNS
}

export function saveSalesReturns(list: SalesReturn[]) {
  try { localStorage.setItem(SALES_RETURNS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function nextSalesReturnNumber(list: SalesReturn[]): string {
  const year = new Date().getFullYear()
  return `SR-${year}-${String(list.length + 1).padStart(3, '0')}`
}
