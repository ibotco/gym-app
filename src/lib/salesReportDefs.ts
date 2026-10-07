// Sales Reports registry — 16 sections of report definitions built on the
// salesAnalytics engine. Every report returns a ReportView the page renders.

import {
  TXNS, PRODUCTS, BRANCHES, PAY_METHODS,
  filterTxns, filterQuotes, groupAgg, emptyAgg, addTxn, type Txn, type Agg, type Quote, type SaleFilters,
  bucketDay, bucketWeek, bucketMonth, bucketQuarter, bucketYear, shiftOf, monthTarget,
  productName, productDim, money, money2, num, pct, dmy, monthLabel, presetRange, TODAY,
} from './salesAnalytics'

export interface MetricCard { label: string; value: string; sub?: string; color: string }
export interface Col { key: string; label: string; right?: boolean }
export type ChartSpec =
  | { kind: 'line' | 'bar' | 'area'; data: { name: string; a: number; b?: number }[]; aLabel: string; bLabel?: string }
  | { kind: 'pie'; data: { name: string; value: number }[] }
export type Row = { [key: string]: string | number | Txn[] | undefined }
export interface ExtraTable { label: string; cols: Col[]; rows: Row[] }
export interface ReportView {
  title: string; desc: string
  metrics: MetricCard[]
  cols: Col[]
  rows: Row[]
  exportName: string
  filtersLine: string
  chart?: ChartSpec
  chartTitle?: string
  extra?: ExtraTable[]
}
export interface ReportDef { id: string; title: string; desc: string; build: (f: SaleFilters) => ReportView }
export interface ReportSection { id: string; title: string; reports: ReportDef[] }

export const BLUE = '#2563eb', GREEN = '#059669', RED = '#e11d48', AMBER = '#d97706', VIOLET = '#7c3aed', SKY = '#0284c7', LIME = '#65a30d', ROSE = '#be123c'

export function filtersLine(f: SaleFilters): string {
  const parts: string[] = []
  const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  parts.push(`Period: ${dmy(r.start)} – ${dmy(r.end)}${f.preset !== 'custom' ? ` (${f.preset})` : ''}`)
  if (f.branch) parts.push(`Branch: ${f.branch}`)
  if (f.warehouse) parts.push(`Warehouse: ${f.warehouse}`)
  if (f.customer) parts.push(`Customer: ${f.customer}`)
  if (f.product) parts.push(`Product: ${productName(f.product)}`)
  if (f.category) parts.push(`Category: ${f.category}`)
  if (f.brand) parts.push(`Brand: ${f.brand}`)
  if (f.salesperson) parts.push(`Salesperson: ${f.salesperson}`)
  if (f.method) parts.push(`Method: ${f.method}`)
  if (f.invoiceStatus) parts.push(`Invoice status: ${f.invoiceStatus}`)
  if (f.orderStatus) parts.push(`Order status: ${f.orderStatus}`)
  return parts.join('  ·  ')
}

const margin = (a: Agg) => (a.net > 0 ? (a.profit / a.net) * 100 : 0)

const STD_COLS: Col[] = [
  { key: 'group', label: 'Group' },
  { key: 'orders', label: 'Orders', right: true },
  { key: 'qty', label: 'Qty', right: true },
  { key: 'gross', label: 'Gross', right: true },
  { key: 'discount', label: 'Discounts', right: true },
  { key: 'net', label: 'Net Sales', right: true },
  { key: 'profit', label: 'Gross Profit', right: true },
  { key: 'margin', label: 'Margin', right: true },
]
const aggRow = (group: string, a: Agg): Row => ({
  group, orders: num(a.orders), qty: num(a.qty), gross: money2(a.gross), discount: money2(a.discount),
  net: money2(a.net), profit: money2(a.profit), margin: pct(margin(a)), __txns: a.txns,
})

const totals = (list: Txn[]) => { const a = emptyAgg(); for (const t of list) addTxn(a, t); return a }

const card = (label: string, value: string, color: string, sub?: string): MetricCard => ({ label, value, color, sub })

function baseView(f: SaleFilters, title: string, desc: string, exportName: string, metrics: MetricCard[], cols: Col[], rows: Row[]): ReportView {
  return { title, desc, metrics, cols, rows, exportName, filtersLine: filtersLine(f) }
}

// ---------- factories ----------
function periodReport(id: string, title: string, desc: string, bucket: (t: Txn) => string, label: (k: string) => string, exportName: string): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f)
      const g = groupAgg(list, bucket)
      const keys = [...g.keys()].sort()
      const rows = keys.map((k) => ({ ...aggRow(label(k), g.get(k)!), __key: k }))
      const a = totals(list)
      const chartData = keys.slice(-24).map((k) => ({ name: label(k), a: Math.round(g.get(k)!.net), b: Math.round(g.get(k)!.profit) }))
      return {
        ...baseView(f, title, desc, exportName, [
          card('Net Sales', money(a.net), BLUE), card('Orders', num(a.orders), GREEN),
          card('Gross Profit', money(a.profit), VIOLET), card('Margin', pct(margin(a)), AMBER),
        ], STD_COLS, rows),
        chart: { kind: 'bar', data: chartData, aLabel: 'Net Sales', bLabel: 'Gross Profit' },
        chartTitle: `${title} — revenue & profit`,
      }
    },
  }
}

function dimReport(id: string, title: string, desc: string, key: (t: Txn) => string, exportName: string, chart: 'pie' | 'bar' = 'pie', top = 10): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f)
      const g = groupAgg(list, key)
      const keys = [...g.keys()].sort((x, y) => g.get(y)!.net - g.get(x)!.net)
      const rows = keys.map((k) => aggRow(k, g.get(k)!))
      const a = totals(list)
      const topKeys = keys.slice(0, top)
      return {
        ...baseView(f, title, desc, exportName, [
          card('Net Sales', money(a.net), BLUE), card('Groups', num(keys.length), GREEN),
          card('Avg / Group', money(keys.length ? a.net / keys.length : 0), AMBER), card('Margin', pct(margin(a)), VIOLET),
        ], STD_COLS, rows),
        chart: chart === 'pie'
          ? { kind: 'pie', data: topKeys.map((k) => ({ name: k, value: Math.round(g.get(k)!.net) })) }
          : { kind: 'bar', data: topKeys.map((k) => ({ name: k, a: Math.round(g.get(k)!.net), b: Math.round(g.get(k)!.profit) })), aLabel: 'Net Sales', bLabel: 'Profit' },
        chartTitle: `Top ${topKeys.length} by net sales`,
      }
    },
  }
}

const TXN_COLS: Col[] = [
  { key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'branch', label: 'Branch' },
  { key: 'channel', label: 'Channel' }, { key: 'customer', label: 'Customer' }, { key: 'salesperson', label: 'Salesperson' },
  { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' },
  { key: 'net', label: 'Net', right: true }, { key: 'received', label: 'Received', right: true }, { key: 'outstanding', label: 'Outstanding', right: true },
]
const txnRow = (t: Txn): Row => ({
  id: t.id, date: dmy(t.date), branch: t.branch,
  channel: t.channel === 'standard_pos' ? 'Standard POS' : t.channel === 'advanced_pos' ? 'Advanced POS' : t.channel === 'invoice' ? 'Invoice' : 'Sales Order',
  customer: t.customer, salesperson: t.salesperson, method: t.method,
  status: t.voided ? 'voided' : t.refunded ? 'refunded' : t.orderStatus ?? t.invoiceStatus ?? 'completed',
  net: money2(t.voided ? 0 : t.net), received: money2(t.received), outstanding: money2(t.outstanding), __txns: [t],
})

function listReport(id: string, title: string, desc: string, pred: (t: Txn) => boolean, exportName: string, extraMetrics?: (a: Agg, list: Txn[]) => MetricCard[]): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f).filter(pred).sort((x, y) => y.date.localeCompare(x.date))
      const a = totals(list)
      const metrics = [
        card('Records', num(list.length), BLUE), card('Net Sales', money(a.net), GREEN),
        card('Received', money(a.received), SKY), card('Outstanding', money(a.outstanding), RED),
      ]
      if (extraMetrics) metrics.push(...extraMetrics(a, list))
      return baseView(f, title, desc, exportName, metrics, TXN_COLS, list.map(txnRow))
    },
  }
}

const Q_COLS: Col[] = [
  { key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'kind', label: 'Type' },
  { key: 'customer', label: 'Customer' }, { key: 'salesperson', label: 'Salesperson' },
  { key: 'status', label: 'Status' }, { key: 'value', label: 'Value', right: true },
]

