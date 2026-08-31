import type { InventoryCategory, InventoryItem, StockTransaction, StockTransfer, StockAdjustment, StockCount, StockAlert, Supplier, Purchase, Sale, PurchaseOrder, PurchaseOrderStatus, PurchaseReturn, PurchaseReturnStatus, PurchasePayment } from '../types'

export const INVENTORY_KEY = 'fitpro_inventory'
export const SUPPLIERS_KEY = 'fitpro_suppliers'
export const STOCK_MOVEMENTS_KEY = 'fitpro_stock_movements'
export const CATEGORIES_KEY = 'fitpro_inventory_categories'

export const DEFAULT_INVENTORY_CATEGORIES: string[] = [
  'Supplements',
  'Beverages',
  'Snacks',
  'Apparel',
  'Equipment',
  'Recovery',
  'Other',
]

export const INVENTORY_UNITS = ['pcs', 'bottle', 'box', 'pack', 'kg', 'set'] as const

export const SUPPLIERS: Supplier[] = [
  { id: 'sup_1', companyId: 'co_fitpro', branchId: 'br_airport', name: 'GhanaFit Distributors', contact: 'Kwame Owusu', email: 'orders@ghanafit.gh', phone: '+233 24 555 8801', category: 'Supplements', userId: 'u_supplier' },
  { id: 'sup_2', companyId: 'co_fitpro', branchId: 'br_osu', name: 'Accra Sports Supply', contact: 'Ama Mensah', email: 'sales@accrasports.gh', phone: '+233 24 555 8802', category: 'Equipment' },
  { id: 'sup_3', companyId: 'co_fitpro', branchId: 'br_airport', name: 'PureWave Beverages', contact: 'Yaw Darko', email: 'hello@purewave.gh', phone: '+233 24 555 8803', category: 'Beverages' },
  { id: 'sup_4', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Recovery Lab GH', contact: 'Esi Quartey', email: 'support@recoverylab.gh', phone: '+233 24 555 8804', category: 'Recovery' },
]

export const INVENTORY: InventoryItem[] = [
  { id: 'inv_1', name: 'Whey Protein (2.27kg)', sku: 'SUP-WHEY-2.2', category: 'Supplements', quantity: 14, reorderPoint: 8, unit: 'pcs', costPrice: 520, sellPrice: 780, supplierId: 'sup_1', branchId: 'br_airport', createdAt: '2026-05-10', updatedAt: '2026-08-10' },
  { id: 'inv_2', name: 'Creatine Monohydrate (300g)', sku: 'SUP-CRE-300', category: 'Supplements', quantity: 6, reorderPoint: 10, unit: 'pcs', costPrice: 180, sellPrice: 260, supplierId: 'sup_1', branchId: 'br_airport', createdAt: '2026-05-10', updatedAt: '2026-08-12' },
  { id: 'inv_3', name: 'Pre-Workout (30 servings)', sku: 'SUP-PRE-30', category: 'Supplements', quantity: 22, reorderPoint: 12, unit: 'pcs', costPrice: 240, sellPrice: 340, supplierId: 'sup_1', branchId: 'br_airport', createdAt: '2026-06-02', updatedAt: '2026-08-01' },
  { id: 'inv_4', name: 'Electrolyte Drink 500ml', sku: 'BEV-ELY-500', category: 'Beverages', quantity: 48, reorderPoint: 30, unit: 'bottle', costPrice: 6, sellPrice: 12, supplierId: 'sup_3', branchId: 'br_airport', createdAt: '2026-04-18', updatedAt: '2026-08-13' },
  { id: 'inv_5', name: 'Still Water 750ml', sku: 'BEV-WTR-750', category: 'Beverages', quantity: 12, reorderPoint: 40, unit: 'bottle', costPrice: 2, sellPrice: 5, supplierId: 'sup_3', branchId: 'br_osu', createdAt: '2026-04-18', updatedAt: '2026-08-13' },
  { id: 'inv_6', name: 'Protein Bar (Chocolate)', sku: 'SNK-BAR-CHO', category: 'Snacks', quantity: 60, reorderPoint: 30, unit: 'pcs', costPrice: 14, sellPrice: 22, supplierId: 'sup_1', branchId: 'br_osu', createdAt: '2026-03-09', updatedAt: '2026-08-11' },
  { id: 'inv_7', name: 'FitPro Training Tee (L)', sku: 'APP-TEE-L', category: 'Apparel', quantity: 18, reorderPoint: 10, unit: 'pcs', costPrice: 60, sellPrice: 120, supplierId: 'sup_2', branchId: 'br_airport', createdAt: '2026-02-20', updatedAt: '2026-07-28' },
  { id: 'inv_8', name: 'Microfibre Gym Towel', sku: 'APP-TWL', category: 'Apparel', quantity: 4, reorderPoint: 12, unit: 'pcs', costPrice: 35, sellPrice: 65, supplierId: 'sup_2', branchId: 'br_airport', createdAt: '2026-02-20', updatedAt: '2026-08-12' },
  { id: 'inv_9', name: 'Resistance Band Set', sku: 'EQP-BAND-SET', category: 'Equipment', quantity: 0, reorderPoint: 6, unit: 'set', costPrice: 90, sellPrice: 160, supplierId: 'sup_2', branchId: 'br_airport', createdAt: '2026-01-15', updatedAt: '2026-08-09' },
  { id: 'inv_10', name: 'Lifting Gloves (Pair)', sku: 'EQP-GLV-PR', category: 'Equipment', quantity: 9, reorderPoint: 8, unit: 'pcs', costPrice: 55, sellPrice: 95, supplierId: 'sup_2', branchId: 'br_osu', createdAt: '2026-01-15', updatedAt: '2026-07-30' },
  { id: 'inv_11', name: 'Foam Roller (60cm)', sku: 'REC-FR-60', category: 'Recovery', quantity: 11, reorderPoint: 6, unit: 'pcs', costPrice: 110, sellPrice: 180, supplierId: 'sup_4', branchId: 'br_airport', createdAt: '2026-03-25', updatedAt: '2026-08-05' },
  { id: 'inv_12', name: 'Massage Ball', sku: 'REC-MB', category: 'Recovery', quantity: 25, reorderPoint: 10, unit: 'pcs', costPrice: 25, sellPrice: 45, supplierId: 'sup_4', branchId: 'br_airport', createdAt: '2026-03-25', updatedAt: '2026-08-08' },
]

export const STOCK_MOVEMENTS: StockTransaction[] = [
  { id: 'sm_1', itemId: 'inv_1', type: 'in', quantity: 20, reason: 'Monthly restock', userId: 'u_manager', createdAt: '2026-08-10T09:30:00' },
  { id: 'sm_2', itemId: 'inv_1', type: 'out', quantity: -6, reason: 'Retail sale', userId: 'u_staff', createdAt: '2026-08-11T14:20:00' },
  { id: 'sm_3', itemId: 'inv_5', type: 'out', quantity: -10, reason: 'Front desk sale', userId: 'u_staff', createdAt: '2026-08-12T11:05:00' },
  { id: 'sm_4', itemId: 'inv_9', type: 'out', quantity: -3, reason: 'Member purchase', userId: 'u_staff', createdAt: '2026-08-09T16:40:00' },
  { id: 'sm_5', itemId: 'inv_6', type: 'in', quantity: 40, reason: 'Supplier delivery', userId: 'u_manager', createdAt: '2026-08-11T08:15:00' },
  { id: 'sm_6', itemId: 'inv_2', type: 'adjust', quantity: -2, reason: 'Damaged stock', userId: 'u_manager', createdAt: '2026-08-12T10:00:00' },
]

export function loadInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    if (raw) return JSON.parse(raw) as InventoryItem[]
  } catch { /* ignore */ }
  return INVENTORY
}

