// Purchase analytics engine — deterministic seeded procurement dataset +
// aggregation helpers powering the Purchase Reports module.

import { PRODUCTS, productDim, productName, iso, TODAY, type ProductDim } from './salesAnalytics'

export type POStatus = 'open' | 'closed' | 'pending' | 'partial'
export type ReqStatus = 'pending' | 'approved' | 'rejected'
export type InvStatus = 'paid' | 'unpaid' | 'overdue' | 'partial'
export type PayMethod = 'Bank Transfer' | 'Cash' | 'Cheque' | 'Mobile Money'

export interface SupplierDim { id: string; name: string; baseLead: number; reliability: number; preferred: boolean }
export interface PurLine { productId: string; qty: number; unitCost: number; receivedQty: number; returnedQty: number; returnReason: string | null }
export interface PurTxn {
  id: string
  reqId: string
  reqDate: string
  approvalDays: number
  reqStatus: ReqStatus
  date: string // PO date
  branch: string
  warehouse: string
  supplier: string
  buyer: string
  department: string
  method: PayMethod
  interBranch: boolean
  lines: PurLine[]
  listValue: number
  savings: number
  gross: number
  freight: number
  tax: number
  importDuty: number
  otherCharges: number
  landed: number
  poStatus: POStatus
  grn: boolean
  grnDate: string | null
  leadDays: number
  onTime: boolean
  qtyVariance: number
  invoiceStatus: InvStatus | null
  dueDate: string | null
  paid: number
  outstanding: number
  returned: boolean
  returnValue: number
  returnReason: string | null
}
export interface Requisition {
  id: string; date: string; department: string; employee: string; supplier: string
  status: ReqStatus; approvalDays: number; value: number; converted: boolean
}

export const BRANCHES = ['Osu Main', 'Airport City', 'Tema Comm 1', 'Kumasi Rd']
export const WAREHOUSES = ['Central WH', 'Osu WH', 'Tema WH', 'East WH']
export const DEPARTMENTS = ['Operations', 'Retail', 'Maintenance', 'Marketing', 'Administration']
export const BUYERS = ['Kofi Mensah', 'Ama Serwaa', 'Yaw Boateng', 'Efua Baidoo', 'Naa Quaye', 'Kwame Osei', 'Abena Mensah', 'Kojo Antwi']
export const PAY_METHODS: PayMethod[] = ['Bank Transfer', 'Cash', 'Cheque', 'Mobile Money']
export const RETURN_REASONS = ['Defective', 'Wrong item', 'Damaged in transit', 'Quality issue', 'Over-supply']

export const SUPPLIERS: SupplierDim[] = [
  { id: 'sup01', name: 'Accra Wholesale Ltd', baseLead: 4, reliability: 0.95, preferred: true },
  { id: 'sup02', name: 'Golden Gate Supplies', baseLead: 6, reliability: 0.9, preferred: true },
  { id: 'sup03', name: 'Kempinski Trading', baseLead: 8, reliability: 0.82, preferred: false },
  { id: 'sup04', name: 'NorthStar Distributors', baseLead: 5, reliability: 0.92, preferred: true },
  { id: 'sup05', name: 'Volta Industrial', baseLead: 10, reliability: 0.78, preferred: false },
  { id: 'sup06', name: 'Sahel Commodities', baseLead: 12, reliability: 0.72, preferred: false },
  { id: 'sup07', name: 'PrimeLine GH', baseLead: 4, reliability: 0.94, preferred: true },
  { id: 'sup08', name: 'EastWest Imports', baseLead: 14, reliability: 0.7, preferred: false },
  { id: 'sup09', name: 'GreenLeaf Naturals', baseLead: 6, reliability: 0.88, preferred: false },
  { id: 'sup10', name: 'SteelWorks GH', baseLead: 9, reliability: 0.8, preferred: false },
  { id: 'sup11', name: 'MediFit Supplies', baseLead: 5, reliability: 0.91, preferred: true },
  { id: 'sup12', name: 'Coastal Logistics', baseLead: 7, reliability: 0.85, preferred: false },
]
export const supplierDim = (name: string) => SUPPLIERS.find((s) => s.name === name)

