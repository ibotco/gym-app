// Sales analytics engine — deterministic seeded dataset + aggregation helpers
// powering the Sales Reports module. Pure & dependency-free.

export type Channel = 'standard_pos' | 'advanced_pos' | 'invoice' | 'order'
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'partial'
export type OrderStatus = 'open' | 'closed' | 'pending' | 'partial' | 'backorder'
export type ShipmentStatus = 'delivered' | 'pending' | 'delayed'
export type PayMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Cheque'

export interface ProductDim { id: string; name: string; category: string; brand: string; cost: number; price: number }
export interface SaleLine { productId: string; qty: number; unitPrice: number; unitCost: number; discountAmt: number; campaign?: string }
export interface Txn {
  id: string
  date: string // yyyy-mm-dd
  hour: number
  branch: string
  warehouse: string
  department: string
  channel: Channel
  salesperson: string
  cashier: string
  customer: string
  method: PayMethod
  lines: SaleLine[]
  gross: number
  discount: number
  net: number
  cost: number
  profit: number
  invoiceStatus: InvoiceStatus | null
  orderStatus: OrderStatus | null
  shipStatus: ShipmentStatus | null
  shipCost: number
  /** Total tax charged on this transaction (both modes). */
  taxTotal: number
  /** Per-tax-type amounts charged on this transaction. */
  taxes: { name: string; amount: number }[]
  late: boolean
  voided: boolean
  refunded: boolean
  returnReason: string | null
  campaign: string | null
  received: number
  outstanding: number
}
export interface Quote {
  id: string; date: string; kind: 'estimate' | 'proposal'
  status: 'pending' | 'accepted' | 'rejected' | 'converted'
  value: number; customer: string; salesperson: string
}

// ---------------- dimensions ----------------
export const BRANCHES = ['Osu Main', 'Airport City', 'Tema Comm 1', 'Kumasi Rd']
export const WAREHOUSES = ['Central WH', 'Osu WH', 'Tema WH', 'East WH']
export const DEPARTMENTS = ['Retail', 'Wholesale', 'Online']
export const SALESPERSONS = ['Kofi Mensah', 'Ama Serwaa', 'Yaw Boateng', 'Efua Baidoo', 'Naa Quaye', 'Kwame Osei', 'Abena Mensah', 'Kojo Antwi']
export const CASHIERS = ['Adjoa Kuma', 'Esi Quartey', 'Tetteh Mensah', 'Dede Larbi']
export const CUSTOMERS = ['Walk-in Customer', 'Naa Adjeley Quaye', 'Kwesi Appiah', 'Akosua Dufie', 'Tema Sports Club', 'Airport Fitness Hub', 'Kojo Asante', 'Adwoa Baah', 'Pokuase Gym Ltd', 'Madina Health Club', 'Yaa Asantewaa', 'Spintex Wellness', 'Ekow Ghanson', 'Ama Darko', 'Lapaz Community Gym', 'Osu Fitness Studio', 'Tantra Hills Spa', 'Dansoman Sports']
export const CATEGORIES = ['Fitness Equipment', 'Supplements', 'Apparel', 'Footwear', 'Accessories', 'Recovery']
export const BRANDS = ['FitPro', 'IronCore', 'NutriMax', 'FlexFit', 'PowerHouse', 'ZenBody', 'ProGear', 'ActiveLife']
export const PAY_METHODS: PayMethod[] = ['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Cheque']
export const CAMPAIGNS = ['WELCOME10', 'GYM15', 'FREESHIP', 'LOYAL20', 'FLASH25', 'STUDENT5']
export const RETURN_REASONS = ['Defective', 'Wrong item', 'Damaged in transit', 'Changed mind', 'Quality issue']