export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return [...DEFAULT_INVENTORY_CATEGORIES]
}

export function saveCategories(list: string[]) {
  try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function saveInventory(list: InventoryItem[]) {
  try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Supplier[]
      const byId = new Map(saved.map((supplier) => [supplier.id, supplier]))
      const merged = SUPPLIERS.map((supplier) => ({ ...supplier, ...(byId.get(supplier.id) || {}) }))
      for (const supplier of saved) {
        if (!SUPPLIERS.some((seed) => seed.id === supplier.id)) merged.push(supplier)
      }
      return merged
    }
  } catch { /* ignore */ }
  return SUPPLIERS
}

export function saveSuppliers(list: Supplier[]) {
  try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadStockMovements(): StockTransaction[] {
  try {
    const raw = localStorage.getItem(STOCK_MOVEMENTS_KEY)
    if (raw) return JSON.parse(raw) as StockTransaction[]
  } catch { /* ignore */ }
  return STOCK_MOVEMENTS
}

export function saveStockMovements(list: StockTransaction[]) {
  try { localStorage.setItem(STOCK_MOVEMENTS_KEY, JSON.stringify(list.slice(0, 500))) } catch { /* ignore */ }
}

/** Stock health for an item. */
export function stockStatus(item: InventoryItem): 'out' | 'low' | 'ok' {
  if (item.quantity <= 0) return 'out'
  if (item.quantity <= item.reorderPoint) return 'low'
  return 'ok'
}

/** Next SKU for a new item. */
export function nextSku(items: InventoryItem[]): string {
  return `SKU-${String(items.length + 1).padStart(4, '0')}`
}

export const PURCHASES_KEY = 'fitpro_purchases'
export const SALES_KEY = 'fitpro_sales'

export const PURCHASES: Purchase[] = [
  {
    id: 'po_1', number: 'PO-2026-001', supplierId: 'sup_1', status: 'received', branchId: 'br_airport',
    lines: [
      { itemId: 'inv_1', quantity: 20, unitCost: 520 },
      { itemId: 'inv_2', quantity: 16, unitCost: 180 },
    ],
    total: 20 * 520 + 16 * 180, notes: 'Monthly protein restock',
    userId: 'u_manager', date: '2026-08-10', createdAt: '2026-08-10T09:30:00',
  },
  {
    id: 'po_2', number: 'PO-2026-002', supplierId: 'sup_3', status: 'received', branchId: 'br_airport',
    lines: [{ itemId: 'inv_4', quantity: 48, unitCost: 6 }],
    total: 48 * 6, notes: 'Electrolyte drinks',
    userId: 'u_manager', date: '2026-08-11', createdAt: '2026-08-11T10:15:00',
  },
  {
    id: 'po_3', number: 'PO-2026-003', supplierId: 'sup_4', status: 'ordered', branchId: 'br_airport',
    lines: [{ itemId: 'inv_11', quantity: 12, unitCost: 110 }],
    total: 12 * 110, notes: 'Foam rollers — awaiting delivery',
    userId: 'u_manager', date: '2026-08-13', createdAt: '2026-08-13T08:00:00',
  },
]

export const SALES: Sale[] = [
  {
    id: 'sa_1', number: 'SA-2026-001', memberId: 'mb_1', customerName: 'Ama Boateng', status: 'completed',
    lines: [
      { itemId: 'inv_6', quantity: 2, unitPrice: 22 },
      { itemId: 'inv_4', quantity: 1, unitPrice: 12 },
    ],
    total: 2 * 22 + 12, method: 'momo',
    userId: 'u_staff', date: '2026-08-11', createdAt: '2026-08-11T14:20:00',
  },
  {
    id: 'sa_2', number: 'SA-2026-002', customerName: 'Walk-in customer', status: 'completed',
    lines: [{ itemId: 'inv_5', quantity: 4, unitPrice: 5 }],
    total: 4 * 5, method: 'cash',
    userId: 'u_staff', date: '2026-08-12', createdAt: '2026-08-12T11:05:00',
  },
  {
    id: 'sa_3', number: 'SA-2026-003', memberId: 'mb_9', customerName: 'Maame Serwaa', status: 'completed',
    lines: [{ itemId: 'inv_1', quantity: 1, unitPrice: 780 }],
    total: 780, method: 'card',
    userId: 'u_staff', date: '2026-08-12', createdAt: '2026-08-12T16:40:00',
  },
]

export function loadPurchases(): Purchase[] {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY)
    if (raw) {
      return (JSON.parse(raw) as Purchase[]).map((p) => ({
        ...p,
        date: p.date || p.createdAt.slice(0, 10),
      }))
    }
  } catch { /* ignore */ }
  return PURCHASES
}