// ---------------- seeded rng ----------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(987654321)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const chance = (p: number) => rnd() < p
const wpick = <T,>(pairs: [T, number][]): T => {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v }
  return pairs[pairs.length - 1][0]
}

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const addDays = (isoDate: string, n: number) => { const d = new Date(`${isoDate}T12:00:00`); d.setDate(d.getDate() + n); return iso(d) }
const BRANCH_WH: Record<string, string> = { 'Osu Main': 'Osu WH', 'Airport City': 'Central WH', 'Tema Comm 1': 'Tema WH', 'Kumasi Rd': 'East WH' }

// ---------------- dataset ----------------
function buildTxns(): PurTxn[] {
  const out: PurTxn[] = []
  let n = 0
  for (let back = 540; back >= 0; back--) {
    const date = daysAgo(back)
    const count = wpick([[1, 30], [2, 40], [3, 22], [4, 8]])
    for (let k = 0; k < count; k++) {
      n++
      const supplier = pick(SUPPLIERS)
      const branch = wpick([[BRANCHES[0], 34], [BRANCHES[1], 28], [BRANCHES[2], 22], [BRANCHES[3], 16]])
      const reqDate = addDays(date, -rint(1, 6))
      const approvalDays = rint(0, 4)
      const reqStatus: ReqStatus = chance(0.92) ? 'approved' : 'pending'
      const lineCount = rint(1, 4)
      const lines: PurLine[] = []
      let gross = 0, list = 0
      for (let li = 0; li < lineCount; li++) {
        const prod: ProductDim = pick(PRODUCTS)
        const qty = rint(5, 60)
        const unitCost = Math.round(prod.cost * (0.92 + rnd() * 0.16) * 100) / 100
        const recv = qty // adjusted below for partial/variance
        lines.push({ productId: prod.id, qty, unitCost, receivedQty: recv, returnedQty: 0, returnReason: null })
        gross += qty * unitCost
        list += qty * unitCost * 1.06
      }
      gross = Math.round(gross * 100) / 100
      list = Math.round(list * 100) / 100
      const savings = Math.round((list - gross) * 100) / 100
      const freight = chance(0.5) ? rint(40, 220) : 0
      const tax = chance(0.6) ? Math.round(gross * wpick([[0.08, 40], [0.12, 40], [0.15, 20]])) : 0
      const importDuty = supplier.name === 'EastWest Imports' && chance(0.8) ? Math.round(gross * 0.1) : 0
      const otherCharges = chance(0.25) ? rint(10, 80) : 0
      const landed = Math.round((gross + freight + tax + importDuty + otherCharges) * 100) / 100
      const poStatus: POStatus = wpick([['closed', 55], ['partial', 15], ['open', 15], ['pending', 15]])
      const leadDays = Math.max(1, supplier.baseLead + rint(-2, 4))
      const grn = poStatus === 'closed' || poStatus === 'partial' || (poStatus === 'open' && chance(0.3))
      const onTime = rnd() < supplier.reliability
      let qtyVariance = 0
      if (grn && chance(0.12)) qtyVariance = rint(1, 5) * (chance(0.5) ? 1 : -1)
      for (const l of lines) {
        if (!grn) l.receivedQty = 0
        else if (poStatus === 'partial') l.receivedQty = Math.max(0, Math.round(l.qty * (0.4 + rnd() * 0.4)))
        else l.receivedQty = Math.max(0, l.qty + (chance(0.12) ? qtyVariance : 0))
      }
      const grnDate = grn ? addDays(date, leadDays) : null
      const invoiceStatus: InvStatus | null = grn ? wpick([['paid', 55], ['unpaid', 20], ['overdue', 15], ['partial', 10]]) : null
      const dueDate = grnDate ? addDays(grnDate, 30) : null
      const paid = invoiceStatus === 'paid' ? landed : invoiceStatus === 'partial' ? Math.round(landed * 0.5) : 0
      const outstanding = Math.round((landed - paid) * 100) / 100
      const returned = grn && chance(0.04)
      const returnValue = returned ? Math.round(gross * (0.05 + rnd() * 0.15)) : 0
      const returnReason = returned ? pick(RETURN_REASONS) : null
      if (returned && lines.length) {
        const l = lines[0]
        l.returnedQty = Math.max(1, Math.round(l.qty * 0.1))
        l.returnReason = returnReason
      }
      out.push({
        id: `PO${String(n).padStart(5, '0')}`, reqId: `REQ${String(n).padStart(5, '0')}`, reqDate, approvalDays, reqStatus,
        date, branch, warehouse: BRANCH_WH[branch], supplier: supplier.name, buyer: pick(BUYERS),
        department: pick(DEPARTMENTS), method: wpick<PayMethod>([['Bank Transfer', 55], ['Mobile Money', 20], ['Cash', 15], ['Cheque', 10]]),
        interBranch: chance(0.12), lines, listValue: list, savings, gross, freight, tax, importDuty, otherCharges, landed,
        poStatus, grn, grnDate, leadDays, onTime, qtyVariance, invoiceStatus, dueDate, paid, outstanding,
        returned, returnValue, returnReason,
      })
    }
  }
  return out
}