const P = (id: string, name: string, category: string, brand: string, cost: number, price: number): ProductDim => ({ id, name, category, brand, cost, price })
export const PRODUCTS: ProductDim[] = [
  P('sp01', 'Treadmill T-900', 'Fitness Equipment', 'IronCore', 5200, 7800),
  P('sp02', 'Adjustable Dumbbell 24kg', 'Fitness Equipment', 'IronCore', 620, 980),
  P('sp03', 'Olympic Barbell 20kg', 'Fitness Equipment', 'PowerHouse', 700, 1150),
  P('sp04', 'Rowing Machine R-2', 'Fitness Equipment', 'PowerHouse', 3100, 4600),
  P('sp05', 'Kettlebell 16kg', 'Fitness Equipment', 'FitPro', 260, 420),
  P('sp06', 'Whey Protein 2kg', 'Supplements', 'NutriMax', 300, 520),
  P('sp07', 'Pre-Workout Boost', 'Supplements', 'NutriMax', 180, 320),
  P('sp08', 'Creatine 500g', 'Supplements', 'ZenBody', 200, 350),
  P('sp09', 'BCAAs 400g', 'Supplements', 'ZenBody', 160, 290),
  P('sp10', 'Mass Gainer 5kg', 'Supplements', 'NutriMax', 420, 680),
  P('sp11', 'Training Tee', 'Apparel', 'FitPro', 45, 120),
  P('sp12', 'Performance Shorts', 'Apparel', 'FitPro', 55, 140),
  P('sp13', 'Gym Hoodie', 'Apparel', 'ActiveLife', 110, 260),
  P('sp14', 'Sports Bra', 'Apparel', 'ActiveLife', 60, 150),
  P('sp15', 'Running Shoes X1', 'Footwear', 'ProGear', 380, 720),
  P('sp16', 'Cross Trainers', 'Footwear', 'ProGear', 340, 640),
  P('sp17', 'Lifting Shoes', 'Footwear', 'IronCore', 400, 750),
  P('sp18', 'Yoga Mat Pro', 'Accessories', 'ZenBody', 90, 190),
  P('sp19', 'Resistance Bands Set', 'Accessories', 'FlexFit', 70, 160),
  P('sp20', 'Lifting Belt', 'Accessories', 'FlexFit', 120, 260),
  P('sp21', 'Gym Bag 40L', 'Accessories', 'ActiveLife', 130, 280),
  P('sp22', 'Foam Roller', 'Recovery', 'ZenBody', 80, 180),
  P('sp23', 'Massage Gun M-1', 'Recovery', 'PowerHouse', 450, 850),
  P('sp24', 'Compression Sleeves', 'Recovery', 'FlexFit', 60, 140),
]

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
const rnd = mulberry32(20260918)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const chance = (p: number) => rnd() < p
const wpick = <T,>(pairs: [T, number][]): T => {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v }
  return pairs[pairs.length - 1][0]
}

export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const TODAY = iso(new Date())
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

const BRANCH_WH: Record<string, string> = { 'Osu Main': 'Osu WH', 'Airport City': 'Central WH', 'Tema Comm 1': 'Tema WH', 'Kumasi Rd': 'East WH' }