// ---------- sections ----------
export const SECTIONS: ReportSection[] = [
  {
    id: 'exec', title: 'Executive Sales Dashboard',
    reports: [{
      id: 'exec', title: 'Executive Sales Dashboard', desc: 'Company-wide sales health: KPIs, trends, top performers and daily summary.',
      build: (f) => {
        const list = filterTxns(f)
        const a = totals(list)
        const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
        const span = Math.max(1, Math.round((new Date(r.end).getTime() - new Date(r.start).getTime()) / 864e5) + 1)
        const prevEnd = dmyIso(new Date(new Date(r.start).getTime() - 864e5))
        const prevStart = dmyIso(new Date(new Date(r.start).getTime() - span * 864e5))
        const prev = totals(TXNS.filter((t) => t.date >= prevStart && t.date <= prevEnd))
        const growth = prev.net > 0 ? ((a.net - prev.net) / prev.net) * 100 : 0
        const customers = new Set(list.map((t) => t.customer)).size
        const byMonth = groupAgg(list, bucketMonth)
        const months = [...byMonth.keys()].sort()
        const byDay = groupAgg(list, bucketDay)
        const days = [...byDay.keys()].sort().reverse()
        const byProduct = groupAgg(list, (t) => t.lines.map((l) => l.productId).join('|') ? 'x' : 'x') // placeholder replaced below
        void byProduct
        const prodAgg = new Map<string, { qty: number; net: number }>()
        for (const t of list) for (const l of t.lines) {
          const cur = prodAgg.get(l.productId) ?? { qty: 0, net: 0 }
          cur.qty += l.qty; cur.net += l.qty * l.unitPrice - l.discountAmt
          prodAgg.set(l.productId, cur)
        }
        const topP = [...prodAgg.entries()].sort((x, y) => y[1].net - x[1].net).slice(0, 8)
        const custAgg = groupAgg(list, (t) => t.customer)
        const topC = [...custAgg.entries()].sort((x, y) => y[1].net - x[1].net).slice(0, 8)
        const spAgg = groupAgg(list, (t) => t.salesperson)
        const topS = [...spAgg.entries()].sort((x, y) => y[1].net - x[1].net).slice(0, 8)
        const NAME_COLS: Col[] = [{ key: 'group', label: 'Name' }, { key: 'orders', label: 'Orders', right: true }, { key: 'net', label: 'Net Sales', right: true }]
        return {
          ...baseView(f, 'Executive Sales Dashboard', 'Company-wide sales health: KPIs, trends, top performers and daily summary.', 'executive-sales-dashboard', [
            card('Total Revenue', money(a.gross), BLUE, 'gross sales'),
            card('Net Sales', money(a.net), GREEN, 'after discounts'),
            card('Gross Profit', money(a.profit), VIOLET, pct(margin(a)) + ' margin'),
            card('Sales Growth', pct(growth), growth >= 0 ? GREEN : RED, 'vs previous period'),
            card('Sales Returns', money(a.returns), ROSE, `${a.returnsCount} refunds`),
            card('Outstanding', money(a.outstanding), AMBER, 'receivables'),
            card('Payments Received', money(a.received), SKY, a.net ? pct((a.received / a.net) * 100) + ' collected' : undefined),
            card('Avg Order Value', money(a.orders ? a.net / a.orders : 0), LIME),
            card('Total Orders', num(a.orders), GREEN),
            card('Customers', num(customers), SKY),
            card('Total Discounts', money(a.discount), AMBER),
            card('Collection Rate', pct(a.net ? (a.received / a.net) * 100 : 0), SKY),
          ], [
            { key: 'date', label: 'Date' }, { key: 'orders', label: 'Orders', right: true }, { key: 'qty', label: 'Qty', right: true },
            { key: 'net', label: 'Net Sales', right: true }, { key: 'discount', label: 'Discounts', right: true },
            { key: 'profit', label: 'Profit', right: true }, { key: 'received', label: 'Received', right: true },
          ], days.slice(0, 31).map((d) => {
            const g = byDay.get(d)!
            return { date: dmy(d), orders: num(g.orders), qty: num(g.qty), net: money2(g.net), discount: money2(g.discount), profit: money2(g.profit), received: money2(g.received), __txns: g.txns }
          })),
          chart: { kind: 'line', data: months.map((m) => ({ name: monthLabel(m), a: Math.round(byMonth.get(m)!.net), b: Math.round(byMonth.get(m)!.profit) })), aLabel: 'Net Sales', bLabel: 'Gross Profit' },
          chartTitle: 'Monthly Revenue Trend',
          extra: [
            { label: 'Top Selling Products', cols: [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Qty Sold', right: true }, { key: 'net', label: 'Revenue', right: true }], rows: topP.map(([id, v]) => ({ group: productName(id), qty: num(v.qty), net: money2(v.net) })) },
            { label: 'Top Customers', cols: NAME_COLS, rows: topC.map(([k, v]) => ({ group: k, orders: num(v.orders), net: money2(v.net) })) },
            { label: 'Top Salespersons', cols: NAME_COLS, rows: topS.map(([k, v]) => ({ group: k, orders: num(v.orders), net: money2(v.net) })) },
          ],
        }
      },
    }],
  },
  {
    id: 'perf', title: 'Sales Performance Reports',
    reports: [
      periodReport('perf-day', 'Sales by Day', 'Daily revenue, discounts and profit within the selected period.', bucketDay, (k) => dmy(k), 'sales-by-day'),
      periodReport('perf-week', 'Sales by Week', 'Weekly (ISO) sales performance.', bucketWeek, (k) => k, 'sales-by-week'),
      periodReport('perf-month', 'Sales by Month', 'Monthly sales performance.', bucketMonth, monthLabel, 'sales-by-month'),
      periodReport('perf-quarter', 'Sales by Quarter', 'Quarterly sales performance.', bucketQuarter, (k) => k, 'sales-by-quarter'),
      periodReport('perf-year', 'Sales by Year', 'Yearly sales performance.', bucketYear, (k) => k, 'sales-by-year'),
      {
        id: 'perf-compare', title: 'Sales Comparison Report', desc: 'This year vs last year, month by month.',
        build: (f) => {
          const list = filterTxns(f)
          const years = [...new Set(list.map((t) => t.date.slice(0, 4)))].sort().slice(-2)
          const [y1, y2] = years.length === 2 ? years : [years[0] ?? '2025', years[0] ?? '2025']
          const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
          const sum = (year: string, m: string) => list.filter((t) => t.date.startsWith(`${year}-${m}`)).reduce((s, t) => s + (t.voided ? 0 : t.net), 0)
          const rows = months.map((m) => ({
            group: monthLabel(`2026-${m}`), [`${y1}`]: money2(sum(y1, m)), [`${y2}`]: money2(sum(y2, m)),
            change: sum(y1, m) > 0 ? pct(((sum(y2, m) - sum(y1, m)) / sum(y1, m)) * 100) : '—',
          }))
          const a = totals(list)
          return {
            ...baseView(f, 'Sales Comparison Report', 'This year vs last year, month by month.', 'sales-comparison',
              [card('Net Sales', money(a.net), BLUE), card('Years compared', `${y1} vs ${y2}`, GREEN)],
              [{ key: 'group', label: 'Month' }, { key: y1, label: y1, right: true }, { key: y2, label: y2, right: true }, { key: 'change', label: 'Change', right: true }], rows),
            chart: { kind: 'bar', data: months.map((m) => ({ name: monthLabel(`2026-${m}`), a: Math.round(sum(y1, m)), b: Math.round(sum(y2, m)) })), aLabel: y1, bLabel: y2 },
            chartTitle: 'Year-over-year comparison',
          }
        },
      },
      {
        id: 'perf-growth', title: 'Revenue Growth Analysis', desc: 'Month-over-month revenue growth rates.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k, i) => {
            const prevNet = i > 0 ? g.get(keys[i - 1])!.net : 0
            const growth = prevNet > 0 ? ((g.get(k)!.net - prevNet) / prevNet) * 100 : 0
            return { group: monthLabel(k), net: money2(g.get(k)!.net), growth: pct(growth), __txns: g.get(k)!.txns }
          })
          const a = totals(list)
          return {
            ...baseView(f, 'Revenue Growth Analysis', 'Month-over-month revenue growth rates.', 'revenue-growth',
              [card('Net Sales', money(a.net), BLUE), card('Best month', keys.length ? monthLabel(keys.reduce((x, y) => (g.get(x)!.net > g.get(y)!.net ? x : y))) : '—', GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'net', label: 'Net Sales', right: true }, { key: 'growth', label: 'MoM Growth', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k, i) => ({ name: monthLabel(k), a: i > 0 ? Math.round((((g.get(k)!.net - g.get(keys[i - 1])!.net) / (g.get(keys[i - 1])!.net || 1)) * 100)) : 0 })), aLabel: 'Growth %' },
            chartTitle: 'Month-over-month growth %',
          }
        },
      },
      {
        id: 'perf-target', title: 'Sales Target vs Actual', desc: 'Monthly branch targets against actual net sales.',
        build: (f) => {
          const list = filterTxns(f)
          const branches = f.branch ? [f.branch] : BRANCHES
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const target = branches.reduce((s, b) => s + monthTarget(b, k), 0)
            const actual = g.get(k)!.net
            return { group: monthLabel(k), target: money2(target), actual: money2(actual), attainment: pct((actual / target) * 100), __txns: g.get(k)!.txns }
          })
          const a = totals(list)
          const target = rows.reduce((s, r) => s + Number(String(r.target).replace(/[₵,]/g, '')), 0)
          return {
            ...baseView(f, 'Sales Target vs Actual', 'Monthly branch targets against actual net sales.', 'target-vs-actual',
              [card('Actual', money(a.net), GREEN), card('Target', money(target), BLUE), card('Attainment', pct(target ? (a.net / target) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'target', label: 'Target', right: true }, { key: 'actual', label: 'Actual', right: true }, { key: 'attainment', label: 'Attainment', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: branches.reduce((s, b) => s + monthTarget(b, k), 0), b: Math.round(g.get(k)!.net) })), aLabel: 'Target', bLabel: 'Actual' },
            chartTitle: 'Target vs actual by month',
          }
        },
      },
      dimReport('perf-branch', 'Branch / Location Performance', 'Sales performance per branch.', (t) => t.branch, 'branch-performance', 'bar'),
      dimReport('perf-dept', 'Department Sales Performance', 'Sales performance per department.', (t) => t.department, 'department-performance', 'bar'),
    ],
  },
  {
    id: 'pos', title: 'POS Reports',
    reports: [
      dimReport('pos-std', 'Standard POS Sales Report', 'All standard point-of-sale sales.', (t) => t.branch, 'standard-pos-sales', 'bar'),
      dimReport('pos-adv', 'Advanced POS Sales Report', 'All advanced point-of-sale sales.', (t) => t.branch, 'advanced-pos-sales', 'bar'),
      dimReport('pos-cashier', 'Cashier Performance', 'Transactions, voids and revenue per cashier.', (t) => t.cashier, 'cashier-performance', 'bar'),
      listReport('pos-txn', 'Point of Sale Transactions', 'Every POS transaction in the period.', (t) => t.channel === 'standard_pos' || t.channel === 'advanced_pos', 'pos-transactions'),
      dimReport('pos-shift', 'Shift Sales Report', 'Revenue by shift of day.', shiftOf, 'shift-sales', 'bar'),
      dimReport('pos-register', 'Register Summary', 'Revenue per branch register.', (t) => `${t.branch} · Reg ${(t.hour % 2) + 1}`, 'register-summary', 'bar'),
      listReport('pos-void', 'Void Transaction Report', 'Voided POS transactions.', (t) => t.voided, 'void-transactions', (a) => [card('Voided', num(a.voids), RED)]),
      listReport('pos-refund', 'Refund Report', 'Refunded transactions at POS.', (t) => t.refunded, 'pos-refunds', (a) => [card('Refunded value', money(a.returns), ROSE)]),
      {
        id: 'pos-profit', title: 'POS Profitability Report', desc: 'Revenue, cost and margin per POS channel.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.channel === 'standard_pos' || t.channel === 'advanced_pos')
          const g = groupAgg(list, (t) => (t.channel === 'standard_pos' ? 'Standard POS' : 'Advanced POS'))
          const rows = [...g.entries()].map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'POS Profitability Report', 'Revenue, cost and margin per POS channel.', 'pos-profitability',
              [card('Net Sales', money(a.net), BLUE), card('Profit', money(a.profit), GREEN), card('Margin', pct(margin(a)), AMBER)], STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.profit) })) },
            chartTitle: 'Profit split by POS channel',
          }
        },
      },
    ],
  },
  {
    id: 'prod', title: 'Product Sales Reports',
    reports: [
      dimReport('prod-sum', 'Product Sales Summary', 'Revenue and margin per product.', (t) => productName(t.lines[0]?.productId ?? ''), 'product-sales-summary'),
      {
        id: 'prod-detail', title: 'Product Sales Details', desc: 'Line-level sales detail for every product sold.',
        build: (f) => {
          const list = filterTxns(f)
          const rows: Row[] = []
          for (const t of list) for (const l of t.lines) {
            const p = productDim(l.productId)
            rows.push({
              date: dmy(t.date), ref: t.id, product: p?.name ?? l.productId, category: p?.category ?? '—', brand: p?.brand ?? '—',
              qty: num(l.qty), price: money2(l.unitPrice), gross: money2(l.qty * l.unitPrice), discount: money2(l.discountAmt),
              net: money2(l.qty * l.unitPrice - l.discountAmt), profit: money2(l.qty * l.unitPrice - l.discountAmt - l.qty * l.unitCost), __txns: [t],
            })
          }
          rows.sort((x, y) => String(y.date).localeCompare(String(x.date)))
          const a = totals(list)
          return baseView(f, 'Product Sales Details', 'Line-level sales detail for every product sold.', 'product-sales-details',
            [card('Lines', num(rows.length), BLUE), card('Net Sales', money(a.net), GREEN), card('Profit', money(a.profit), VIOLET)],
            [{ key: 'date', label: 'Date' }, { key: 'ref', label: 'Ref' }, { key: 'product', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'brand', label: 'Brand' }, { key: 'qty', label: 'Qty', right: true }, { key: 'gross', label: 'Gross', right: true }, { key: 'discount', label: 'Discount', right: true }, { key: 'net', label: 'Net', right: true }, { key: 'profit', label: 'Profit', right: true }],
            rows)
        },
      },
      {
        id: 'prod-best', title: 'Best Selling Products', desc: 'Products ranked by units sold.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, { qty: number; net: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { qty: 0, net: 0, txns: [] }
            cur.qty += l.qty; cur.net += l.qty * l.unitPrice - l.discountAmt; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].qty - x[1].qty).slice(0, 15)
            .map(([id, v]) => ({ group: productName(id), qty: num(v.qty), net: money2(v.net), __txns: v.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Best Selling Products', 'Products ranked by units sold.', 'best-selling-products',
              [card('Products sold', num(m.size), BLUE), card('Units', num(a.qty), GREEN), card('Net Sales', money(a.net), VIOLET)],
              [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Qty Sold', right: true }, { key: 'net', label: 'Revenue', right: true }], rows),
            chart: { kind: 'bar', data: rows.slice(0, 10).map((r) => ({ name: String(r.group), a: Number(String(r.qty).replace(/,/g, '')) })), aLabel: 'Units' },
            chartTitle: 'Top 10 products by units',
          }
        },
      },
      {
        id: 'prod-slow', title: 'Slow Moving Products', desc: 'Products with the fewest units sold in the period.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, number>()
          for (const t of list) for (const l of t.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty)
          const rows = PRODUCTS.map((p) => ({ group: p.name, category: p.category, qty: num(m.get(p.id) ?? 0), tied: money2((m.get(p.id) ?? 0) * p.price) }))
            .sort((x, y) => Number(String(x.qty).replace(/,/g, '')) - Number(String(y.qty).replace(/,/g, ''))).slice(0, 15)
          return baseView(f, 'Slow Moving Products', 'Products with the fewest units sold in the period.', 'slow-moving-products',
            [card('Catalogue size', num(PRODUCTS.length), BLUE), card('Zero sellers', num(rows.filter((r) => r.qty === '0').length), RED)],
            [{ key: 'group', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty Sold', right: true }, { key: 'tied', label: 'Revenue', right: true }], rows)
        },
      },
      dimReport('prod-profit', 'Product Profitability', 'Profit contribution per product.', (t) => productName(t.lines[0]?.productId ?? ''), 'product-profitability'),
      dimReport('prod-cat', 'Product Category Analysis', 'Sales performance per category.', (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—', 'category-analysis'),
      dimReport('prod-brand', 'Brand Performance', 'Sales performance per brand.', (t) => productDim(t.lines[0]?.productId ?? '')?.brand ?? '—', 'brand-performance'),
      {
        id: 'prod-trend', title: 'Item Trend Analysis', desc: 'Monthly units & revenue for the filtered product.',
        build: (f) => {
          const pid = f.product || 'sp06'
          const list = filterTxns(f)
          const m = new Map<string, { qty: number; net: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) if (l.productId === pid) {
            const cur = m.get(t.date.slice(0, 7)) ?? { qty: 0, net: 0, txns: [] }
            cur.qty += l.qty; cur.net += l.qty * l.unitPrice - l.discountAmt; cur.txns.push(t)
            m.set(t.date.slice(0, 7), cur)
          }
          const keys = [...m.keys()].sort()
          const rows = keys.map((k) => ({ group: monthLabel(k), qty: num(m.get(k)!.qty), net: money2(m.get(k)!.net), __txns: m.get(k)!.txns }))
          return {
            ...baseView(f, 'Item Trend Analysis', `Monthly units & revenue for ${productName(pid)}.`, 'item-trend',
              [card('Product', productName(pid), BLUE), card('Units', num(keys.reduce((s, k) => s + m.get(k)!.qty, 0)), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'qty', label: 'Units', right: true }, { key: 'net', label: 'Revenue', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: m.get(k)!.qty, b: Math.round(m.get(k)!.net) })), aLabel: 'Units', bLabel: 'Revenue' },
            chartTitle: `${productName(pid)} — monthly trend`,
          }
        },
      },
      {
        id: 'prod-margin', title: 'Product Margin Report', desc: 'Margin % per product, lowest first.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, Agg & { txns2: Txn[] }>()
          const agg = new Map<string, { net: number; profit: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = agg.get(l.productId) ?? { net: 0, profit: 0, txns: [] }
            const lineNet = l.qty * l.unitPrice - l.discountAmt
            cur.net += lineNet; cur.profit += lineNet - l.qty * l.unitCost; cur.txns.push(t)
            agg.set(l.productId, cur)
          }
          void m
          const rows = [...agg.entries()].map(([id, v]) => ({ group: productName(id), net: money2(v.net), profit: money2(v.profit), margin: pct(v.net ? (v.profit / v.net) * 100 : 0), __txns: v.txns }))
            .sort((x, y) => parseFloat(String(x.margin)) - parseFloat(String(y.margin)))
          return baseView(f, 'Product Margin Report', 'Margin % per product, lowest first.', 'product-margin',
            [card('Products', num(agg.size), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'net', label: 'Net Sales', right: true }, { key: 'profit', label: 'Profit', right: true }, { key: 'margin', label: 'Margin', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'cust', title: 'Customer Sales Reports',
    reports: [
      dimReport('cust-sum', 'Customer Purchase Summary', 'Revenue per customer.', (t) => t.customer, 'customer-purchase-summary'),
      dimReport('cust-analysis', 'Customer Sales Analysis', 'Orders, discounts and margin per customer.', (t) => t.customer, 'customer-sales-analysis', 'bar'),
      {
        id: 'cust-ltv', title: 'Customer Lifetime Value', desc: 'LTV, order frequency and avg order value per customer.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.customer)
          const rows = [...g.entries()].map(([k, a]) => {
            const dates = a.txns.map((t) => t.date).sort()
            const monthsActive = Math.max(1, Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (30 * 864e5)) + 1)
            return { group: k, orders: num(a.orders), net: money2(a.net), aov: money2(a.orders ? a.net / a.orders : 0), perMonth: money2(a.net / monthsActive), ltv: money2(a.net), __txns: a.txns }
          }).sort((x, y) => parseFloat(String(y.ltv).replace(/[₵,]/g, '')) - parseFloat(String(x.ltv).replace(/[₵,]/g, '')))
          const a = totals(list)
          return baseView(f, 'Customer Lifetime Value', 'LTV, order frequency and avg order value per customer.', 'customer-ltv',
            [card('Customers', num(g.size), BLUE), card('Avg LTV', money(g.size ? a.net / g.size : 0), GREEN), card('Avg Order Value', money(a.orders ? a.net / a.orders : 0), AMBER)],
            [{ key: 'group', label: 'Customer' }, { key: 'orders', label: 'Orders', right: true }, { key: 'aov', label: 'Avg Order', right: true }, { key: 'perMonth', label: 'Per Month', right: true }, { key: 'ltv', label: 'LTV', right: true }], rows)
        },
      },
      {
        id: 'cust-top', title: 'Top Customers', desc: 'The ten highest-spending customers.',
        build: (f) => {
          const def = dimReport('x', 'Top Customers', '', (t) => t.customer, 'top-customers')
          const v = def.build(f)
          v.rows = v.rows.slice(0, 10)
          v.desc = 'The ten highest-spending customers.'
          return v
        },
      },
      {
        id: 'cust-outstanding', title: 'Customer Outstanding Balance', desc: 'Receivables per customer, highest first.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.customer)
          const rows = [...g.entries()].filter(([, a]) => a.outstanding > 0)
            .sort((x, y) => y[1].outstanding - x[1].outstanding)
            .map(([k, a]) => ({ group: k, invoiced: money2(a.net), received: money2(a.received), outstanding: money2(a.outstanding), __txns: a.txns }))
          const a = totals(list)
          return baseView(f, 'Customer Outstanding Balance', 'Receivables per customer, highest first.', 'customer-outstanding',
            [card('Outstanding', money(a.outstanding), RED), card('Debtors', num(rows.length), AMBER)],
            [{ key: 'group', label: 'Customer' }, { key: 'invoiced', label: 'Invoiced', right: true }, { key: 'received', label: 'Received', right: true }, { key: 'outstanding', label: 'Outstanding', right: true }], rows)
        },
      },
      {
        id: 'cust-repeat', title: 'Repeat Customer Report', desc: 'Customers with more than one order in the period.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.customer)
          const all = [...g.entries()]
          const repeat = all.filter(([, a]) => a.orders > 1)
          const rows = repeat.sort((x, y) => y[1].orders - x[1].orders).map(([k, a]) => aggRow(k, a))
          return baseView(f, 'Repeat Customer Report', 'Customers with more than one order in the period.', 'repeat-customers',
            [card('Customers', num(all.length), BLUE), card('Repeat', num(repeat.length), GREEN), card('Repeat rate', pct(all.length ? (repeat.length / all.length) * 100 : 0), AMBER)],
            STD_COLS, rows)
        },
      },
      {
        id: 'cust-retention', title: 'Customer Retention Analysis', desc: 'Customers retained from the previous equivalent window.',
        build: (f) => {
          const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
          const span = Math.max(1, Math.round((new Date(r.end).getTime() - new Date(r.start).getTime()) / 864e5) + 1)
          const prevEnd = dmyIso(new Date(new Date(r.start).getTime() - 864e5))
          const prevStart = dmyIso(new Date(new Date(r.start).getTime() - span * 864e5))
          const dimOk = (t: Txn) => (!f.branch || t.branch === f.branch) && (!f.customer || t.customer === f.customer)
          const cur = new Set(TXNS.filter((t) => t.date >= r.start && t.date <= r.end && dimOk(t)).map((t) => t.customer))
          const prev = new Set(TXNS.filter((t) => t.date >= prevStart && t.date <= prevEnd && dimOk(t)).map((t) => t.customer))
          const retained = [...cur].filter((c) => prev.has(c))
          const rows = [...cur].map((c) => ({ group: c, previous: prev.has(c) ? 'Yes' : 'No', status: retained.includes(c) ? 'Retained' : prev.has(c) ? 'Lapsed' : 'New' }))
          return baseView(f, 'Customer Retention Analysis', 'Customers retained from the previous equivalent window.', 'customer-retention',
            [card('Active customers', num(cur.size), BLUE), card('Retained', num(retained.length), GREEN), card('Retention rate', pct(prev.size ? (retained.length / prev.size) * 100 : 0), AMBER), card('New', num([...cur].filter((c) => !prev.has(c)).length), SKY)],
            [{ key: 'group', label: 'Customer' }, { key: 'previous', label: 'Active previous window' }, { key: 'status', label: 'Status' }], rows)
        },
      },
      {
        id: 'cust-patterns', title: 'Customer Buying Patterns', desc: 'Sales by day of week.',
        build: (f) => {
          const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => names[new Date(`${t.date}T12:00:00`).getDay()])
          const rows = names.filter((n) => g.has(n)).map((n) => aggRow(n, g.get(n)!))
          const a = totals(list)
          return {
            ...baseView(f, 'Customer Buying Patterns', 'Sales by day of week.', 'buying-patterns', [card('Net Sales', money(a.net), BLUE), card('Busiest day', rows.length ? String(rows.reduce((x, y) => (parseFloat(String(x.net).replace(/[₵,]/g, '')) > parseFloat(String(y.net).replace(/[₵,]/g, '')) ? x : y)).group) : '—', GREEN)], STD_COLS, rows),
            chart: { kind: 'bar', data: names.filter((n) => g.has(n)).map((n) => ({ name: n, a: Math.round(g.get(n)!.net) })), aLabel: 'Net Sales' },
            chartTitle: 'Revenue by weekday',
          }
        },
      },
    ],
  },
  {
    id: 'sp', title: 'Salesperson Reports',
    reports: [
      dimReport('sp-by', 'Sales by Salesperson', 'Revenue and margin per salesperson.', (t) => t.salesperson, 'sales-by-salesperson', 'bar'),
      {
        id: 'sp-comm', title: 'Commission Report', desc: 'Commission earned at 5% of gross profit.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.salesperson)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, net: money2(a.net), profit: money2(a.profit), commission: money2(a.profit * 0.05), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.commission).replace(/[₵,]/g, '')) - parseFloat(String(x.commission).replace(/[₵,]/g, '')))
          const a = totals(list)
          return baseView(f, 'Commission Report', 'Commission earned at 5% of gross profit.', 'commission-report',
            [card('Gross Profit', money(a.profit), GREEN), card('Commission pool', money(a.profit * 0.05), AMBER)],
            [{ key: 'group', label: 'Salesperson' }, { key: 'net', label: 'Net Sales', right: true }, { key: 'profit', label: 'Profit', right: true }, { key: 'commission', label: 'Commission (5%)', right: true }], rows)
        },
      },
      {
        id: 'sp-target', title: 'Sales Targets Achievement', desc: 'Attainment per salesperson against a ₵45k monthly target.',
        build: (f) => {
          const list = filterTxns(f)
          const months = new Set(list.map((t) => t.date.slice(0, 7))).size || 1
          const g = groupAgg(list, (t) => t.salesperson)
          const rows = [...g.entries()].map(([k, a]) => {
            const target = 45000 * months
            return { group: k, target: money2(target), actual: money2(a.net), attainment: pct((a.net / target) * 100), __txns: a.txns }
          }).sort((x, y) => parseFloat(String(y.attainment)) - parseFloat(String(x.attainment)))
          const a = totals(list)
          return baseView(f, 'Sales Targets Achievement', 'Attainment per salesperson against a ₵45k monthly target.', 'salesperson-targets',
            [card('Team actual', money(a.net), GREEN)],
            [{ key: 'group', label: 'Salesperson' }, { key: 'target', label: 'Target', right: true }, { key: 'actual', label: 'Actual', right: true }, { key: 'attainment', label: 'Attainment', right: true }], rows)
        },
      },
      {
        id: 'sp-rank', title: 'Salesperson Ranking', desc: 'League table by net sales.',
        build: (f) => {
          const def = dimReport('x', 'Salesperson Ranking', '', (t) => t.salesperson, 'salesperson-ranking', 'bar')
          const v = def.build(f)
          v.rows = v.rows.map((r, i) => ({ rank: `#${i + 1}`, ...r }))
          v.cols = [{ key: 'rank', label: 'Rank' }, ...v.cols]
          return v
        },
      },
      dimReport('sp-rev', 'Revenue per Salesperson', 'Revenue generated per salesperson.', (t) => t.salesperson, 'revenue-per-salesperson', 'bar'),
      {
        id: 'sp-conv', title: 'Sales Conversion Rate', desc: 'Quotation-to-order conversion per salesperson.',
        build: (f) => {
          const quotes = filterQuotes(f)
          const g = new Map<string, { total: number; won: number }>()
          for (const q of quotes) {
            const cur = g.get(q.salesperson) ?? { total: 0, won: 0 }
            cur.total++; if (q.status === 'converted' || q.status === 'accepted') cur.won++
            g.set(q.salesperson, cur)
          }
          const list = filterTxns(f)
          const rev = groupAgg(list, (t) => t.salesperson)
          const rows = [...g.entries()].map(([k, v]) => ({ group: k, quotes: num(v.total), won: num(v.won), rate: pct(v.total ? (v.won / v.total) * 100 : 0), revenue: money2(rev.get(k)?.net ?? 0), __txns: rev.get(k)?.txns ?? [] }))
            .sort((x, y) => parseFloat(String(y.rate)) - parseFloat(String(x.rate)))
          const tot = quotes.length
          const won = quotes.filter((q) => q.status === 'converted' || q.status === 'accepted').length
          return baseView(f, 'Sales Conversion Rate', 'Quotation-to-order conversion per salesperson.', 'sales-conversion',
            [card('Quotations', num(tot), BLUE), card('Won', num(won), GREEN), card('Team conversion', pct(tot ? (won / tot) * 100 : 0), AMBER)],
            [{ key: 'group', label: 'Salesperson' }, { key: 'quotes', label: 'Quotations', right: true }, { key: 'won', label: 'Won', right: true }, { key: 'rate', label: 'Conversion', right: true }, { key: 'revenue', label: 'Revenue', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'quotes', title: 'Quotations & Proposals Reports',
    reports: [
      {
        id: 'q-est', title: 'Estimates Report', desc: 'All estimates in the period.',
        build: (f) => quoteView(f, 'Estimates Report', (q) => q.kind === 'estimate', 'estimates-report'),
      },
      {
        id: 'q-prop', title: 'Proposal Report', desc: 'All proposals in the period.',
        build: (f) => quoteView(f, 'Proposal Report', (q) => q.kind === 'proposal', 'proposal-report'),
      },
      {
        id: 'q-acc', title: 'Accepted Quotations', desc: 'Accepted (incl. converted) quotations.',
        build: (f) => quoteView(f, 'Accepted Quotations', (q) => q.status === 'accepted' || q.status === 'converted', 'accepted-quotations'),
      },
      {
        id: 'q-rej', title: 'Rejected Quotations', desc: 'Rejected quotations.',
        build: (f) => quoteView(f, 'Rejected Quotations', (q) => q.status === 'rejected', 'rejected-quotations'),
      },
      {
        id: 'q-pend', title: 'Pending Quotations', desc: 'Quotations awaiting a decision.',
        build: (f) => quoteView(f, 'Pending Quotations', (q) => q.status === 'pending', 'pending-quotations'),
      },
      {
        id: 'q-conv', title: 'Quotation-to-Order Conversion Ratio', desc: 'Converted quotations per salesperson.',
        build: (f) => {
          const quotes = filterQuotes(f)
          const rows = [...groupQuotes(quotes)].map(([k, v]) => ({ group: k, quotes: num(v.total), converted: num(v.converted), ratio: pct(v.total ? (v.converted / v.total) * 100 : 0) }))
            .sort((x, y) => parseFloat(String(y.ratio)) - parseFloat(String(x.ratio)))
          const conv = quotes.filter((q) => q.status === 'converted').length
          return baseView(f, 'Quotation-to-Order Conversion Ratio', 'Converted quotations per salesperson.', 'quotation-conversion',
            [card('Quotations', num(quotes.length), BLUE), card('Converted', num(conv), GREEN), card('Conversion ratio', pct(quotes.length ? (conv / quotes.length) * 100 : 0), AMBER)],
            [{ key: 'group', label: 'Salesperson' }, { key: 'quotes', label: 'Quotations', right: true }, { key: 'converted', label: 'Converted', right: true }, { key: 'ratio', label: 'Ratio', right: true }], rows)
        },
      },
      {
        id: 'q-success', title: 'Proposal Success Rate', desc: 'Won (accepted + converted) vs lost proposals.',
        build: (f) => {
          const quotes = filterQuotes(f).filter((q) => q.kind === 'proposal')
          const won = quotes.filter((q) => q.status === 'accepted' || q.status === 'converted').length
          const lost = quotes.filter((q) => q.status === 'rejected').length
          const rows = [
            { group: 'Won', count: num(won), share: pct(quotes.length ? (won / quotes.length) * 100 : 0) },
            { group: 'Lost', count: num(lost), share: pct(quotes.length ? (lost / quotes.length) * 100 : 0) },
            { group: 'Pending', count: num(quotes.filter((q) => q.status === 'pending').length), share: pct(quotes.length ? (quotes.filter((q) => q.status === 'pending').length / quotes.length) * 100 : 0) },
          ]
          return {
            ...baseView(f, 'Proposal Success Rate', 'Won (accepted + converted) vs lost proposals.', 'proposal-success-rate',
              [card('Proposals', num(quotes.length), BLUE), card('Success rate', pct(quotes.length ? (won / quotes.length) * 100 : 0), GREEN)],
              [{ key: 'group', label: 'Outcome' }, { key: 'count', label: 'Count', right: true }, { key: 'share', label: 'Share', right: true }], rows),
            chart: { kind: 'pie', data: [{ name: 'Won', value: won }, { name: 'Lost', value: lost }, { name: 'Pending', value: quotes.length - won - lost }] },
            chartTitle: 'Proposal outcomes',
          }
        },
      },
    ],
  },
  {
    id: 'orders', title: 'Sales Order Reports',
    reports: [
      {
        id: 'o-sum', title: 'Sales Orders Summary', desc: 'Order pipeline status overview.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.channel === 'order')
          const g = groupAgg(list, (t) => t.orderStatus ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].net - x[1].net).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Sales Orders Summary', 'Order pipeline status overview.', 'sales-orders-summary',
              [card('Orders', num(a.orders), BLUE), card('Net value', money(a.net), GREEN), card('Fulfilment', pct(list.length ? ((list.filter((t) => t.orderStatus === 'closed').length) / list.length) * 100 : 0), AMBER)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: v.orders })) }, chartTitle: 'Orders by status',
          }
        },
      },
      listReport('o-open', 'Open Orders', 'Orders still open.', (t) => t.channel === 'order' && t.orderStatus === 'open', 'open-orders'),
      listReport('o-closed', 'Closed Orders', 'Fulfilled/closed orders.', (t) => t.channel === 'order' && t.orderStatus === 'closed', 'closed-orders'),
      listReport('o-pending', 'Pending Orders', 'Orders pending processing.', (t) => t.channel === 'order' && t.orderStatus === 'pending', 'pending-orders'),
      listReport('o-partial', 'Partially Fulfilled Orders', 'Partially fulfilled orders.', (t) => t.channel === 'order' && t.orderStatus === 'partial', 'partially-fulfilled-orders'),
      listReport('o-back', 'Backorder Report', 'Orders on backorder.', (t) => t.channel === 'order' && t.orderStatus === 'backorder', 'backorder-report'),
      {
        id: 'o-fulfil', title: 'Order Fulfilment Rate', desc: 'Monthly closed vs total orders.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.channel === 'order')
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const closed = a.txns.filter((t) => t.orderStatus === 'closed').length
            return { group: monthLabel(k), orders: num(a.txns.length), closed: num(closed), rate: pct(a.txns.length ? (closed / a.txns.length) * 100 : 0), __txns: a.txns }
          })
          const closedAll = list.filter((t) => t.orderStatus === 'closed').length
          return {
            ...baseView(f, 'Order Fulfilment Rate', 'Monthly closed vs total orders.', 'order-fulfilment-rate',
              [card('Orders', num(list.length), BLUE), card('Closed', num(closedAll), GREEN), card('Fulfilment rate', pct(list.length ? (closedAll / list.length) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'orders', label: 'Orders', right: true }, { key: 'closed', label: 'Closed', right: true }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.rate)) })), aLabel: 'Fulfilment %' }, chartTitle: 'Fulfilment rate trend',
          }
        },
      },
    ],
  },
  {
    id: 'inv', title: 'Invoice & Receivables Reports',
    reports: [
      {
        id: 'i-sum', title: 'Invoice Summary', desc: 'Invoiced sales by status.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus)
          const g = groupAgg(list, (t) => t.invoiceStatus ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].net - x[1].net).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Invoice Summary', 'Invoiced sales by status.', 'invoice-summary',
              [card('Invoiced', money(a.net), BLUE), card('Received', money(a.received), GREEN), card('Outstanding', money(a.outstanding), RED)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.net) })) }, chartTitle: 'Invoiced value by status',
          }
        },
      },
      listReport('i-paid', 'Paid Invoices', 'Fully paid invoices.', (t) => t.invoiceStatus === 'paid', 'paid-invoices'),
      listReport('i-unpaid', 'Unpaid Invoices', 'Unpaid invoices within terms.', (t) => t.invoiceStatus === 'unpaid', 'unpaid-invoices'),
      listReport('i-overdue', 'Overdue Invoices', 'Invoices past due date.', (t) => t.invoiceStatus === 'overdue', 'overdue-invoices'),
      {
        id: 'i-aging', title: 'Aging Receivables', desc: 'Outstanding balances by age bucket.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.outstanding > 0)
          const buckets = ['Current (0–30)', '31–60 days', '61–90 days', '90+ days']
          const agg = new Map<string, Agg>()
          for (const t of list) {
            const due = new Date(`${t.date}T12:00:00`); due.setDate(due.getDate() + 14)
            const overdueDays = Math.round((new Date(`${TODAY}T12:00:00`).getTime() - due.getTime()) / 864e5)
            const b = overdueDays <= 30 ? buckets[0] : overdueDays <= 60 ? buckets[1] : overdueDays <= 90 ? buckets[2] : buckets[3]
            const a = agg.get(b) ?? emptyAgg(); addTxn(a, t); agg.set(b, a)
          }
          const rows = buckets.filter((b) => agg.has(b)).map((b) => ({ group: b, invoices: num(agg.get(b)!.txns.length), outstanding: money2(agg.get(b)!.outstanding), __txns: agg.get(b)!.txns }))
          const total = list.reduce((s, t) => s + t.outstanding, 0)
          return {
            ...baseView(f, 'Aging Receivables', 'Outstanding balances by age bucket.', 'aging-receivables',
              [card('Total outstanding', money(total), RED), card('Open invoices', num(list.length), AMBER)],
              [{ key: 'group', label: 'Bucket' }, { key: 'invoices', label: 'Invoices', right: true }, { key: 'outstanding', label: 'Outstanding', right: true }], rows),
            chart: { kind: 'bar', data: rows.map((r) => ({ name: String(r.group), a: Math.round(agg.get(String(r.group))!.outstanding) })), aLabel: 'Outstanding' }, chartTitle: 'Receivables aging',
          }
        },
      },
      {
        id: 'i-ar', title: 'Accounts Receivable Summary', desc: 'Receivables per customer.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.outstanding > 0)
          const g = groupAgg(list, (t) => t.customer)
          const rows = [...g.entries()].sort((x, y) => y[1].outstanding - x[1].outstanding).map(([k, a]) => ({ group: k, invoices: num(a.txns.length), outstanding: money2(a.outstanding), __txns: a.txns }))
          const total = list.reduce((s, t) => s + t.outstanding, 0)
          return baseView(f, 'Accounts Receivable Summary', 'Receivables per customer.', 'ar-summary',
            [card('Total outstanding', money(total), RED), card('Debtors', num(g.size), AMBER)],
            [{ key: 'group', label: 'Customer' }, { key: 'invoices', label: 'Invoices', right: true }, { key: 'outstanding', label: 'Outstanding', right: true }], rows)
        },
      },
      {
        id: 'i-coll', title: 'Collection Efficiency Report', desc: 'Monthly collected vs invoiced.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            return { group: monthLabel(k), invoiced: money2(a.net), collected: money2(a.received), efficiency: pct(a.net ? (a.received / a.net) * 100 : 0), __txns: a.txns }
          })
          const a = totals(list)
          return {
            ...baseView(f, 'Collection Efficiency Report', 'Monthly collected vs invoiced.', 'collection-efficiency',
              [card('Invoiced', money(a.net), BLUE), card('Collected', money(a.received), GREEN), card('Efficiency', pct(a.net ? (a.received / a.net) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'invoiced', label: 'Invoiced', right: true }, { key: 'collected', label: 'Collected', right: true }, { key: 'efficiency', label: 'Efficiency', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.net), b: Math.round(g.get(k)!.received) })), aLabel: 'Invoiced', bLabel: 'Collected' }, chartTitle: 'Collected vs invoiced',
          }
        },
      },
      {
        id: 'i-hist', title: 'Customer Payment History', desc: 'Every payment received against invoices.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.received > 0 && t.invoiceStatus)
          const rows = list.sort((x, y) => y.date.localeCompare(x.date)).map((t) => ({ date: dmy(t.date), ref: t.id, customer: t.customer, method: t.method, invoiced: money2(t.net), paid: money2(t.received), balance: money2(t.outstanding), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Customer Payment History', 'Every payment received against invoices.', 'payment-history',
            [card('Payments', num(list.length), BLUE), card('Received', money(a.received), GREEN)],
            [{ key: 'date', label: 'Date' }, { key: 'ref', label: 'Ref' }, { key: 'customer', label: 'Customer' }, { key: 'method', label: 'Method' }, { key: 'invoiced', label: 'Invoiced', right: true }, { key: 'paid', label: 'Paid', right: true }, { key: 'balance', label: 'Balance', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'pay', title: 'Payment Reports',
    reports: [
      {
        id: 'p-coll', title: 'Payment Collection Report', desc: 'Collections per payment method.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.received > 0)
          const g = groupAgg(list, (t) => t.method)
          const rows = [...g.entries()].sort((x, y) => y[1].received - x[1].received).map(([k, a]) => ({ group: k, payments: num(a.txns.length), received: money2(a.received), share: pct(a.received ? (a.received / a.received) * 0 : 0), __txns: a.txns }))
          const total = list.reduce((s, t) => s + t.received, 0)
          for (const r of rows) {
            const a = g.get(String(r.group))!
            r.share = pct(total ? (a.received / total) * 100 : 0)
          }
          return {
            ...baseView(f, 'Payment Collection Report', 'Collections per payment method.', 'payment-collections',
              [card('Collected', money(total), GREEN), card('Methods', num(g.size), BLUE)],
              [{ key: 'group', label: 'Method' }, { key: 'payments', label: 'Payments', right: true }, { key: 'received', label: 'Collected', right: true }, { key: 'share', label: 'Share', right: true }], rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.received) })) }, chartTitle: 'Collections by method',
          }
        },
      },
      dimReport('p-method', 'Payments by Method', 'Revenue split by payment method.', (t) => t.method, 'payments-by-method'),
      listReport('p-cash', 'Cash Collections', 'Cash received.', (t) => t.method === 'Cash' && t.received > 0, 'cash-collections'),
      listReport('p-bank', 'Bank Collections', 'Bank transfers received.', (t) => t.method === 'Bank Transfer' && t.received > 0, 'bank-collections'),
      listReport('p-momo', 'Mobile Money Collections', 'Mobile money received.', (t) => t.method === 'Mobile Money' && t.received > 0, 'momo-collections'),
      listReport('p-cheque', 'Cheque Collections', 'Cheques received.', (t) => t.method === 'Cheque' && t.received > 0, 'cheque-collections'),
      {
        id: 'p-trend', title: 'Customer Payment Trends', desc: 'Monthly collections by method.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.received > 0)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort().slice(-12)
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const byMethod = new Map<string, number>()
            for (const t of a.txns) byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + t.received)
            const r: Row = { group: monthLabel(k), total: money2(a.received), __txns: a.txns }
            for (const m of PAY_METHODS) r[m] = money2(byMethod.get(m) ?? 0)
            return r
          })
          const total = list.reduce((s, t) => s + t.received, 0)
          return baseView(f, 'Customer Payment Trends', 'Monthly collections by method.', 'payment-trends',
            [card('Collected', money(total), GREEN)],
            [{ key: 'group', label: 'Month' }, ...PAY_METHODS.map((m) => ({ key: m, label: m, right: true })), { key: 'total', label: 'Total', right: true }], rows)
        },
      },
      periodReport('p-daily', 'Daily Collection Report', 'Collections received per day.', bucketDay, (k) => dmy(k), 'daily-collections'),
    ],
  },
  {
    id: 'ship', title: 'Shipment & Delivery Reports',
    reports: [
      {
        id: 's-sum', title: 'Shipment Summary', desc: 'Shipments by status.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.shipStatus)
          const g = groupAgg(list, (t) => t.shipStatus ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].txns.length - x[1].txns.length).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Shipment Summary', 'Shipments by status.', 'shipment-summary',
              [card('Shipments', num(list.length), BLUE), card('Delivered', num(a.delivered), GREEN), card('Delayed', num(a.late), RED)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: v.txns.length })) }, chartTitle: 'Shipments by status',
          }
        },
      },
      listReport('s-del', 'Orders Delivered', 'Delivered shipments.', (t) => t.shipStatus === 'delivered', 'orders-delivered'),
      listReport('s-pend', 'Orders Pending Delivery', 'Shipments still pending.', (t) => t.shipStatus === 'pending', 'pending-delivery'),
      {
        id: 's-perf', title: 'Delivery Performance', desc: 'On-time vs delayed deliveries per month.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.shipStatus === 'delivered')
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const onTime = a.txns.filter((t) => !t.late).length
            return { group: monthLabel(k), delivered: num(a.txns.length), onTime: num(onTime), rate: pct(a.txns.length ? (onTime / a.txns.length) * 100 : 0), __txns: a.txns }
          })
          const onTime = list.filter((t) => !t.late).length
          return {
            ...baseView(f, 'Delivery Performance', 'On-time vs delayed deliveries per month.', 'delivery-performance',
              [card('Delivered', num(list.length), GREEN), card('On-time', num(onTime), BLUE), card('On-time rate', pct(list.length ? (onTime / list.length) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'delivered', label: 'Delivered', right: true }, { key: 'onTime', label: 'On time', right: true }, { key: 'rate', label: 'On-time rate', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.rate)) })), aLabel: 'On-time %' }, chartTitle: 'On-time delivery trend',
          }
        },
      },
      listReport('s-delay', 'Delivery Delays', 'Late deliveries.', (t) => t.late, 'delivery-delays'),
      {
        id: 's-cost', title: 'Shipping Cost Analysis', desc: 'Shipping spend per branch.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.shipCost > 0)
          const g = groupAgg(list, (t) => t.branch)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, shipments: num(a.txns.length), cost: money2(a.shipCost), perShipment: money2(a.txns.length ? a.shipCost / a.txns.length : 0), __txns: a.txns }))
          const cost = list.reduce((s, t) => s + t.shipCost, 0)
          return {
            ...baseView(f, 'Shipping Cost Analysis', 'Shipping spend per branch.', 'shipping-cost',
              [card('Shipping spend', money(cost), AMBER), card('Shipments', num(list.length), BLUE)],
              [{ key: 'group', label: 'Branch' }, { key: 'shipments', label: 'Shipments', right: true }, { key: 'cost', label: 'Cost', right: true }, { key: 'perShipment', label: 'Per shipment', right: true }], rows),
            chart: { kind: 'bar', data: [...g.entries()].map(([k, v]) => ({ name: k, a: Math.round(v.shipCost) })), aLabel: 'Shipping cost' }, chartTitle: 'Shipping cost by branch',
          }
        },
      },
      {
        id: 's-eff', title: 'Fulfilment Efficiency', desc: 'Delivered share of ordered volume per month.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.channel === 'order')
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            return { group: monthLabel(k), orders: num(a.txns.length), delivered: num(a.delivered), efficiency: pct(a.txns.length ? (a.delivered / a.txns.length) * 100 : 0), __txns: a.txns }
          })
          const a = totals(list)
          return {
            ...baseView(f, 'Fulfilment Efficiency', 'Delivered share of ordered volume per month.', 'fulfilment-efficiency',
              [card('Orders', num(a.txns.length), BLUE), card('Delivered', num(a.delivered), GREEN), card('Efficiency', pct(a.txns.length ? (a.delivered / a.txns.length) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'orders', label: 'Orders', right: true }, { key: 'delivered', label: 'Delivered', right: true }, { key: 'efficiency', label: 'Efficiency', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: g.get(k)!.txns.length, b: g.get(k)!.delivered })), aLabel: 'Orders', bLabel: 'Delivered' }, chartTitle: 'Orders vs delivered',
          }
        },
      },
    ],
  },
  {
    id: 'ret', title: 'Sales Return Reports',
    reports: [
      {
        id: 'r-sum', title: 'Returns Summary', desc: 'Refunds and return value overview.',
        build: (f) => {
          const list = filterTxns(f)
          const a = totals(list)
          const net = a.net + a.returns
          const rows = list.filter((t) => t.refunded).sort((x, y) => y.date.localeCompare(x.date)).map(txnRow)
          return {
            ...baseView(f, 'Returns Summary', 'Refunds and return value overview.', 'returns-summary',
              [card('Returns', num(a.returnsCount), RED), card('Return value', money(a.returns), ROSE), card('Return %', pct(net ? (a.returns / net) * 100 : 0), AMBER), card('Net sales', money(a.net), GREEN)],
              TXN_COLS, rows),
            chart: { kind: 'line', data: monthlyReturns(list), aLabel: 'Returns ₵' }, chartTitle: 'Refund trend',
          }
        },
      },
      {
        id: 'r-prod', title: 'Returns by Product', desc: 'Returned units per product.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.refunded)
          const m = new Map<string, { qty: number; value: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.qty; cur.value += l.qty * l.unitPrice - l.discountAmt; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].value - x[1].value).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          const a = totals(list)
          return baseView(f, 'Returns by Product', 'Returned units per product.', 'returns-by-product',
            [card('Return value', money(a.returns), ROSE)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'r-cust', title: 'Returns by Customer', desc: 'Returned value per customer.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.refunded)
          const g = groupAgg(list, (t) => t.customer)
          const rows = [...g.entries()].sort((x, y) => y[1].returns - x[1].returns).map(([k, a]) => ({ group: k, returns: num(a.returnsCount), value: money2(a.returns), __txns: a.txns }))
          const a = totals(list)
          return baseView(f, 'Returns by Customer', 'Returned value per customer.', 'returns-by-customer',
            [card('Return value', money(a.returns), ROSE), card('Returns', num(a.returnsCount), RED)],
            [{ key: 'group', label: 'Customer' }, { key: 'returns', label: 'Returns', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'r-reasons', title: 'Return Reason Analysis', desc: 'Returns grouped by reason.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.refunded)
          const g = groupAgg(list, (t) => t.returnReason ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].returns - x[1].returns).map(([k, a]) => ({ group: k, returns: num(a.returnsCount), value: money2(a.returns), __txns: a.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Return Reason Analysis', 'Returns grouped by reason.', 'return-reasons',
              [card('Return value', money(a.returns), ROSE)],
              [{ key: 'group', label: 'Reason' }, { key: 'returns', label: 'Returns', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.returns) })) }, chartTitle: 'Returns by reason',
          }
        },
      },
      {
        id: 'r-pct', title: 'Return Percentage', desc: 'Returned value as a percentage of net sales, monthly.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const rate = (a.net + a.returns) > 0 ? (a.returns / (a.net + a.returns)) * 100 : 0
            return { group: monthLabel(k), net: money2(a.net), returns: money2(a.returns), rate: pct(rate), __txns: a.txns }
          })
          const a = totals(list)
          return {
            ...baseView(f, 'Return Percentage', 'Returned value as a percentage of net sales, monthly.', 'return-percentage',
              [card('Return %', pct((a.net + a.returns) ? (a.returns / (a.net + a.returns)) * 100 : 0), ROSE), card('Net sales', money(a.net), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'net', label: 'Net Sales', right: true }, { key: 'returns', label: 'Returns', right: true }, { key: 'rate', label: 'Return %', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => { const x = g.get(k)!; return { name: monthLabel(k), a: Math.round((x.net + x.returns) ? (x.returns / (x.net + x.returns)) * 100 : 0) } }), aLabel: 'Return %' }, chartTitle: 'Return % trend',
          }
        },
      },
      {
        id: 'r-trend', title: 'Refund Trend Analysis', desc: 'Monthly refund value trend.',
        build: (f) => {
          const list = filterTxns(f)
          const data = monthlyReturns(list)
          const g = groupAgg(list.filter((t) => t.refunded), bucketMonth)
          const rows = [...g.keys()].sort().map((k) => ({ group: monthLabel(k), returns: num(g.get(k)!.returnsCount), value: money2(g.get(k)!.returns), __txns: g.get(k)!.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Refund Trend Analysis', 'Monthly refund value trend.', 'refund-trend',
              [card('Refunds', money(a.returns), ROSE), card('Count', num(a.returnsCount), RED)],
              [{ key: 'group', label: 'Month' }, { key: 'returns', label: 'Refunds', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'area', data, aLabel: 'Refunds ₵' }, chartTitle: 'Refund trend',
          }
        },
      },
      {
        id: 'r-quality', title: 'Quality Issue Tracking', desc: 'Returns caused by defective or quality issues, per product.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.refunded && (t.returnReason === 'Defective' || t.returnReason === 'Quality issue'))
          const m = new Map<string, { qty: number; value: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.qty; cur.value += l.qty * l.unitPrice - l.discountAmt; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].value - x[1].value).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          const a = totals(list)
          return baseView(f, 'Quality Issue Tracking', 'Returns caused by defective or quality issues, per product.', 'quality-issues',
            [card('Quality returns', num(a.returnsCount), RED), card('Value', money(a.returns), ROSE)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'disc', title: 'Discount & Promotion Reports',
    reports: [
      {
        id: 'd-sum', title: 'Discount Summary', desc: 'Discounts given, monthly.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), gross: money2(a.gross), discount: money2(a.discount), net: money2(a.net), rate: pct(a.gross ? (a.discount / a.gross) * 100 : 0), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Discount Summary', 'Discounts given, monthly.', 'discount-summary',
              [card('Discounts', money(a.discount), AMBER), card('Discount rate', pct(a.gross ? (a.discount / a.gross) * 100 : 0), ROSE), card('Net sales', money(a.net), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'gross', label: 'Gross', right: true }, { key: 'discount', label: 'Discounts', right: true }, { key: 'net', label: 'Net', right: true }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.discount) })), aLabel: 'Discounts ₵' }, chartTitle: 'Monthly discounts',
          }
        },
      },
      {
        id: 'd-prod', title: 'Discounts by Product', desc: 'Discount value per product.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, { disc: number; qty: number; txns: Txn[] }>()
          for (const t of list) for (const l of t.lines) if (l.discountAmt > 0) {
            const cur = m.get(l.productId) ?? { disc: 0, qty: 0, txns: [] }
            cur.disc += l.discountAmt; cur.qty += l.qty; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].disc - x[1].disc).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), discount: money2(v.disc), __txns: v.txns }))
          const a = totals(list)
          return baseView(f, 'Discounts by Product', 'Discount value per product.', 'discounts-by-product',
            [card('Total discounts', money(a.discount), AMBER)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Disc. Lines', right: true }, { key: 'discount', label: 'Discount', right: true }], rows)
        },
      },
      {
        id: 'd-cust', title: 'Discounts by Customer', desc: 'Discount value per customer.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.customer)
          const rows = [...g.entries()].filter(([, a]) => a.discount > 0).sort((x, y) => y[1].discount - x[1].discount)
            .map(([k, a]) => ({ group: k, orders: num(a.orders), discount: money2(a.discount), net: money2(a.net), __txns: a.txns }))
          const a = totals(list)
          return baseView(f, 'Discounts by Customer', 'Discount value per customer.', 'discounts-by-customer',
            [card('Total discounts', money(a.discount), AMBER)],
            [{ key: 'group', label: 'Customer' }, { key: 'orders', label: 'Orders', right: true }, { key: 'discount', label: 'Discount', right: true }, { key: 'net', label: 'Net', right: true }], rows)
        },
      },
      {
        id: 'd-promo', title: 'Promotion Effectiveness', desc: 'Revenue generated per ₵1 of discount, by campaign.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.campaign)
          const g = groupAgg(list, (t) => t.campaign ?? '—')
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, orders: num(a.orders), discount: money2(a.discount), net: money2(a.net), efficiency: `₵${(a.discount > 0 ? a.net / a.discount : 0).toFixed(2)} / ₵1`, __txns: a.txns }))
            .sort((x, y) => String(y.net).localeCompare(String(x.net)))
          const a = totals(list)
          return baseView(f, 'Promotion Effectiveness', 'Revenue generated per ₵1 of discount, by campaign.', 'promotion-effectiveness',
            [card('Promo sales', money(a.net), GREEN), card('Promo discounts', money(a.discount), AMBER)],
            [{ key: 'group', label: 'Campaign' }, { key: 'orders', label: 'Orders', right: true }, { key: 'discount', label: 'Discount', right: true }, { key: 'net', label: 'Net', right: true }, { key: 'efficiency', label: 'Revenue / ₵1 disc.', right: true }], rows)
        },
      },
      {
        id: 'd-impact', title: 'Discount Impact on Revenue', desc: 'Monthly gross vs net vs discounts.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), gross: money2(a.gross), discount: money2(a.discount), net: money2(a.net), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Discount Impact on Revenue', 'Monthly gross vs net vs discounts.', 'discount-impact',
              [card('Gross', money(a.gross), BLUE), card('Discounts', money(a.discount), AMBER), card('Net', money(a.net), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'gross', label: 'Gross', right: true }, { key: 'discount', label: 'Discounts', right: true }, { key: 'net', label: 'Net', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.gross), b: Math.round(g.get(k)!.net) })), aLabel: 'Gross', bLabel: 'Net' }, chartTitle: 'Gross vs net revenue',
          }
        },
      },
      {
        id: 'd-coupon', title: 'Coupon Usage Analysis', desc: 'How often each campaign code was used.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.campaign)
          const m = new Map<string, { uses: number; disc: number; txns: Txn[] }>()
          for (const t of list) {
            const cur = m.get(t.campaign!) ?? { uses: 0, disc: 0, txns: [] }
            cur.uses++; cur.disc += t.discount; cur.txns.push(t)
            m.set(t.campaign!, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].uses - x[1].uses).map(([k, v]) => ({ group: k, uses: num(v.uses), discount: money2(v.disc), __txns: v.txns }))
          return {
            ...baseView(f, 'Coupon Usage Analysis', 'How often each campaign code was used.', 'coupon-usage',
              [card('Codes used', num(m.size), BLUE), card('Redemptions', num(list.length), GREEN)],
              [{ key: 'group', label: 'Code' }, { key: 'uses', label: 'Uses', right: true }, { key: 'discount', label: 'Discount', right: true }], rows),
            chart: { kind: 'pie', data: [...m.entries()].map(([k, v]) => ({ name: k, value: v.uses })) }, chartTitle: 'Redemptions by code',
          }
        },
      },
      {
        id: 'd-camp', title: 'Campaign Performance', desc: 'Orders, discounts and profit per campaign.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.campaign)
          const g = groupAgg(list, (t) => t.campaign ?? '—')
          const rows = [...g.entries()].map(([k, a]) => aggRow(k, a)).sort((x, y) => parseFloat(String(y.net).replace(/[₵,]/g, '')) - parseFloat(String(x.net).replace(/[₵,]/g, '')))
          const a = totals(list)
          return baseView(f, 'Campaign Performance', 'Orders, discounts and profit per campaign.', 'campaign-performance',
            [card('Campaign sales', money(a.net), GREEN), card('Profit', money(a.profit), VIOLET)], STD_COLS, rows)
        },
      },
    ],
  },
  {
    id: 'profit', title: 'Profitability Reports',
    reports: [
      periodReport('pr-gross', 'Gross Profit Report', 'Monthly gross profit.', bucketMonth, monthLabel, 'gross-profit'),
      {
        id: 'pr-net', title: 'Net Profit Analysis', desc: 'Gross profit less estimated operating expenses (18% of net).',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const opex = a.net * 0.18
            return { group: monthLabel(k), gross: money2(a.profit), opex: money2(opex), net: money2(a.profit - opex), margin: pct(a.net ? ((a.profit - opex) / a.net) * 100 : 0), __txns: a.txns }
          })
          const a = totals(list)
          const netP = a.profit - a.net * 0.18
          return {
            ...baseView(f, 'Net Profit Analysis', 'Gross profit less estimated operating expenses (18% of net).', 'net-profit',
              [card('Gross profit', money(a.profit), GREEN), card('OpEx (est.)', money(a.net * 0.18), AMBER), card('Net profit', money(netP), VIOLET)],
              [{ key: 'group', label: 'Month' }, { key: 'gross', label: 'Gross Profit', right: true }, { key: 'opex', label: 'OpEx', right: true }, { key: 'net', label: 'Net Profit', right: true }, { key: 'margin', label: 'Net Margin', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.profit), b: Math.round(g.get(k)!.profit - g.get(k)!.net * 0.18) })), aLabel: 'Gross', bLabel: 'Net' }, chartTitle: 'Gross vs net profit',
          }
        },
      },
      {
        id: 'pr-margin', title: 'Sales Margin Report', desc: 'Monthly gross margin %.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), net: money2(a.net), profit: money2(a.profit), margin: pct(margin(a)), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Sales Margin Report', 'Monthly gross margin %.', 'sales-margin',
              [card('Margin', pct(margin(a)), VIOLET), card('Profit', money(a.profit), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'net', label: 'Net', right: true }, { key: 'profit', label: 'Profit', right: true }, { key: 'margin', label: 'Margin', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(margin(g.get(k)!)) })), aLabel: 'Margin %' }, chartTitle: 'Margin trend',
          }
        },
      },
      dimReport('pr-prod', 'Product Profitability', 'Profit per product.', (t) => productName(t.lines[0]?.productId ?? ''), 'product-profitability-2'),
      dimReport('pr-cust', 'Customer Profitability', 'Profit per customer.', (t) => t.customer, 'customer-profitability'),
      dimReport('pr-cat', 'Category Profitability', 'Profit per category.', (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—', 'category-profitability'),
      dimReport('pr-branch', 'Branch Profitability', 'Profit per branch.', (t) => t.branch, 'branch-profitability', 'bar'),
    ],
  },
  {
    id: 'graph', title: 'Graphical Analytics',
    reports: [
      chartReport('g-trend', 'Sales Trend Line Chart', 'Monthly net sales & profit trend.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.net), b: Math.round(g.get(k)!.profit) })), aLabel: 'Net Sales', bLabel: 'Profit' }, chartTitle: 'Sales trend' }
      }),
      chartReport('g-growth', 'Revenue Growth Chart', 'Month-over-month growth %.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'area', data: keys.map((k, i) => ({ name: monthLabel(k), a: i ? Math.round(((g.get(k)!.net - g.get(keys[i - 1])!.net) / (g.get(keys[i - 1])!.net || 1)) * 100) : 0 })), aLabel: 'Growth %' }, chartTitle: 'Revenue growth' }
      }),
      chartReport('g-bar', 'Monthly Sales Bar Chart', 'Monthly net sales bars.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.net) })), aLabel: 'Net Sales' }, chartTitle: 'Monthly sales' }
      }),
      chartReport('g-prod', 'Product Performance Chart', 'Top 10 products by revenue & profit.', (f) => {
        const m = new Map<string, { net: number; profit: number }>()
        for (const t of filterTxns(f)) for (const l of t.lines) {
          const cur = m.get(l.productId) ?? { net: 0, profit: 0 }
          const ln = l.qty * l.unitPrice - l.discountAmt
          cur.net += ln; cur.profit += ln - l.qty * l.unitCost
          m.set(l.productId, cur)
        }
        const top = [...m.entries()].sort((x, y) => y[1].net - x[1].net).slice(0, 10)
        return { chart: { kind: 'bar', data: top.map(([k, v]) => ({ name: productName(k), a: Math.round(v.net), b: Math.round(v.profit) })), aLabel: 'Revenue', bLabel: 'Profit' }, chartTitle: 'Product performance' }
      }),
      chartReport('g-acq', 'Customer Acquisition Chart', 'New customers per month (first purchase).', (f) => {
        const first = new Map<string, string>()
        for (const t of [...TXNS].sort((x, y) => x.date.localeCompare(y.date))) if (!first.has(t.customer)) first.set(t.customer, t.date.slice(0, 7))
        const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
        const m = new Map<string, number>()
        for (const d of first.values()) if (`${d}-01` >= r.start && `${d}-01` <= r.end) m.set(d, (m.get(d) ?? 0) + 1)
        const keys = [...m.keys()].sort()
        return { chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: m.get(k)! })), aLabel: 'New customers' }, chartTitle: 'Customer acquisition' }
      }),
      chartReport('g-cat', 'Sales by Category Pie Chart', 'Revenue share per category.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—')
        return { chart: { kind: 'pie', data: [...g.entries()].sort((x, y) => y[1].net - x[1].net).map(([k, v]) => ({ name: k, value: Math.round(v.net) })) }, chartTitle: 'Sales by category' }
      }),
      chartReport('g-method', 'Payment Method Analysis', 'Collections share per method.', (f) => {
        const g = groupAgg(filterTxns(f).filter((t) => t.received > 0), (t) => t.method)
        return { chart: { kind: 'pie', data: [...g.entries()].sort((x, y) => y[1].received - x[1].received).map(([k, v]) => ({ name: k, value: Math.round(v.received) })) }, chartTitle: 'Collections by method' }
      }),
      chartReport('g-topcust', 'Top 10 Customers Chart', 'Highest-spending customers.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => t.customer)
        const top = [...g.entries()].sort((x, y) => y[1].net - x[1].net).slice(0, 10)
        return { chart: { kind: 'bar', data: top.map(([k, v]) => ({ name: k, a: Math.round(v.net) })), aLabel: 'Net Sales' }, chartTitle: 'Top 10 customers' }
      }),
      chartReport('g-topprod', 'Top 10 Products Chart', 'Best sellers by units.', (f) => {
        const m = new Map<string, number>()
        for (const t of filterTxns(f)) for (const l of t.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty)
        const top = [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10)
        return { chart: { kind: 'bar', data: top.map(([k, v]) => ({ name: productName(k), a: v })), aLabel: 'Units' }, chartTitle: 'Top 10 products' }
      }),
      chartReport('g-sp', 'Salesperson Performance Dashboard', 'Revenue & profit per salesperson.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => t.salesperson)
        return { chart: { kind: 'bar', data: [...g.entries()].sort((x, y) => y[1].net - x[1].net).map(([k, v]) => ({ name: k, a: Math.round(v.net), b: Math.round(v.profit) })), aLabel: 'Net Sales', bLabel: 'Profit' }, chartTitle: 'Salesperson performance' }
      }),
      chartReport('g-geo', 'Geographic Sales Distribution', 'Revenue share per branch location.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => t.branch)
        return { chart: { kind: 'pie', data: [...g.entries()].sort((x, y) => y[1].net - x[1].net).map(([k, v]) => ({ name: k, value: Math.round(v.net) })) }, chartTitle: 'Sales by location' }
      }),
      chartReport('g-fulfil', 'Order Fulfilment Dashboard', 'Orders vs delivered per month.', (f) => {
        const g = groupAgg(filterTxns(f).filter((t) => t.channel === 'order'), bucketMonth)
        const keys = [...g.keys()].sort()
        return { chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: g.get(k)!.txns.length, b: g.get(k)!.delivered })), aLabel: 'Orders', bLabel: 'Delivered' }, chartTitle: 'Fulfilment' }
      }),
    ],
  },
]