function buildReqs(): Requisition[] {
  const out: Requisition[] = []
  for (let i = 0; i < 80; i++) {
    out.push({
      id: `REQX${String(i + 1).padStart(4, '0')}`, date: daysAgo(rint(0, 540)), department: pick(DEPARTMENTS),
      employee: pick(BUYERS), supplier: pick(SUPPLIERS).name,
      status: wpick([['approved', 52], ['pending', 26], ['rejected', 22]]),
      approvalDays: rint(0, 7), value: rint(500, 20000), converted: chance(0.5),
    })
  }
  return out
}

export const PTXNS: PurTxn[] = buildTxns()
export const REQS: Requisition[] = buildReqs()

// Inventory planning data (deterministic).
export interface StockInfo { productId: string; onHand: number; monthlyUsage: number; reorderPoint: number }
export const STOCK: StockInfo[] = PRODUCTS.map((p, i) => {
  const monthlyUsage = 20 + ((i * 37) % 100)
  const onHand = 15 + ((i * 53) % 280)
  return { productId: p.id, onHand, monthlyUsage, reorderPoint: Math.round(monthlyUsage * 1.5) }
})
export const stockOf = (productId: string) => STOCK.find((s) => s.productId === productId)

// ---------------- filters ----------------
export type PeriodPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
export interface PurchaseFilters {
  preset: PeriodPreset
  start: string
  end: string
  branch: string
  warehouse: string
  supplier: string
  product: string
  category: string
  brand: string
  poStatus: string
  invoiceStatus: string
  paymentStatus: string
  reqStatus: string
}
export const defaultFilters = (): PurchaseFilters => ({
  preset: 'year', start: daysAgo(365), end: TODAY,
  branch: '', warehouse: '', supplier: '', product: '', category: '', brand: '',
  poStatus: '', invoiceStatus: '', paymentStatus: '', reqStatus: '',
})

export function presetRange(p: PeriodPreset): { start: string; end: string } {
  const t = new Date()
  const end = TODAY
  if (p === 'today') return { start: end, end }
  if (p === 'yesterday') { const s = daysAgo(1); return { start: s, end: s } }
  if (p === 'week') { const d = new Date(t); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return { start: iso(d), end } }
  if (p === 'month') return { start: `${end.slice(0, 7)}-01`, end }
  if (p === 'quarter') { const q = Math.floor(t.getMonth() / 3) * 3; return { start: `${end.slice(0, 4)}-${String(q + 1).padStart(2, '0')}-01`, end } }
  if (p === 'year') return { start: `${end.slice(0, 4)}-01-01`, end }
  return { start: daysAgo(540), end }
}