// ---------------- dataset generation ----------------
function buildTxns(): Txn[] {
  const out: Txn[] = []
  let n = 0
  for (let back = 540; back >= 0; back--) {
    const date = daysAgo(back)
    const dow = new Date(`${date}T12:00:00`).getDay()
    const weekend = dow === 6 || dow === 0
    const growth = back < 180 ? 1 : back < 360 ? 0 : -1
    const count = Math.max(1, rint(2, 4) + (weekend ? 1 : 0) + growth)
    for (let k = 0; k < count; k++) {
      n++
      const branch = wpick([[BRANCHES[0], 34], [BRANCHES[1], 28], [BRANCHES[2], 22], [BRANCHES[3], 16]])
      const channel = wpick<Channel>([['standard_pos', 42], ['advanced_pos', 28], ['invoice', 17], ['order', 13]])
      const department = channel === 'invoice' ? 'Wholesale' : channel === 'order' ? 'Online' : wpick([[DEPARTMENTS[0], 85], [DEPARTMENTS[1], 15]])
      const salesperson = pick(SALESPERSONS)
      const cashier = channel === 'standard_pos' || channel === 'advanced_pos' ? pick(CASHIERS) : salesperson
      const customer = channel === 'standard_pos' && chance(0.45) ? 'Walk-in Customer' : pick(CUSTOMERS)
      const method = wpick<PayMethod>([['Mobile Money', 35], ['Cash', 28], ['Card', 20], ['Bank Transfer', 12], ['Cheque', 5]])
      const hour = wpick([[9, 12], [10, 14], [11, 14], [14, 12], [16, 12], [18, 14], [19, 10]])
      const lineCount = channel === 'invoice' ? rint(2, 4) : rint(1, 3)
      const campaign = chance(0.28) ? pick(CAMPAIGNS) : null
      const campPct = campaign ? Number((campaign.match(/\d+$/) ?? [5])[0]) : 0
      const lines: SaleLine[] = []
      for (let li = 0; li < lineCount; li++) {
        const prod = pick(PRODUCTS)
        const qty = channel === 'invoice' ? rint(3, 12) : rint(1, 3)
        const manualPct = !campaign && chance(0.2) ? rint(1, 3) * 5 : 0
        const pct = Math.max(campPct, manualPct)
        const grossL = qty * prod.price
        lines.push({ productId: prod.id, qty, unitPrice: prod.price, unitCost: prod.cost, discountAmt: Math.round(grossL * pct) / 100, campaign: pct ? campaign ?? 'MANUAL' : undefined })
      }
      const gross = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
      const discount = lines.reduce((s, l) => s + l.discountAmt, 0)
      const net = Math.round((gross - discount) * 100) / 100
      const cost = lines.reduce((s, l) => s + l.qty * l.unitCost, 0)
      const profit = Math.round((net - cost) * 100) / 100
      // Simulate the dual tax system: mostly GLOBAL (same taxes on every line),
      // sometimes PRODUCT (each line picks its own taxes). Amounts are additive.
      const REPORT_TAXES: { name: string; rate: number }[] = [
        { name: 'VAT', rate: 15 }, { name: 'NHIL', rate: 2.5 }, { name: 'GETFund', rate: 2.5 }, { name: 'COVID Levy', rate: 1 },
      ]
      const perProduct = chance(0.22)
      const taxMap = new Map<string, number>()
      for (const line of lines) {
        const names = perProduct
          ? REPORT_TAXES.filter(() => chance(0.45)).map((t) => t.name)
          : ['VAT', ...(chance(0.6) ? ['NHIL'] : []), ...(chance(0.6) ? ['GETFund'] : [])]
        const base = Math.max(0, line.qty * line.unitPrice - line.discountAmt)
        for (const t of REPORT_TAXES) {
          if (!names.includes(t.name)) continue
          taxMap.set(t.name, (taxMap.get(t.name) || 0) + (base * t.rate) / 100)
        }
      }
      const taxes = [...taxMap.entries()]
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .filter((t) => t.amount > 0)
      const taxTotal = Math.round(taxes.reduce((sum, t) => sum + t.amount, 0) * 100) / 100
      const voided = (channel === 'standard_pos' || channel === 'advanced_pos') && chance(0.015)
      const refunded = !voided && chance(0.02)
      let invoiceStatus: InvoiceStatus | null = null
      let orderStatus: OrderStatus | null = null
      let shipStatus: ShipmentStatus | null = null
      let shipCost = 0
      let late = false
      let received = 0
      if (channel === 'invoice') {
        invoiceStatus = wpick<InvoiceStatus>([['paid', 58], ['unpaid', 20], ['overdue', 13], ['partial', 9]])
        received = invoiceStatus === 'paid' ? net : invoiceStatus === 'partial' ? Math.round(net * 0.5) : 0
      } else if (channel === 'order') {
        orderStatus = wpick<OrderStatus>([['closed', 52], ['open', 18], ['pending', 14], ['partial', 10], ['backorder', 6]])
        invoiceStatus = orderStatus === 'closed' ? 'paid' : wpick<InvoiceStatus>([['paid', 35], ['unpaid', 45], ['partial', 20]])
        received = invoiceStatus === 'paid' ? net : invoiceStatus === 'partial' ? Math.round(net * 0.5) : 0
        shipCost = rint(20, 90)
        if (orderStatus === 'closed') { shipStatus = chance(0.82) ? 'delivered' : 'delayed'; late = shipStatus === 'delayed' }
        else shipStatus = 'pending'
      } else {
        received = voided ? 0 : net
      }
      if (voided) received = 0
      const outstanding = Math.max(0, Math.round((net - received) * 100) / 100)
      out.push({
        id: `S${String(n).padStart(5, '0')}`, date, hour, branch, warehouse: BRANCH_WH[branch], department,
        channel, salesperson, cashier, customer, method, lines,
        gross, discount, net, cost, profit, invoiceStatus, orderStatus, shipStatus, shipCost, taxTotal, taxes, late,
        voided, refunded, returnReason: refunded ? pick(RETURN_REASONS) : null, campaign,
        received, outstanding,
      })
    }
  }
  return out
}

function buildQuotes(): Quote[] {
  const out: Quote[] = []
  for (let i = 0; i < 170; i++) {
    out.push({
      id: `Q${String(i + 1).padStart(4, '0')}`,
      date: daysAgo(rint(0, 540)),
      kind: chance(0.55) ? 'estimate' : 'proposal',
      status: wpick([['converted', 38], ['accepted', 17], ['pending', 20], ['rejected', 25]]),
      value: rint(400, 12000),
      customer: pick(CUSTOMERS.filter((c) => c !== 'Walk-in Customer')),
      salesperson: pick(SALESPERSONS),
    })
  }
  return out
}

export const TXNS: Txn[] = buildTxns()
export const QUOTES: Quote[] = buildQuotes()

// Monthly sales target per branch (deterministic formula).
export function monthTarget(branch: string, ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  const idx = (y - 2025) * 12 + m
  const base = { 'Osu Main': 52000, 'Airport City': 44000, 'Tema Comm 1': 34000, 'Kumasi Rd': 26000 }[branch] ?? 30000
  return Math.round(base * (1 + idx * 0.012))
}

