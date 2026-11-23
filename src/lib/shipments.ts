import type { Shipment, ShipmentStatus } from '../types'

export const SHIPMENTS_KEY = 'fitpro_shipments'

export const SHIPMENT_STATUSES: ShipmentStatus[] = ['preparing', 'shipped', 'in_transit', 'delivered', 'cancelled']

export const SHIPMENTS: Shipment[] = [
  {
    id: 'sh_1', number: 'SH-2026-001', salesOrderId: 'so_1', memberId: 'mb_1', customerName: 'Ama Boateng',
    carrier: 'DHL Express', trackingNumber: 'DHL-9876-5432',
    items: [
      { desc: 'Performance Quarterly renewal', qty: 1, unitPrice: 720, amount: 720 },
      { desc: 'Whey Protein (2.27kg)', qty: 1, unitPrice: 780, amount: 780 },
    ],
    total: 1500, status: 'shipped', notes: 'Handled at Airport City branch.',
    date: '2026-08-16', deliveryDate: '2026-08-18', createdAt: '2026-08-16T09:30:00',
  },
  {
    id: 'sh_2', number: 'SH-2026-002', customerName: 'Walk-in customer',
    carrier: 'Local courier', trackingNumber: '',
    items: [{ desc: 'Resistance Band Set', qty: 2, unitPrice: 160, amount: 320 }],
    total: 320, status: 'preparing', notes: 'Pick-up at Osu branch.',
    date: '2026-08-17', createdAt: '2026-08-17T11:00:00',
  },
]

export function loadShipments(): Shipment[] {
  try {
    const raw = localStorage.getItem(SHIPMENTS_KEY)
    if (raw) return JSON.parse(raw) as Shipment[]
  } catch { /* ignore */ }
  return SHIPMENTS
}

export function saveShipments(list: Shipment[]) {
  try { localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function nextShipmentNumber(list: Shipment[]): string {
  const year = new Date().getFullYear()
  return `SH-${year}-${String(list.length + 1).padStart(3, '0')}`
}