export const paymentStatusOf = (t: PurTxn): 'paid' | 'partial' | 'unpaid' =>
  t.paid > 0 ? (t.outstanding > 0 ? 'partial' : 'paid') : 'unpaid'

export function filterTxns(f: PurchaseFilters, list: PurTxn[] = PTXNS): PurTxn[] {
  const { start, end } = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  return list.filter((t) => {
    if (t.date < start || t.date > end) return false
    if (f.branch && t.branch !== f.branch) return false
    if (f.warehouse && t.warehouse !== f.warehouse) return false
    if (f.supplier && t.supplier !== f.supplier) return false
    if (f.poStatus && t.poStatus !== f.poStatus) return false
    if (f.invoiceStatus && t.invoiceStatus !== f.invoiceStatus) return false
    if (f.paymentStatus && paymentStatusOf(t) !== f.paymentStatus) return false
    if (f.reqStatus && t.reqStatus !== f.reqStatus) return false
    if (f.category && !t.lines.some((l) => productDim(l.productId)?.category === f.category)) return false
    if (f.brand && !t.lines.some((l) => productDim(l.productId)?.brand === f.brand)) return false
    if (f.product && !t.lines.some((l) => l.productId === f.product)) return false
    return true
  })
}

// ---------------- aggregation ----------------
export interface PurAgg {
  pos: number; qty: number; received: number; gross: number; landed: number; charges: number
  savings: number; paid: number; outstanding: number; returns: number; returnsCount: number
  onTime: number; late: number; variance: number; leadSum: number; leadCount: number; txns: PurTxn[]
}
export const emptyAgg = (): PurAgg => ({
  pos: 0, qty: 0, received: 0, gross: 0, landed: 0, charges: 0, savings: 0, paid: 0, outstanding: 0,
  returns: 0, returnsCount: 0, onTime: 0, late: 0, variance: 0, leadSum: 0, leadCount: 0, txns: [],
})
export function addTxn(a: PurAgg, t: PurTxn) {
  a.pos++
  a.qty += t.lines.reduce((s, l) => s + l.qty, 0)
  a.received += t.lines.reduce((s, l) => s + l.receivedQty, 0)
  a.gross += t.gross; a.landed += t.landed
  a.charges += t.freight + t.tax + t.importDuty + t.otherCharges
  a.savings += t.savings; a.paid += t.paid; a.outstanding += t.outstanding
  if (t.returned) { a.returns += t.returnValue; a.returnsCount++ }
  if (t.grn) { a.onTime += t.onTime ? 1 : 0; a.late += t.onTime ? 0 : 1; a.leadSum += t.leadDays; a.leadCount++; a.variance += Math.abs(t.qtyVariance) }
  a.txns.push(t)
}
export function groupAgg(list: PurTxn[], key: (t: PurTxn) => string): Map<string, PurAgg> {
  const m = new Map<string, PurAgg>()
  for (const t of list) {
    const k = key(t)
    const a = m.get(k) ?? emptyAgg()
    addTxn(a, t)
    m.set(k, a)
  }
  return m
}
export const totals = (list: PurTxn[]) => { const a = emptyAgg(); for (const t of list) addTxn(a, t); return a }

// ---------------- buckets ----------------
export const bucketDay = (t: PurTxn) => t.date
export const bucketMonth = (t: PurTxn) => t.date.slice(0, 7)
export const bucketYear = (t: PurTxn) => t.date.slice(0, 4)
export function bucketWeek(t: PurTxn): string {
  const d = new Date(`${t.date}T12:00:00`)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const year = d.getFullYear()
  const firstThu = new Date(year, 0, 4)
  const w = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 864e5 - 3 + ((firstThu.getDay() + 6) % 7)) / 7)
  return `${year}-W${String(w).padStart(2, '0')}`
}
export const bucketQuarter = (t: PurTxn) => `${t.date.slice(0, 4)}-Q${Math.floor((Number(t.date.slice(5, 7)) - 1) / 3) + 1}`

export { productName, productDim, PRODUCTS }