// ---------------- filters ----------------
export type PeriodPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
export interface SaleFilters {
  preset: PeriodPreset
  start: string
  end: string
  branch: string
  warehouse: string
  customer: string
  product: string
  category: string
  brand: string
  salesperson: string
  method: string
  invoiceStatus: string
  orderStatus: string
}
export const defaultFilters = (): SaleFilters => ({
  preset: 'year', start: daysAgo(365), end: TODAY,
  branch: '', warehouse: '', customer: '', product: '', category: '', brand: '',
  salesperson: '', method: '', invoiceStatus: '', orderStatus: '',
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

export function filterTxns(f: SaleFilters, list: Txn[] = TXNS): Txn[] {
  const { start, end } = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  const prod = f.product ? PRODUCTS.find((p) => p.id === f.product) : null
  return list.filter((t) => {
    if (t.date < start || t.date > end) return false
    if (f.branch && t.branch !== f.branch) return false
    if (f.warehouse && t.warehouse !== f.warehouse) return false
    if (f.customer && t.customer !== f.customer) return false
    if (f.salesperson && t.salesperson !== f.salesperson) return false
    if (f.method && t.method !== f.method) return false
    if (f.invoiceStatus && t.invoiceStatus !== f.invoiceStatus) return false
    if (f.orderStatus && t.orderStatus !== f.orderStatus) return false
    if (f.category && !t.lines.some((l) => PRODUCTS.find((p) => p.id === l.productId)?.category === f.category)) return false
    if (f.brand && !t.lines.some((l) => PRODUCTS.find((p) => p.id === l.productId)?.brand === f.brand)) return false
    if (prod && !t.lines.some((l) => l.productId === prod.id)) return false
    return true
  })
}

export function filterQuotes(f: SaleFilters): Quote[] {
  const { start, end } = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  return QUOTES.filter((q) => q.date >= start && q.date <= end && (!f.customer || q.customer === f.customer) && (!f.salesperson || q.salesperson === f.salesperson))
}

// ---------------- aggregation ----------------
export interface Agg {
  orders: number; qty: number; gross: number; discount: number; net: number; cost: number
  profit: number; returns: number; returnsCount: number; received: number; outstanding: number
  voids: number; refunds: number; shipCost: number; taxTotal: number; late: number; delivered: number; txns: Txn[]
}
export const emptyAgg = (): Agg => ({ orders: 0, qty: 0, gross: 0, discount: 0, net: 0, cost: 0, profit: 0, returns: 0, returnsCount: 0, received: 0, outstanding: 0, voids: 0, refunds: 0, shipCost: 0, taxTotal: 0, late: 0, delivered: 0, txns: [] })
export function addTxn(a: Agg, t: Txn) {
  if (!t.voided) {
    a.orders++
    a.gross += t.gross; a.discount += t.discount; a.net += t.net; a.cost += t.cost; a.profit += t.profit
    a.taxTotal += t.taxTotal
    a.received += t.received; a.outstanding += t.outstanding
    a.qty += t.lines.reduce((s, l) => s + l.qty, 0)
  } else a.voids++
  if (t.refunded) { a.refunds++; a.returns += t.net; a.returnsCount++ }
  if (t.shipStatus === 'delivered') a.delivered++
  if (t.late) a.late++
  a.shipCost += t.shipCost
  a.txns.push(t)
}
export function groupAgg(list: Txn[], key: (t: Txn) => string): Map<string, Agg> {
  const m = new Map<string, Agg>()
  for (const t of list) {
    const k = key(t)
    const a = m.get(k) ?? emptyAgg()
    addTxn(a, t)
    m.set(k, a)
  }
  return m
}

// ---------------- period buckets ----------------
export const bucketDay = (t: Txn) => t.date
export const bucketMonth = (t: Txn) => t.date.slice(0, 7)
export const bucketYear = (t: Txn) => t.date.slice(0, 4)
export function bucketWeek(t: Txn): string {
  const d = new Date(`${t.date}T12:00:00`)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const year = d.getFullYear()
  const firstThu = new Date(year, 0, 4)
  const w = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 864e5 - 3 + ((firstThu.getDay() + 6) % 7)) / 7)
  return `${year}-W${String(w).padStart(2, '0')}`
}
export const bucketQuarter = (t: Txn) => `${t.date.slice(0, 4)}-Q${Math.floor((Number(t.date.slice(5, 7)) - 1) / 3) + 1}`
export const shiftOf = (t: Txn) => (t.hour < 12 ? 'Morning (8–12)' : t.hour < 17 ? 'Afternoon (12–17)' : 'Evening (17–21)')

export const productName = (id: string) => PRODUCTS.find((p) => p.id === id)?.name ?? id
export const productDim = (id: string) => PRODUCTS.find((p) => p.id === id)

// ---------------- formatting ----------------
export const money = (n: number) => `₵${Math.round(n).toLocaleString('en-US')}`
export const money2 = (n: number) => `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const num = (n: number) => n.toLocaleString('en-US')
export const pct = (n: number) => `${n.toFixed(1)}%`
export const dmy = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`
export const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
