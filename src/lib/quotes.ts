import type { Proposal, Estimate, SalesOrder, DocStatus, OrderStatus } from '../types'

export const PROPOSALS_KEY = 'fitpro_proposals'
export const ESTIMATES_KEY = 'fitpro_estimates'
export const ORDERS_KEY = 'fitpro_sales_orders'

export const DOC_STATUSES: DocStatus[] = ['draft', 'sent', 'accepted', 'declined']
export const ORDER_STATUSES: OrderStatus[] = ['draft', 'confirmed', 'fulfilled', 'invoiced', 'cancelled']

export const PROPOSALS: Proposal[] = [
  {
    id: 'pp_1', number: 'PRO-2026-001', memberId: 'mb_2', customerName: 'Kofi Asante', status: 'sent',
    items: [
      { desc: 'Black Card VIP — annual membership', qty: 1, unitPrice: 4800, amount: 4800 },
      { desc: 'Weekly PT sessions (12)', qty: 12, unitPrice: 220, amount: 2640 },
    ],
    total: 7440, notes: 'Proposed upgrade for the upcoming year, inclusive of recovery suite.',
    date: '2026-08-05', validUntil: '2026-09-05', createdAt: '2026-08-05T10:00:00',
  },
  {
    id: 'pp_2', number: 'PRO-2026-002', customerName: 'Zenith Bank Wellness', status: 'draft',
    items: [
      { desc: 'Corporate wellness — 40 seats', qty: 40, unitPrice: 1800, amount: 72000 },
    ],
    total: 72000, notes: 'Quarterly corporate package. Awaiting sign-off.',
    date: '2026-08-10', createdAt: '2026-08-10T14:30:00',
  },
]

export const ESTIMATES: Estimate[] = [
  {
    id: 'es_1', number: 'EST-2026-001', customerName: 'Walk-in enquiry', status: 'sent',
    items: [
      { desc: 'Performance Quarterly membership', qty: 1, unitPrice: 720, amount: 720 },
      { desc: '2 PT sessions', qty: 2, unitPrice: 180, amount: 360 },
    ],
    total: 1080, notes: 'Estimate provided at the front desk.',
    date: '2026-08-12', validUntil: '2026-08-26', createdAt: '2026-08-12T09:15:00',
  },
]

export const SALES_ORDERS: SalesOrder[] = [
  {
    id: 'so_1', number: 'SO-2026-001', memberId: 'mb_1', customerName: 'Ama Boateng', status: 'confirmed',
    items: [
      { desc: 'Performance Quarterly renewal', qty: 1, unitPrice: 720, amount: 720 },
      { desc: 'Whey Protein (2.27kg)', qty: 1, unitPrice: 780, amount: 780 },
    ],
    total: 1500, notes: 'Confirmed at the front desk — ready for fulfilment.',
    date: '2026-08-14', expectedDate: '2026-08-18', createdAt: '2026-08-14T11:00:00',
  },
  {
    id: 'so_2', number: 'SO-2026-002', customerName: 'Walk-in customer', status: 'draft',
    items: [
      { desc: 'Resistance Band Set', qty: 2, unitPrice: 160, amount: 320 },
    ],
    total: 320, notes: 'Customer will pick up at Osu branch.',
    date: '2026-08-15', createdAt: '2026-08-15T16:20:00',
  },
]

export function loadProposals(): Proposal[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_KEY)
    if (raw) return JSON.parse(raw) as Proposal[]
  } catch { /* ignore */ }
  return PROPOSALS
}

export function saveProposals(list: Proposal[]) {
  try { localStorage.setItem(PROPOSALS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadEstimates(): Estimate[] {
  try {
    const raw = localStorage.getItem(ESTIMATES_KEY)
    if (raw) return JSON.parse(raw) as Estimate[]
  } catch { /* ignore */ }
  return ESTIMATES
}

export function saveEstimates(list: Estimate[]) {
  try { localStorage.setItem(ESTIMATES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadSalesOrders(): SalesOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    if (raw) return JSON.parse(raw) as SalesOrder[]
  } catch { /* ignore */ }
  return SALES_ORDERS
}

export function saveSalesOrders(list: SalesOrder[]) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function nextDocNumber(kind: 'PRO' | 'EST' | 'SO', count: number): string {
  const year = new Date().getFullYear()
  return `${kind}-${year}-${String(count + 1).padStart(3, '0')}`
}