// ---------------- helpers referenced above ----------------
function dmyIso(d: Date): string { return d.toISOString().slice(0, 10) }

function groupQuotes(quotes: Quote[]): Map<string, { total: number; converted: number }> {
  const g = new Map<string, { total: number; converted: number }>()
  for (const q of quotes) {
    const c = g.get(q.salesperson) ?? { total: 0, converted: 0 }
    c.total++
    if (q.status === 'converted') c.converted++
    g.set(q.salesperson, c)
  }
  return g
}

function quoteView(f: SaleFilters, title: string, pred: (q: Quote) => boolean, exportName: string): ReportView {
  const quotes = filterQuotes(f).filter(pred)
  const value = quotes.reduce((s, q) => s + q.value, 0)
  const rows: Row[] = [...quotes].sort((a, b) => b.date.localeCompare(a.date)).map((q) => ({ id: q.id, date: dmy(q.date), kind: q.kind, customer: q.customer, salesperson: q.salesperson, status: q.status, value: money2(q.value) }))
  const byStatus = new Map<string, number>()
  for (const q of quotes) byStatus.set(q.status, (byStatus.get(q.status) ?? 0) + 1)
  return {
    ...baseView(f, title, title, exportName, [
      card('Count', num(quotes.length), BLUE), card('Value', money(value), GREEN),
    ], Q_COLS, rows),
    chart: { kind: 'pie', data: [...byStatus.entries()].map(([k, v]) => ({ name: k, value: v })) }, chartTitle: 'By status',
  }
}

function monthlyReturns(list: Txn[]): { name: string; a: number }[] {
  const m = new Map<string, number>()
  for (const t of list) if (t.refunded) m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) + t.net)
  return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([k, v]) => ({ name: monthLabel(k), a: Math.round(v) }))
}

function chartReport(id: string, title: string, desc: string, fn: (f: SaleFilters) => { chart: ChartSpec; chartTitle: string; cols?: Col[]; rows?: Row[]; metrics?: MetricCard[] }): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const r = fn(f)
      const a = totals(filterTxns(f))
      return {
        ...baseView(f, title, desc, id, r.metrics ?? [card('Net Sales', money(a.net), BLUE), card('Orders', num(a.orders), GREEN)], r.cols ?? [], r.rows ?? []),
        chart: r.chart, chartTitle: r.chartTitle,
      }
    },
  }
}