export function savePurchases(list: Purchase[]) {
  try { localStorage.setItem(PURCHASES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadSales(): Sale[] {
  try {
    const raw = localStorage.getItem(SALES_KEY)
    if (raw) {
      return (JSON.parse(raw) as Sale[]).map((s) => ({
        ...s,
        date: s.date || s.createdAt.slice(0, 10),
      }))
    }
  } catch { /* ignore */ }
  return SALES
}

export function saveSales(list: Sale[]) {
  try { localStorage.setItem(SALES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function nextPurchaseNumber(list: Purchase[]): string {
  const year = new Date().getFullYear()
  return `PO-${year}-${String(list.length + 1).padStart(3, '0')}`
}

export function nextSaleNumber(list: Sale[]): string {
  const year = new Date().getFullYear()
  return `SA-${year}-${String(list.length + 1).padStart(3, '0')}`
}

export const PURCHASE_ORDERS_KEY = 'fitpro_purchase_orders'

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = ['draft', 'ordered', 'received', 'cancelled']

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'poo_1', number: 'POO-2026-001', supplierId: 'sup_1', status: 'ordered',
    lines: [
      { itemId: 'inv_1', quantity: 20, unitCost: 520 },
      { itemId: 'inv_2', quantity: 16, unitCost: 180 },
    ],
    total: 20 * 520 + 16 * 180, notes: 'Monthly protein restock order.',
    date: '2026-08-10', expectedDate: '2026-08-20', createdAt: '2026-08-10T09:00:00',
  },
  {
    id: 'poo_2', number: 'POO-2026-002', supplierId: 'sup_4', status: 'draft',
    lines: [{ itemId: 'inv_11', quantity: 12, unitCost: 110 }],
    total: 12 * 110, notes: 'Foam rollers — awaiting approval.',
    date: '2026-08-13', createdAt: '2026-08-13T10:30:00',
  },
]

export function loadPurchaseOrders(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(PURCHASE_ORDERS_KEY)
    if (raw) return JSON.parse(raw) as PurchaseOrder[]
  } catch { /* ignore */ }
  return PURCHASE_ORDERS
}

export function savePurchaseOrders(list: PurchaseOrder[]) {
  try { localStorage.setItem(PURCHASE_ORDERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function nextPurchaseOrderNumber(list: PurchaseOrder[]): string {
  const year = new Date().getFullYear()
  return `POO-${year}-${String(list.length + 1).padStart(3, '0')}`
}

export const PURCHASE_RETURNS_KEY = 'fitpro_purchase_returns'

export const PURCHASE_RETURN_STATUSES: PurchaseReturnStatus[] = ['draft', 'returned', 'refunded', 'cancelled']

export const PURCHASE_RETURNS: PurchaseReturn[] = [
  {
    id: 'pr_1', number: 'PR-2026-001', supplierId: 'sup_1', status: 'returned', branchId: 'br_airport',
    lines: [{ itemId: 'inv_2', quantity: 2, unitCost: 180 }],
    total: 2 * 180, reason: 'Expired batch — returned for credit.',
    date: '2026-08-12', createdAt: '2026-08-12T11:40:00',
  },
]

export function loadPurchaseReturns(): PurchaseReturn[] {
  try {
    const raw = localStorage.getItem(PURCHASE_RETURNS_KEY)
    if (raw) return JSON.parse(raw) as PurchaseReturn[]
  } catch { /* ignore */ }
  return PURCHASE_RETURNS
}

export function savePurchaseReturns(list: PurchaseReturn[]) {
  try { localStorage.setItem(PURCHASE_RETURNS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const PURCHASE_PAYMENTS_KEY = 'fitpro_purchase_payments'

export function loadPurchasePayments(): PurchasePayment[] {
  try {
    const raw = localStorage.getItem(PURCHASE_PAYMENTS_KEY)
    if (raw) return JSON.parse(raw) as PurchasePayment[]
  } catch { /* ignore */ }
  return []
}

export function savePurchasePayments(list: PurchasePayment[]) {
  try { localStorage.setItem(PURCHASE_PAYMENTS_KEY, JSON.stringify(list.slice(0, 500))) } catch { /* ignore */ }
}

/** Next payment reference, e.g. PP-2026-0001. */
export function nextPurchasePaymentNumber(list: PurchasePayment[]): string {
  const year = new Date().getFullYear()
  return `PP-${year}-${String(list.length + 1).padStart(4, '0')}`
}

export function nextPurchaseReturnNumber(list: PurchaseReturn[]): string {
  const year = new Date().getFullYear()
  return `PR-${year}-${String(list.length + 1).padStart(3, '0')}`
}

export const STOCK_TRANSFERS_KEY = 'fitpro_stock_transfers'
export const STOCK_ADJUSTMENTS_KEY = 'fitpro_stock_adjustments'
export const STOCK_ALERTS_KEY = 'fitpro_stock_alerts'

export const STOCK_TRANSFERS: StockTransfer[] = [
  {
    id: 'st_1',
    companyId: 'co_fitpro',
    fromBranchId: 'br_airport',
    toBranchId: 'br_osu',
    date: '2026-08-27',
    referenceNo: 'ST2026/0001',
    from: 'Airport City Flagship',
    to: 'Osu Oxford',
    status: 'Pending',
    shippingCharges: 20,
    totalAmount: 920,
    notes: '',
    createdAt: '2026-08-27T09:00:00',
  },
]

export const STOCK_ADJUSTMENTS: StockAdjustment[] = [
  {
    id: 'sad_1',
    companyId: 'co_fitpro',
    branchId: 'br_airport',
    date: '2026-08-27T19:52',
    referenceNo: '92993',
    location: 'Airport City Flagship',
    adjustmentType: 'Normal',
    totalAmount: 900,
    totalAmountRecovered: 0,
    reason: 'Replace Lost',
    addedBy: 'Rev. Isaac Botchwey',
    createdAt: '2026-08-27T19:52:00',
  },
]

export const STOCK_COUNTS_KEY = 'fitpro_stock_counts'

export const STOCK_COUNTS: StockCount[] = [
  {
    id: 'sco_1',
    companyId: 'co_fitpro',
    branchId: 'br_airport',
    date: '2026-08-26T18:20',
    referenceNo: 'SC2026/0001',
    location: 'Airport City Flagship',
    lines: [
      { itemId: 'inv_1', name: 'Whey Protein (2.27kg)', systemQty: 14, countedQty: 13, unitPrice: 780 },
    ],
    varianceValue: -780,
    notes: 'Monthly stocktake — one tub unaccounted for',
    addedBy: 'Rev. Isaac Botchwey',
    createdAt: '2026-08-26T18:20:00',
  },
]

export const STOCK_ALERTS: StockAlert[] = INVENTORY
  .filter((item) => item.quantity <= item.reorderPoint)
  .map((item) => ({
    id: `alert_${item.id}`,
    companyId: item.companyId || 'co_fitpro',
    branchId: item.branchId,
    itemId: item.id,
    productName: item.name,
    sku: item.sku,
    location: item.branchId || '',
    currentStock: item.quantity,
    alertQuantity: item.reorderPoint,
    unit: item.unit,
    status: item.quantity <= 0 ? 'Out of stock' : 'Low stock',
    active: true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

function loadInventoryArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as T[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return fallback
}

export const loadStockTransfers = () => loadInventoryArray<StockTransfer>(STOCK_TRANSFERS_KEY, STOCK_TRANSFERS)
export const saveStockTransfers = (list: StockTransfer[]) => {
  try { localStorage.setItem(STOCK_TRANSFERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
export const loadStockAdjustments = () => loadInventoryArray<StockAdjustment>(STOCK_ADJUSTMENTS_KEY, STOCK_ADJUSTMENTS)
export const saveStockAdjustments = (list: StockAdjustment[]) => {
  try { localStorage.setItem(STOCK_ADJUSTMENTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
export const loadStockCounts = () => loadInventoryArray<StockCount>(STOCK_COUNTS_KEY, STOCK_COUNTS)
export const saveStockCounts = (list: StockCount[]) => {
  try { localStorage.setItem(STOCK_COUNTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
export const loadStockAlerts = () => loadInventoryArray<StockAlert>(STOCK_ALERTS_KEY, STOCK_ALERTS)
export const saveStockAlerts = (list: StockAlert[]) => {
  try { localStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
