// Purchase Reports registry — 15 sections of report definitions on the
// purchaseAnalytics engine. Mirrors the Sales Reports ReportView contract.

import {
  PTXNS, REQS, SUPPLIERS, BRANCHES, WAREHOUSES, DEPARTMENTS, BUYERS, PAY_METHODS, STOCK,
  filterTxns, groupAgg, emptyAgg, addTxn, totals, paymentStatusOf, stockOf, supplierDim,
  type PurTxn, type PurAgg, type PurchaseFilters,
  bucketDay, bucketWeek, bucketMonth, bucketQuarter, bucketYear,
  productName, productDim, PRODUCTS,
} from './purchaseAnalytics'
import { money, money2, num, pct, dmy, monthLabel, presetRange, TODAY } from './salesAnalytics'

export interface MetricCard { label: string; value: string; sub?: string; color: string }
export interface Col { key: string; label: string; right?: boolean }
export type ChartSpec =
  | { kind: 'line' | 'bar' | 'area'; data: { name: string; a: number; b?: number }[]; aLabel: string; bLabel?: string }
  | { kind: 'pie'; data: { name: string; value: number }[] }
export type Row = { [key: string]: string | number | PurTxn[] | undefined }
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
export interface ReportDef { id: string; title: string; desc: string; build: (f: PurchaseFilters) => ReportView }
export interface ReportSection { id: string; title: string; reports: ReportDef[] }

export const BLUE = '#2563eb', GREEN = '#059669', RED = '#e11d48', AMBER = '#d97706', VIOLET = '#7c3aed', SKY = '#0284c7', LIME = '#65a30d', ROSE = '#be123c'

export function filtersLine(f: PurchaseFilters): string {
  const parts: string[] = []
  const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  parts.push(`Period: ${dmy(r.start)} – ${dmy(r.end)}${f.preset !== 'custom' ? ` (${f.preset})` : ''}`)
  if (f.branch) parts.push(`Branch: ${f.branch}`)
  if (f.warehouse) parts.push(`Warehouse: ${f.warehouse}`)
  if (f.supplier) parts.push(`Supplier: ${f.supplier}`)
  if (f.product) parts.push(`Product: ${productName(f.product)}`)
  if (f.category) parts.push(`Category: ${f.category}`)
  if (f.brand) parts.push(`Brand: ${f.brand}`)
  if (f.poStatus) parts.push(`PO status: ${f.poStatus}`)
  if (f.invoiceStatus) parts.push(`Invoice status: ${f.invoiceStatus}`)
  if (f.paymentStatus) parts.push(`Payment status: ${f.paymentStatus}`)
  if (f.reqStatus) parts.push(`Requisition status: ${f.reqStatus}`)
  return parts.join('  ·  ')
}

const STD_COLS: Col[] = [
  { key: 'group', label: 'Group' },
  { key: 'pos', label: 'POs', right: true },
  { key: 'qty', label: 'Qty', right: true },
  { key: 'gross', label: 'Goods Value', right: true },
  { key: 'charges', label: 'Charges', right: true },
  { key: 'landed', label: 'Landed Cost', right: true },
  { key: 'savings', label: 'Savings', right: true },
]
const aggRow = (group: string, a: PurAgg): Row => ({
  group, pos: num(a.pos), qty: num(a.qty), gross: money2(a.gross), charges: money2(a.charges),
  landed: money2(a.landed), savings: money2(a.savings), __txns: a.txns,
})
const card = (label: string, value: string, color: string, sub?: string): MetricCard => ({ label, value, color, sub })

function baseView(f: PurchaseFilters, title: string, desc: string, exportName: string, metrics: MetricCard[], cols: Col[], rows: Row[]): ReportView {
  return { title, desc, metrics, cols, rows, exportName, filtersLine: filtersLine(f) }
}

const PO_COLS: Col[] = [
  { key: 'id', label: 'PO Ref' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' },
  { key: 'branch', label: 'Branch' }, { key: 'buyer', label: 'Buyer' }, { key: 'method', label: 'Method' },
  { key: 'poStatus', label: 'PO Status' }, { key: 'invoice', label: 'Invoice' },
  { key: 'landed', label: 'Landed', right: true }, { key: 'paid', label: 'Paid', right: true }, { key: 'outstanding', label: 'Balance', right: true },
]
const poRow = (t: PurTxn): Row => ({
  id: t.id, date: dmy(t.date), supplier: t.supplier, branch: t.branch, buyer: t.buyer, method: t.method,
  poStatus: t.poStatus, invoice: t.invoiceStatus ?? '—', landed: money2(t.landed), paid: money2(t.paid),
  outstanding: money2(t.outstanding), __txns: [t],
})

function periodReport(id: string, title: string, desc: string, bucket: (t: PurTxn) => string, label: (k: string) => string, exportName: string): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f)
      const g = groupAgg(list, bucket)
      const keys = [...g.keys()].sort()
      const rows = keys.map((k) => aggRow(label(k), g.get(k)!))
      const a = totals(list)
      return {
        ...baseView(f, title, desc, exportName, [
          card('Landed Cost', money(a.landed), BLUE), card('POs', num(a.pos), GREEN),
          card('Savings', money(a.savings), LIME), card('Outstanding', money(a.outstanding), RED),
        ], STD_COLS, rows),
        chart: { kind: 'bar', data: keys.slice(-24).map((k) => ({ name: label(k), a: Math.round(g.get(k)!.landed), b: Math.round(g.get(k)!.gross) })), aLabel: 'Landed', bLabel: 'Goods value' },
        chartTitle: `${title} — spend`,
      }
    },
  }
}

function dimReport(id: string, title: string, desc: string, key: (t: PurTxn) => string, exportName: string, chart: 'pie' | 'bar' = 'pie', top = 10): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f)
      const g = groupAgg(list, key)
      const keys = [...g.keys()].sort((x, y) => g.get(y)!.landed - g.get(x)!.landed)
      const rows = keys.map((k) => aggRow(k, g.get(k)!))
      const a = totals(list)
      const topKeys = keys.slice(0, top)
      return {
        ...baseView(f, title, desc, exportName, [
          card('Landed Cost', money(a.landed), BLUE), card('Groups', num(keys.length), GREEN),
          card('Avg / Group', money(keys.length ? a.landed / keys.length : 0), AMBER), card('Savings', money(a.savings), LIME),
        ], STD_COLS, rows),
        chart: chart === 'pie'
          ? { kind: 'pie', data: topKeys.map((k) => ({ name: k, value: Math.round(g.get(k)!.landed) })) }
          : { kind: 'bar', data: topKeys.map((k) => ({ name: k, a: Math.round(g.get(k)!.landed), b: Math.round(g.get(k)!.gross) })), aLabel: 'Landed', bLabel: 'Goods value' },
        chartTitle: `Top ${topKeys.length} by landed cost`,
      }
    },
  }
}

function listReport(id: string, title: string, desc: string, pred: (t: PurTxn) => boolean, exportName: string, extraMetrics?: (a: PurAgg) => MetricCard[]): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const list = filterTxns(f).filter(pred).sort((x, y) => y.date.localeCompare(x.date))
      const a = totals(list)
      const metrics = [
        card('Records', num(list.length), BLUE), card('Landed Cost', money(a.landed), GREEN),
        card('Paid', money(a.paid), SKY), card('Outstanding', money(a.outstanding), RED),
      ]
      if (extraMetrics) metrics.push(...extraMetrics(a))
      return baseView(f, title, desc, exportName, metrics, PO_COLS, list.map(poRow))
    },
  }
}

function chartReport(id: string, title: string, desc: string, fn: (f: PurchaseFilters) => { chart: ChartSpec; chartTitle: string; cols?: Col[]; rows?: Row[]; metrics?: MetricCard[] }): ReportDef {
  return {
    id, title, desc,
    build: (f) => {
      const r = fn(f)
      const a = totals(filterTxns(f))
      return {
        ...baseView(f, title, desc, id, r.metrics ?? [card('Landed Cost', money(a.landed), BLUE), card('POs', num(a.pos), GREEN)], r.cols ?? [], r.rows ?? []),
        chart: r.chart, chartTitle: r.chartTitle,
      }
    },
  }
}

// ---------------- sections ----------------
export const SECTIONS: ReportSection[] = [
  {
    id: 'exec', title: 'Executive Procurement Dashboard',
    reports: [{
      id: 'exec', title: 'Executive Procurement Dashboard', desc: 'Company-wide procurement health: KPIs, trends, top suppliers and daily summary.',
      build: (f) => {
        const list = filterTxns(f)
        const a = totals(list)
        const openPOs = list.filter((t) => t.poStatus === 'open' || t.poStatus === 'pending' || t.poStatus === 'partial')
        const openValue = openPOs.reduce((s, t) => s + t.landed, 0)
        const grnValue = list.filter((t) => t.grn).reduce((s, t) => s + t.landed, 0)
        const avgLead = a.leadCount ? a.leadSum / a.leadCount : 0
        const efficiency = Math.round((a.onTime / Math.max(1, a.onTime + a.late)) * 70 + (a.savings / Math.max(1, a.landed)) * 100 + (1 - a.returns / Math.max(1, a.gross)) * 30)
        const byMonth = groupAgg(list, bucketMonth)
        const months = [...byMonth.keys()].sort()
        const byDay = groupAgg(list, bucketDay)
        const days = [...byDay.keys()].sort().reverse()
        const supAgg = groupAgg(list, (t) => t.supplier)
        const topS = [...supAgg.entries()].sort((x, y) => y[1].landed - x[1].landed).slice(0, 8)
        const prodAgg = new Map<string, { qty: number; value: number }>()
        for (const t of list) for (const l of t.lines) {
          const cur = prodAgg.get(l.productId) ?? { qty: 0, value: 0 }
          cur.qty += l.qty; cur.value += l.qty * l.unitCost
          prodAgg.set(l.productId, cur)
        }
        const topP = [...prodAgg.entries()].sort((x, y) => y[1].value - x[1].value).slice(0, 8)
        const NAME_COLS: Col[] = [{ key: 'group', label: 'Name' }, { key: 'pos', label: 'POs', right: true }, { key: 'landed', label: 'Landed Cost', right: true }]
        return {
          ...baseView(f, 'Executive Procurement Dashboard', 'Company-wide procurement health: KPIs, trends, top suppliers and daily summary.', 'executive-procurement-dashboard', [
            card('Total Purchases', money(a.gross), BLUE, 'goods value'),
            card('Procurement Cost', money(a.landed), VIOLET, 'landed incl. charges'),
            card('Outstanding POs', money(openValue), AMBER, `${openPOs.length} open`),
            card('Goods Received', money(grnValue), GREEN, 'GRN value'),
            card('Payments Made', money(a.paid), SKY),
            card('Supplier Balances', money(a.outstanding), RED, 'outstanding'),
            card('Purchase Returns', money(a.returns), ROSE, `${a.returnsCount} returns`),
            card('Avg PO Cost', money(a.pos ? a.landed / a.pos : 0), LIME),
            card('Savings', money(a.savings), LIME, 'negotiated vs list'),
            card('Suppliers', num(new Set(list.map((t) => t.supplier)).size), SKY),
            card('Avg Lead Time', `${avgLead.toFixed(1)}d`, AMBER),
            card('Efficiency Score', String(efficiency), GREEN, 'composite KPI'),
          ], [
            { key: 'date', label: 'Date' }, { key: 'pos', label: 'POs', right: true }, { key: 'qty', label: 'Qty', right: true },
            { key: 'gross', label: 'Goods Value', right: true }, { key: 'landed', label: 'Landed', right: true },
            { key: 'paid', label: 'Paid', right: true }, { key: 'outstanding', label: 'Balance', right: true },
          ], days.slice(0, 31).map((d) => {
            const g = byDay.get(d)!
            return { date: dmy(d), pos: num(g.pos), qty: num(g.qty), gross: money2(g.gross), landed: money2(g.landed), paid: money2(g.paid), outstanding: money2(g.outstanding), __txns: g.txns }
          })),
          chart: { kind: 'line', data: months.map((m) => ({ name: monthLabel(m), a: Math.round(byMonth.get(m)!.landed), b: Math.round(byMonth.get(m)!.paid) })), aLabel: 'Landed Cost', bLabel: 'Payments' },
          chartTitle: 'Monthly Purchase Trends',
          extra: [
            { label: 'Top Suppliers', cols: NAME_COLS, rows: topS.map(([k, v]) => ({ group: k, pos: num(v.pos), landed: money2(v.landed) })) },
            { label: 'Top Purchased Products', cols: [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'landed', label: 'Value', right: true }], rows: topP.map(([id, v]) => ({ group: productName(id), qty: num(v.qty), landed: money2(v.value) })) },
          ],
        }
      },
    }],
  },
  {
    id: 'overview', title: 'Purchase Overview Reports',
    reports: [
      {
        id: 'ov-sum', title: 'Purchase Summary Report', desc: 'High-level spend by supplier.',
        build: (f) => dimReport('x', 'Purchase Summary Report', 'High-level spend by supplier.', (t) => t.supplier, 'purchase-summary', 'bar').build(f),
      },
      {
        id: 'ov-detail', title: 'Purchase Detail Report', desc: 'Line-level purchase detail.',
        build: (f) => {
          const list = filterTxns(f)
          const rows: Row[] = []
          for (const t of list) for (const l of t.lines) {
            const p = productDim(l.productId)
            rows.push({
              date: dmy(t.date), ref: t.id, supplier: t.supplier, product: p?.name ?? l.productId,
              category: p?.category ?? '—', qty: num(l.qty), unit: money2(l.unitCost), value: money2(l.qty * l.unitCost),
              received: num(l.receivedQty), __txns: [t],
            })
          }
          rows.sort((x, y) => String(y.date).localeCompare(String(x.date)))
          const a = totals(list)
          return baseView(f, 'Purchase Detail Report', 'Line-level purchase detail.', 'purchase-detail',
            [card('Lines', num(rows.length), BLUE), card('Goods Value', money(a.gross), GREEN), card('Landed', money(a.landed), VIOLET)],
            [{ key: 'date', label: 'Date' }, { key: 'ref', label: 'PO' }, { key: 'supplier', label: 'Supplier' }, { key: 'product', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty', right: true }, { key: 'unit', label: 'Unit Cost', right: true }, { key: 'value', label: 'Value', right: true }, { key: 'received', label: 'Received', right: true }],
            rows)
        },
      },
      periodReport('ov-day', 'Daily Purchases', 'Purchases per day.', bucketDay, (k) => dmy(k), 'daily-purchases'),
      periodReport('ov-week', 'Weekly Purchases', 'Purchases per ISO week.', bucketWeek, (k) => k, 'weekly-purchases'),
      periodReport('ov-month', 'Monthly Purchases', 'Purchases per month.', bucketMonth, monthLabel, 'monthly-purchases'),
      periodReport('ov-quarter', 'Quarterly Purchases', 'Purchases per quarter.', bucketQuarter, (k) => k, 'quarterly-purchases'),
      periodReport('ov-year', 'Annual Purchases', 'Purchases per year.', bucketYear, (k) => k, 'annual-purchases'),
      {
        id: 'ov-compare', title: 'Purchase Comparison Report', desc: 'This year vs last year, month by month.',
        build: (f) => {
          const list = filterTxns(f)
          const years = [...new Set(list.map((t) => t.date.slice(0, 4)))].sort().slice(-2)
          const [y1, y2] = years.length === 2 ? years : [years[0] ?? '2025', years[0] ?? '2025']
          const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
          const sum = (year: string, m: string) => list.filter((t) => t.date.startsWith(`${year}-${m}`)).reduce((s, t) => s + t.landed, 0)
          const rows = months.map((m) => ({ group: monthLabel(`2026-${m}`), [y1]: money2(sum(y1, m)), [y2]: money2(sum(y2, m)), change: sum(y1, m) > 0 ? pct(((sum(y2, m) - sum(y1, m)) / sum(y1, m)) * 100) : '—' }))
          const a = totals(list)
          return {
            ...baseView(f, 'Purchase Comparison Report', 'This year vs last year, month by month.', 'purchase-comparison',
              [card('Landed Cost', money(a.landed), BLUE), card('Years', `${y1} vs ${y2}`, GREEN)],
              [{ key: 'group', label: 'Month' }, { key: y1, label: y1, right: true }, { key: y2, label: y2, right: true }, { key: 'change', label: 'Change', right: true }], rows),
            chart: { kind: 'bar', data: months.map((m) => ({ name: monthLabel(`2026-${m}`), a: Math.round(sum(y1, m)), b: Math.round(sum(y2, m)) })), aLabel: y1, bLabel: y2 },
            chartTitle: 'Year-over-year spend',
          }
        },
      },
      {
        id: 'ov-growth', title: 'Procurement Growth Analysis', desc: 'Month-over-month spend growth.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k, i) => {
            const prevNet = i > 0 ? g.get(keys[i - 1])!.landed : 0
            return { group: monthLabel(k), landed: money2(g.get(k)!.landed), growth: pct(prevNet > 0 ? ((g.get(k)!.landed - prevNet) / prevNet) * 100 : 0), __txns: g.get(k)!.txns }
          })
          const a = totals(list)
          return {
            ...baseView(f, 'Procurement Growth Analysis', 'Month-over-month spend growth.', 'procurement-growth',
              [card('Landed Cost', money(a.landed), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'landed', label: 'Landed', right: true }, { key: 'growth', label: 'MoM Growth', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k, i) => ({ name: monthLabel(k), a: i > 0 ? Math.round(((g.get(k)!.landed - g.get(keys[i - 1])!.landed) / (g.get(keys[i - 1])!.landed || 1)) * 100) : 0 })), aLabel: 'Growth %' },
            chartTitle: 'MoM growth %',
          }
        },
      },
    ],
  },
  {
    id: 'req', title: 'Purchase Requisition Reports',
    reports: [
      {
        id: 'rq-sum', title: 'Requisition Summary', desc: 'Requisitions by status (incl. non-converted).',
        build: (f) => {
          const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
          const reqs = [...REQS, ...PTXNS.map((t) => ({ id: t.reqId, date: t.reqDate, department: t.department, employee: t.buyer, supplier: t.supplier, status: t.reqStatus, approvalDays: t.approvalDays, value: t.gross, converted: true }))]
            .filter((q) => q.date >= r.start && q.date <= r.end && (!f.reqStatus || q.status === f.reqStatus) && (!f.supplier || q.supplier === f.supplier))
          const by = new Map<string, number>()
          for (const q of reqs) by.set(q.status, (by.get(q.status) ?? 0) + 1)
          const rows = [...by.entries()].map(([k, v]) => ({ group: k, count: num(v), share: pct(reqs.length ? (v / reqs.length) * 100 : 0) }))
          return {
            ...baseView(f, 'Requisition Summary', 'Requisitions by status (incl. non-converted).', 'requisition-summary',
              [card('Requisitions', num(reqs.length), BLUE), card('Approved', num(by.get('approved') ?? 0), GREEN), card('Pending', num(by.get('pending') ?? 0), AMBER), card('Rejected', num(by.get('rejected') ?? 0), RED)],
              [{ key: 'group', label: 'Status' }, { key: 'count', label: 'Count', right: true }, { key: 'share', label: 'Share', right: true }], rows),
            chart: { kind: 'pie', data: [...by.entries()].map(([k, v]) => ({ name: k, value: v })) }, chartTitle: 'Requisitions by status',
          }
        },
      },
      {
        id: 'rq-detail', title: 'Requisition Detail Report', desc: 'Every requisition with approval time and conversion.',
        build: (f) => {
          const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
          const rows: Row[] = [...REQS.map((q) => ({ ...q, converted: q.converted })), ...PTXNS.map((t) => ({ id: t.reqId, date: t.reqDate, department: t.department, employee: t.buyer, supplier: t.supplier, status: t.reqStatus, approvalDays: t.approvalDays, value: t.gross, converted: true }))]
            .filter((q) => q.date >= r.start && q.date <= r.end)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((q) => ({ id: q.id, date: dmy(q.date), department: q.department, employee: q.employee, supplier: q.supplier, status: q.status, approval: `${q.approvalDays}d`, value: money2(q.value), converted: q.converted ? 'Yes' : 'No' }))
          return baseView(f, 'Requisition Detail Report', 'Every requisition with approval time and conversion.', 'requisition-detail',
            [card('Requisitions', num(rows.length), BLUE)],
            [{ key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'department', label: 'Department' }, { key: 'employee', label: 'Requested by' }, { key: 'supplier', label: 'Supplier' }, { key: 'status', label: 'Status' }, { key: 'approval', label: 'Approval time', right: true }, { key: 'value', label: 'Value', right: true }, { key: 'converted', label: 'Converted' }], rows)
        },
      },
      {
        id: 'rq-pend', title: 'Pending Requisitions', desc: 'Requisitions awaiting a decision.',
        build: (f) => {
          const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
          const rows = REQS.filter((q) => q.status === 'pending' && q.date >= r.start && q.date <= r.end)
            .map((q) => ({ id: q.id, date: dmy(q.date), department: q.department, employee: q.employee, supplier: q.supplier, waiting: `${q.approvalDays}d`, value: money2(q.value) }))
          return baseView(f, 'Pending Requisitions', 'Requisitions awaiting a decision.', 'pending-requisitions', [card('Pending', num(rows.length), AMBER)],
            [{ key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'department', label: 'Department' }, { key: 'employee', label: 'Requested by' }, { key: 'supplier', label: 'Supplier' }, { key: 'waiting', label: 'Waiting', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rq-app', title: 'Approved Requisitions', desc: 'Approved requisitions in the period.',
        build: (f) => {
          const def = dimApproved(f)
          return def
        },
      },
      {
        id: 'rq-rej', title: 'Rejected Requisitions', desc: 'Rejected requisitions in the period.',
        build: (f) => {
          const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
          const rows = REQS.filter((q) => q.status === 'rejected' && q.date >= r.start && q.date <= r.end)
            .map((q) => ({ id: q.id, date: dmy(q.date), department: q.department, employee: q.employee, supplier: q.supplier, value: money2(q.value) }))
          return baseView(f, 'Rejected Requisitions', 'Rejected requisitions in the period.', 'rejected-requisitions', [card('Rejected', num(rows.length), RED)],
            [{ key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'department', label: 'Department' }, { key: 'employee', label: 'Requested by' }, { key: 'supplier', label: 'Supplier' }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rq-time', title: 'Requisition Approval Time Analysis', desc: 'Average approval time per month.',
        build: (f) => {
          const list = filterTxns(f)
          const g = new Map<string, { sum: number; n: number; txns: PurTxn[] }>()
          for (const t of list) {
            const k = t.reqDate.slice(0, 7)
            const cur = g.get(k) ?? { sum: 0, n: 0, txns: [] }
            cur.sum += t.approvalDays; cur.n++; cur.txns.push(t)
            g.set(k, cur)
          }
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => ({ group: monthLabel(k), reqs: num(g.get(k)!.n), avg: `${(g.get(k)!.sum / g.get(k)!.n).toFixed(1)}d`, __txns: g.get(k)!.txns }))
          const a = totals(list)
          const avg = a.pos ? list.reduce((s, t) => s + t.approvalDays, 0) / a.pos : 0
          return {
            ...baseView(f, 'Requisition Approval Time Analysis', 'Average approval time per month.', 'approval-time',
              [card('Avg approval', `${avg.toFixed(1)}d`, AMBER), card('Requisitions', num(a.pos), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'reqs', label: 'Requisitions', right: true }, { key: 'avg', label: 'Avg approval', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round((g.get(k)!.sum / g.get(k)!.n) * 10) / 10 })), aLabel: 'Days' }, chartTitle: 'Approval time trend',
          }
        },
      },
      {
        id: 'rq-dept', title: 'Department Requisition Report', desc: 'Requisitioned value per department.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.department)
          const rows = [...g.entries()].sort((x, y) => y[1].gross - x[1].gross).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Department Requisition Report', 'Requisitioned value per department.', 'department-requisitions',
              [card('Value', money(a.gross), BLUE)], STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.gross) })) }, chartTitle: 'Spend by department',
          }
        },
      },
      {
        id: 'rq-emp', title: 'Employee Requisition Report', desc: 'Requisitions raised per employee/buyer.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.buyer)
          const rows = [...g.entries()].sort((x, y) => y[1].gross - x[1].gross).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Employee Requisition Report', 'Requisitions raised per employee/buyer.', 'employee-requisitions',
              [card('Buyers', num(g.size), BLUE), card('Value', money(a.gross), GREEN)], STD_COLS, rows),
            chart: { kind: 'bar', data: [...g.entries()].sort((x, y) => y[1].gross - x[1].gross).map(([k, v]) => ({ name: k, a: Math.round(v.gross) })), aLabel: 'Value' }, chartTitle: 'Value by buyer',
          }
        },
      },
    ],
  },
  {
    id: 'po', title: 'Purchase Order Reports',
    reports: [
      {
        id: 'po-sum', title: 'Purchase Order Summary', desc: 'PO pipeline by status.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.poStatus)
          const rows = [...g.entries()].sort((x, y) => y[1].landed - x[1].landed).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Purchase Order Summary', 'PO pipeline by status.', 'po-summary',
              [card('POs', num(a.pos), BLUE), card('Landed', money(a.landed), GREEN), card('Outstanding', money(a.outstanding), RED)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'PO value by status',
          }
        },
      },
      {
        id: 'po-detail', title: 'Purchase Order Detail Report', desc: 'Every purchase order with statuses.',
        build: (f) => {
          const list = filterTxns(f).sort((x, y) => y.date.localeCompare(x.date))
          const a = totals(list)
          return baseView(f, 'Purchase Order Detail Report', 'Every purchase order with statuses.', 'po-detail',
            [card('POs', num(a.pos), BLUE), card('Landed', money(a.landed), GREEN)], PO_COLS, list.map(poRow))
        },
      },
      listReport('po-open', 'Open Purchase Orders', 'Open POs.', (t) => t.poStatus === 'open', 'open-pos'),
      listReport('po-closed', 'Closed Purchase Orders', 'Closed POs.', (t) => t.poStatus === 'closed', 'closed-pos'),
      listReport('po-pend', 'Pending Purchase Orders', 'Pending POs.', (t) => t.poStatus === 'pending', 'pending-pos'),
      listReport('po-partial', 'Partially Received Orders', 'Partially received POs.', (t) => t.poStatus === 'partial', 'partially-received-pos'),
      {
        id: 'po-status', title: 'Purchase Order Status Report', desc: 'Monthly PO volume by status.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const c = (s: string) => a.txns.filter((t) => t.poStatus === s).length
            return { group: monthLabel(k), open: num(c('open')), closed: num(c('closed')), pending: num(c('pending')), partial: num(c('partial')), __txns: a.txns }
          })
          return baseView(f, 'Purchase Order Status Report', 'Monthly PO volume by status.', 'po-status-report',
            [card('POs', num(list.length), BLUE)],
            [{ key: 'group', label: 'Month' }, { key: 'open', label: 'Open', right: true }, { key: 'closed', label: 'Closed', right: true }, { key: 'pending', label: 'Pending', right: true }, { key: 'partial', label: 'Partial', right: true }], rows)
        },
      },
      {
        id: 'po-aging', title: 'Purchase Order Aging Report', desc: 'Open POs aged by days since order.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.poStatus === 'open' || t.poStatus === 'pending' || t.poStatus === 'partial')
          const buckets = ['0–15 days', '16–30 days', '31–60 days', '60+ days']
          const agg = new Map<string, PurAgg>()
          for (const t of list) {
            const age = Math.round((new Date(`${TODAY}T12:00:00`).getTime() - new Date(`${t.date}T12:00:00`).getTime()) / 864e5)
            const b = age <= 15 ? buckets[0] : age <= 30 ? buckets[1] : age <= 60 ? buckets[2] : buckets[3]
            const a = agg.get(b) ?? emptyAgg(); addTxn(a, t); agg.set(b, a)
          }
          const rows = buckets.filter((b) => agg.has(b)).map((b) => ({ group: b, pos: num(agg.get(b)!.pos), value: money2(agg.get(b)!.landed), __txns: agg.get(b)!.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Purchase Order Aging Report', 'Open POs aged by days since order.', 'po-aging',
              [card('Open POs', num(list.length), AMBER), card('Open value', money(a.landed), RED)],
              [{ key: 'group', label: 'Age bucket' }, { key: 'pos', label: 'POs', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'bar', data: rows.map((r) => ({ name: String(r.group), a: Math.round(agg.get(String(r.group))!.landed) })), aLabel: 'Value' }, chartTitle: 'Open PO aging',
          }
        },
      },
      {
        id: 'po-fulfil', title: 'Purchase Order Fulfillment Analysis', desc: 'Monthly closed vs total POs.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const closed = a.txns.filter((t) => t.poStatus === 'closed').length
            return { group: monthLabel(k), pos: num(a.txns.length), closed: num(closed), rate: pct(a.txns.length ? (closed / a.txns.length) * 100 : 0), __txns: a.txns }
          })
          const closed = list.filter((t) => t.poStatus === 'closed').length
          return {
            ...baseView(f, 'Purchase Order Fulfillment Analysis', 'Monthly closed vs total POs.', 'po-fulfillment',
              [card('POs', num(list.length), BLUE), card('Closed', num(closed), GREEN), card('Fulfillment', pct(list.length ? (closed / list.length) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'pos', label: 'POs', right: true }, { key: 'closed', label: 'Closed', right: true }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.rate)) })), aLabel: 'Fulfillment %' }, chartTitle: 'Fulfillment trend',
          }
        },
      },
    ],
  },
  {
    id: 'grn', title: 'Goods Receipt (GRN) Reports',
    reports: [
      {
        id: 'grn-sum', title: 'GRN Summary', desc: 'Receipts overview with on-time performance.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const a = totals(list)
          const byMonth = groupAgg(list, bucketMonth)
          const keys = [...byMonth.keys()].sort()
          const rows = keys.map((k) => aggRow(monthLabel(k), byMonth.get(k)!))
          return {
            ...baseView(f, 'GRN Summary', 'Receipts overview with on-time performance.', 'grn-summary',
              [card('GRNs', num(list.length), BLUE), card('Received value', money(a.landed), GREEN), card('On-time', pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), AMBER), card('Late', num(a.late), RED)],
              STD_COLS, rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(byMonth.get(k)!.landed) })), aLabel: 'Received value' }, chartTitle: 'Monthly GRN value',
          }
        },
      },
      {
        id: 'grn-detail', title: 'Goods Receipt Details', desc: 'Every receipt with lead time and variance.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn).sort((x, y) => (y.grnDate ?? '').localeCompare(x.grnDate ?? ''))
          const rows = list.map((t) => ({ po: t.id, grnDate: dmy(t.grnDate ?? t.date), supplier: t.supplier, warehouse: t.warehouse, lead: `${t.leadDays}d`, onTime: t.onTime ? 'Yes' : 'No', variance: num(t.qtyVariance), value: money2(t.landed), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Goods Receipt Details', 'Every receipt with lead time and variance.', 'grn-details',
            [card('GRNs', num(list.length), BLUE), card('Value', money(a.landed), GREEN)],
            [{ key: 'po', label: 'PO' }, { key: 'grnDate', label: 'GRN date' }, { key: 'supplier', label: 'Supplier' }, { key: 'warehouse', label: 'Warehouse' }, { key: 'lead', label: 'Lead', right: true }, { key: 'onTime', label: 'On time' }, { key: 'variance', label: 'Variance', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      dimReport('grn-sup', 'Goods Received by Supplier', 'Received value per supplier.', (t) => t.supplier, 'grn-by-supplier'),
      {
        id: 'grn-prod', title: 'Goods Received by Product', desc: 'Received units per product.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const m = new Map<string, { qty: number; value: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.receivedQty; cur.value += l.receivedQty * l.unitCost; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].qty - x[1].qty).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          return baseView(f, 'Goods Received by Product', 'Received units per product.', 'grn-by-product',
            [card('Products', num(m.size), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Received', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      listReport('grn-pend', 'Pending Deliveries', 'POs not yet received.', (t) => !t.grn && t.poStatus !== 'pending', 'pending-deliveries'),
      listReport('grn-delay', 'Delayed Deliveries', 'Late receipts.', (t) => t.grn && !t.onTime, 'delayed-deliveries', (a) => [card('Late', num(a.late), RED)]),
      {
        id: 'grn-perf', title: 'Supplier Delivery Performance', desc: 'On-time rate per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, grns: num(a.txns.length), onTime: num(a.onTime), late: num(a.late), rate: pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.rate)) - parseFloat(String(x.rate)))
          const a = totals(list)
          return {
            ...baseView(f, 'Supplier Delivery Performance', 'On-time rate per supplier.', 'delivery-performance',
              [card('On-time rate', pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), GREEN)],
              [{ key: 'group', label: 'Supplier' }, { key: 'grns', label: 'GRNs', right: true }, { key: 'onTime', label: 'On time', right: true }, { key: 'late', label: 'Late', right: true }, { key: 'rate', label: 'OTD', right: true }], rows),
            chart: { kind: 'bar', data: rows.slice(0, 10).map((r) => ({ name: String(r.group), a: parseFloat(String(r.rate)) })), aLabel: 'On-time %' }, chartTitle: 'On-time delivery by supplier',
          }
        },
      },
      {
        id: 'grn-var', title: 'Quantity Variance Analysis', desc: 'Receipts with quantity variances.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn && t.qtyVariance !== 0)
          const rows = list.map((t) => ({ po: t.id, date: dmy(t.date), supplier: t.supplier, variance: num(t.qtyVariance), value: money2(t.landed), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Quantity Variance Analysis', 'Receipts with quantity variances.', 'qty-variance',
            [card('Variance receipts', num(list.length), AMBER), card('Units variance', num(a.variance), RED)],
            [{ key: 'po', label: 'PO' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'variance', label: 'Variance', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'grn-audit', title: 'GRN Audit Report', desc: 'Full audit trail: PO, GRN date, lead, variance, on-time.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn).sort((x, y) => x.id.localeCompare(y.id))
          const rows = list.map((t) => ({ po: t.id, ordered: dmy(t.date), grn: dmy(t.grnDate ?? t.date), supplier: t.supplier, lead: `${t.leadDays}d`, variance: num(t.qtyVariance), onTime: t.onTime ? 'Yes' : 'No', auditor: t.buyer, __txns: [t] }))
          return baseView(f, 'GRN Audit Report', 'Full audit trail: PO, GRN date, lead, variance, on-time.', 'grn-audit',
            [card('GRNs', num(list.length), BLUE)],
            [{ key: 'po', label: 'PO' }, { key: 'ordered', label: 'Ordered' }, { key: 'grn', label: 'Received' }, { key: 'supplier', label: 'Supplier' }, { key: 'lead', label: 'Lead', right: true }, { key: 'variance', label: 'Variance', right: true }, { key: 'onTime', label: 'On time' }, { key: 'auditor', label: 'Received by' }], rows)
        },
      },
    ],
  },
  {
    id: 'pinv', title: 'Purchase Invoice Reports',
    reports: [
      {
        id: 'pi-sum', title: 'Purchase Invoice Summary', desc: 'Invoiced purchases by status.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus)
          const g = groupAgg(list, (t) => t.invoiceStatus ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].landed - x[1].landed).map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          return {
            ...baseView(f, 'Purchase Invoice Summary', 'Invoiced purchases by status.', 'purchase-invoice-summary',
              [card('Invoiced', money(a.landed), BLUE), card('Paid', money(a.paid), GREEN), card('Balance', money(a.outstanding), RED)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'Invoiced value by status',
          }
        },
      },
      {
        id: 'pi-detail', title: 'Invoice Detail Report', desc: 'Every purchase invoice with due date and balance.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus).sort((x, y) => y.date.localeCompare(x.date))
          const rows = list.map((t) => ({ po: t.id, date: dmy(t.date), supplier: t.supplier, status: t.invoiceStatus ?? '—', due: t.dueDate ? dmy(t.dueDate) : '—', landed: money2(t.landed), paid: money2(t.paid), balance: money2(t.outstanding), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Invoice Detail Report', 'Every purchase invoice with due date and balance.', 'invoice-detail',
            [card('Invoices', num(list.length), BLUE), card('Balance', money(a.outstanding), RED)],
            [{ key: 'po', label: 'PO' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'status', label: 'Status' }, { key: 'due', label: 'Due' }, { key: 'landed', label: 'Invoiced', right: true }, { key: 'paid', label: 'Paid', right: true }, { key: 'balance', label: 'Balance', right: true }], rows)
        },
      },
      listReport('pi-paid', 'Paid Invoices', 'Fully paid purchase invoices.', (t) => t.invoiceStatus === 'paid', 'paid-purchase-invoices'),
      listReport('pi-unpaid', 'Unpaid Invoices', 'Unpaid purchase invoices.', (t) => t.invoiceStatus === 'unpaid', 'unpaid-purchase-invoices'),
      listReport('pi-over', 'Overdue Invoices', 'Overdue purchase invoices.', (t) => t.invoiceStatus === 'overdue', 'overdue-purchase-invoices'),
      {
        id: 'pi-aging', title: 'Invoice Aging Analysis', desc: 'Payables by age bucket.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.outstanding > 0)
          const buckets = ['Current (0–30)', '31–60 days', '61–90 days', '90+ days']
          const agg = new Map<string, PurAgg>()
          for (const t of list) {
            const due = new Date(`${t.dueDate ?? t.date}T12:00:00`)
            const age = Math.round((new Date(`${TODAY}T12:00:00`).getTime() - due.getTime()) / 864e5)
            const b = age <= 30 ? buckets[0] : age <= 60 ? buckets[1] : age <= 90 ? buckets[2] : buckets[3]
            const a = agg.get(b) ?? emptyAgg(); addTxn(a, t); agg.set(b, a)
          }
          const rows = buckets.filter((b) => agg.has(b)).map((b) => ({ group: b, invoices: num(agg.get(b)!.pos), outstanding: money2(agg.get(b)!.outstanding), __txns: agg.get(b)!.txns }))
          const total = list.reduce((s, t) => s + t.outstanding, 0)
          return {
            ...baseView(f, 'Invoice Aging Analysis', 'Payables by age bucket.', 'invoice-aging',
              [card('Outstanding', money(total), RED), card('Open invoices', num(list.length), AMBER)],
              [{ key: 'group', label: 'Bucket' }, { key: 'invoices', label: 'Invoices', right: true }, { key: 'outstanding', label: 'Outstanding', right: true }], rows),
            chart: { kind: 'bar', data: rows.map((r) => ({ name: String(r.group), a: Math.round(agg.get(String(r.group))!.outstanding) })), aLabel: 'Outstanding' }, chartTitle: 'Payables aging',
          }
        },
      },
      {
        id: 'pi-hist', title: 'Supplier Invoice History', desc: 'Invoice history per supplier.',
        build: (f) => dimReport('x', 'Supplier Invoice History', 'Invoice history per supplier.', (t) => t.supplier, 'supplier-invoice-history', 'bar').build({ ...f, invoiceStatus: f.invoiceStatus || '' }),
      },
      {
        id: 'pi-match', title: 'Invoice Matching Report', desc: 'Invoices matched against GRN values.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus && t.grn)
          const rows = list.map((t) => {
            const grnValue = t.landed
            const invValue = t.landed
            const matched = Math.abs(grnValue - invValue) < 1
            return { po: t.id, supplier: t.supplier, grn: money2(grnValue), invoice: money2(invValue), status: matched ? 'Matched' : 'Mismatch', __txns: [t] }
          })
          const matched = rows.filter((r) => r.status === 'Matched').length
          return baseView(f, 'Invoice Matching Report', 'Invoices matched against GRN values.', 'invoice-matching',
            [card('Checked', num(rows.length), BLUE), card('Matched', num(matched), GREEN), card('Match rate', pct(rows.length ? (matched / rows.length) * 100 : 0), AMBER)],
            [{ key: 'po', label: 'PO' }, { key: 'supplier', label: 'Supplier' }, { key: 'grn', label: 'GRN value', right: true }, { key: 'invoice', label: 'Invoice', right: true }, { key: 'status', label: 'Status' }], rows)
        },
      },
      {
        id: 'pi-3way', title: 'Three-Way Matching Report', desc: 'PO vs GRN vs Invoice comparison.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus && t.grn)
          const rows = list.map((t) => {
            const poVal = t.gross
            const grnVal = t.gross + t.qtyVariance * (t.lines[0]?.unitCost ?? 0)
            const invVal = t.landed
            const ok = Math.abs(poVal - grnVal) / Math.max(1, poVal) < 0.06
            return { po: t.id, supplier: t.supplier, poValue: money2(poVal), grnValue: money2(grnVal), invoice: money2(invVal), result: ok ? 'OK' : 'Review', __txns: [t] }
          })
          const okCount = rows.filter((r) => r.result === 'OK').length
          return baseView(f, 'Three-Way Matching Report', 'PO vs GRN vs Invoice comparison.', 'three-way-matching',
            [card('Checked', num(rows.length), BLUE), card('OK', num(okCount), GREEN), card('Review', num(rows.length - okCount), AMBER)],
            [{ key: 'po', label: 'PO' }, { key: 'supplier', label: 'Supplier' }, { key: 'poValue', label: 'PO value', right: true }, { key: 'grnValue', label: 'GRN value', right: true }, { key: 'invoice', label: 'Invoice', right: true }, { key: 'result', label: 'Result' }], rows)
        },
      },
    ],
  },
  {
    id: 'pay', title: 'Supplier Payment Reports',
    reports: [
      {
        id: 'py-sum', title: 'Supplier Payment Summary', desc: 'Payments per method.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.paid > 0)
          const g = groupAgg(list, (t) => t.method)
          const total = list.reduce((s, t) => s + t.paid, 0)
          const rows = [...g.entries()].sort((x, y) => y[1].paid - x[1].paid).map(([k, a]) => ({ group: k, payments: num(a.txns.length), paid: money2(a.paid), share: pct(total ? (a.paid / total) * 100 : 0), __txns: a.txns }))
          return {
            ...baseView(f, 'Supplier Payment Summary', 'Payments per method.', 'payment-summary',
              [card('Paid', money(total), GREEN), card('Methods', num(g.size), BLUE)],
              [{ key: 'group', label: 'Method' }, { key: 'payments', label: 'Payments', right: true }, { key: 'paid', label: 'Paid', right: true }, { key: 'share', label: 'Share', right: true }], rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.paid) })) }, chartTitle: 'Payments by method',
          }
        },
      },
      {
        id: 'py-detail', title: 'Payment Detail Report', desc: 'Every supplier payment.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.paid > 0).sort((x, y) => y.date.localeCompare(x.date))
          const rows = list.map((t) => ({ po: t.id, date: dmy(t.date), supplier: t.supplier, method: t.method, status: paymentStatusOf(t), paid: money2(t.paid), balance: money2(t.outstanding), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Payment Detail Report', 'Every supplier payment.', 'payment-detail',
            [card('Payments', num(list.length), BLUE), card('Paid', money(a.paid), GREEN)],
            [{ key: 'po', label: 'PO' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' }, { key: 'paid', label: 'Paid', right: true }, { key: 'balance', label: 'Balance', right: true }], rows)
        },
      },
      dimReport('py-sup', 'Payments by Supplier', 'Paid value per supplier.', (t) => t.supplier, 'payments-by-supplier'),
      dimReport('py-method', 'Payments by Method', 'Paid value per method.', (t) => t.method, 'payments-by-method'),
      listReport('py-bank', 'Bank Payments', 'Bank transfer payments.', (t) => t.method === 'Bank Transfer' && t.paid > 0, 'bank-payments'),
      listReport('py-cash', 'Cash Payments', 'Cash payments.', (t) => t.method === 'Cash' && t.paid > 0, 'cash-payments'),
      listReport('py-cheque', 'Cheque Payments', 'Cheque payments.', (t) => t.method === 'Cheque' && t.paid > 0, 'cheque-payments'),
      listReport('py-momo', 'Mobile Money Payments', 'Mobile money payments.', (t) => t.method === 'Mobile Money' && t.paid > 0, 'momo-payments'),
      {
        id: 'py-out', title: 'Outstanding Supplier Balances', desc: 'Payables per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.outstanding > 0)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].sort((x, y) => y[1].outstanding - x[1].outstanding).map(([k, a]) => ({ group: k, invoices: num(a.txns.length), invoiced: money2(a.landed), paid: money2(a.paid), outstanding: money2(a.outstanding), __txns: a.txns }))
          const total = list.reduce((s, t) => s + t.outstanding, 0)
          return baseView(f, 'Outstanding Supplier Balances', 'Payables per supplier.', 'outstanding-supplier-balances',
            [card('Outstanding', money(total), RED), card('Creditors', num(g.size), AMBER)],
            [{ key: 'group', label: 'Supplier' }, { key: 'invoices', label: 'Invoices', right: true }, { key: 'invoiced', label: 'Invoiced', right: true }, { key: 'paid', label: 'Paid', right: true }, { key: 'outstanding', label: 'Balance', right: true }], rows)
        },
      },
      {
        id: 'py-settle', title: 'Supplier Settlement Report', desc: 'Invoiced vs settled per supplier with settlement rate.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.invoiceStatus)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, invoiced: money2(a.landed), settled: money2(a.paid), rate: pct(a.landed ? (a.paid / a.landed) * 100 : 0), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.rate)) - parseFloat(String(x.rate)))
          const a = totals(list)
          return baseView(f, 'Supplier Settlement Report', 'Invoiced vs settled per supplier with settlement rate.', 'supplier-settlement',
            [card('Invoiced', money(a.landed), BLUE), card('Settled', money(a.paid), GREEN), card('Settlement rate', pct(a.landed ? (a.paid / a.landed) * 100 : 0), AMBER)],
            [{ key: 'group', label: 'Supplier' }, { key: 'invoiced', label: 'Invoiced', right: true }, { key: 'settled', label: 'Settled', right: true }, { key: 'rate', label: 'Rate', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'sup', title: 'Supplier Analysis Reports',
    reports: [
      {
        id: 'su-perf', title: 'Supplier Performance Report', desc: 'Composite: volume, on-time, returns, lead time.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({
            group: k, pos: num(a.pos), landed: money2(a.landed),
            otd: pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0),
            lead: `${a.leadCount ? (a.leadSum / a.leadCount).toFixed(1) : '0'}d`,
            returns: money2(a.returns),
            score: Math.round((a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0) * 0.6 + (1 - Math.min(1, a.returns / Math.max(1, a.gross))) * 40),
            __txns: a.txns,
          })).sort((x, y) => Number(y.score) - Number(x.score))
          return baseView(f, 'Supplier Performance Report', 'Composite: volume, on-time, returns, lead time.', 'supplier-performance',
            [card('Suppliers', num(g.size), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'pos', label: 'POs', right: true }, { key: 'landed', label: 'Spend', right: true }, { key: 'otd', label: 'OTD', right: true }, { key: 'lead', label: 'Lead', right: true }, { key: 'returns', label: 'Returns', right: true }, { key: 'score', label: 'Score', right: true }], rows)
        },
      },
      {
        id: 'su-top', title: 'Top Suppliers', desc: 'Ten highest-spend suppliers.',
        build: (f) => {
          const v = dimReport('x', 'Top Suppliers', '', (t) => t.supplier, 'top-suppliers', 'bar').build(f)
          v.rows = v.rows.slice(0, 10)
          v.desc = 'Ten highest-spend suppliers.'
          return v
        },
      },
      dimReport('su-vol', 'Supplier Purchase Volume', 'Units purchased per supplier.', (t) => t.supplier, 'supplier-volume', 'bar'),
      {
        id: 'su-lead', title: 'Supplier Lead Time Analysis', desc: 'Average lead time per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, grns: num(a.txns.length), avgLead: `${(a.leadSum / Math.max(1, a.leadCount)).toFixed(1)}d`, shortest: `${Math.min(...a.txns.map((t) => t.leadDays))}d`, longest: `${Math.max(...a.txns.map((t) => t.leadDays))}d`, __txns: a.txns }))
            .sort((x, y) => parseFloat(String(x.avgLead)) - parseFloat(String(y.avgLead)))
          const a = totals(list)
          return baseView(f, 'Supplier Lead Time Analysis', 'Average lead time per supplier.', 'supplier-lead-time',
            [card('Avg lead', `${a.leadCount ? (a.leadSum / a.leadCount).toFixed(1) : 0}d`, AMBER)],
            [{ key: 'group', label: 'Supplier' }, { key: 'grns', label: 'GRNs', right: true }, { key: 'avgLead', label: 'Avg', right: true }, { key: 'shortest', label: 'Min', right: true }, { key: 'longest', label: 'Max', right: true }], rows)
        },
      },
      {
        id: 'su-rel', title: 'Supplier Reliability Report', desc: 'On-time delivery reliability per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, deliveries: num(a.onTime + a.late), onTime: num(a.onTime), late: num(a.late), reliability: pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.reliability)) - parseFloat(String(x.reliability)))
          return baseView(f, 'Supplier Reliability Report', 'On-time delivery reliability per supplier.', 'supplier-reliability',
            [card('Suppliers', num(g.size), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'deliveries', label: 'Deliveries', right: true }, { key: 'onTime', label: 'On time', right: true }, { key: 'late', label: 'Late', right: true }, { key: 'reliability', label: 'Reliability', right: true }], rows)
        },
      },
      {
        id: 'su-quality', title: 'Supplier Quality Rating', desc: 'Quality score from return rate per supplier.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => {
            const rate = a.gross ? (a.returns / a.gross) * 100 : 0
            const stars = Math.max(1, Math.round(5 - rate))
            return { group: k, returns: num(a.returnsCount), returnRate: pct(rate), rating: '★'.repeat(stars) + '☆'.repeat(5 - stars), __txns: a.txns }
          }).sort((x, y) => parseFloat(String(x.returnRate)) - parseFloat(String(y.returnRate)))
          return baseView(f, 'Supplier Quality Rating', 'Quality score from return rate per supplier.', 'supplier-quality',
            [card('Suppliers', num(g.size), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'returns', label: 'Returns', right: true }, { key: 'returnRate', label: 'Return rate', right: true }, { key: 'rating', label: 'Rating' }], rows)
        },
      },
      {
        id: 'su-cost', title: 'Supplier Cost Comparison', desc: 'Avg charges & savings per supplier.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, landed: money2(a.landed), charges: money2(a.charges), chargeRate: pct(a.landed ? (a.charges / a.landed) * 100 : 0), savings: money2(a.savings), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(x.chargeRate)) - parseFloat(String(y.chargeRate)))
          return baseView(f, 'Supplier Cost Comparison', 'Avg charges & savings per supplier.', 'supplier-cost-comparison',
            [card('Suppliers', num(g.size), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'landed', label: 'Landed', right: true }, { key: 'charges', label: 'Charges', right: true }, { key: 'chargeRate', label: 'Charge %', right: true }, { key: 'savings', label: 'Savings', right: true }], rows)
        },
      },
      {
        id: 'su-comp', title: 'Supplier Compliance Report', desc: 'Late deliveries, variances and preferred status.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({
            group: k, preferred: supplierDim(k)?.preferred ? 'Yes' : 'No', late: num(a.late), variances: num(a.txns.filter((t) => t.qtyVariance !== 0).length),
            compliance: pct(a.txns.length ? ((a.txns.length - a.late - a.txns.filter((t) => t.qtyVariance !== 0).length) / a.txns.length) * 100 : 0), __txns: a.txns,
          })).sort((x, y) => parseFloat(String(y.compliance)) - parseFloat(String(x.compliance)))
          return baseView(f, 'Supplier Compliance Report', 'Late deliveries, variances and preferred status.', 'supplier-compliance',
            [card('Suppliers', num(g.size), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'preferred', label: 'Preferred' }, { key: 'late', label: 'Late', right: true }, { key: 'variances', label: 'Variances', right: true }, { key: 'compliance', label: 'Compliance', right: true }], rows)
        },
      },
      {
        id: 'su-pref', title: 'Preferred Supplier Report', desc: 'Spend concentration on preferred suppliers.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => (supplierDim(t.supplier)?.preferred ? 'Preferred' : 'Non-preferred'))
          const rows = [...g.entries()].map(([k, a]) => aggRow(k, a))
          const a = totals(list)
          const pref = g.get('Preferred')
          return {
            ...baseView(f, 'Preferred Supplier Report', 'Spend concentration on preferred suppliers.', 'preferred-suppliers',
              [card('Preferred share', pct(a.landed && pref ? (pref.landed / a.landed) * 100 : 0), GREEN), card('Preferred spend', money(pref?.landed ?? 0), BLUE)],
              STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'Preferred vs non-preferred spend',
          }
        },
      },
    ],
  },  {
    id: 'prod', title: 'Product Procurement Reports',
    reports: [
      dimReport('pr-prod', 'Purchases by Product', 'Spend per product.', (t) => productName(t.lines[0]?.productId ?? ''), 'purchases-by-product'),
      dimReport('pr-cat', 'Purchases by Category', 'Spend per category.', (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—', 'purchases-by-category'),
      dimReport('pr-brand', 'Purchases by Brand', 'Spend per brand.', (t) => productDim(t.lines[0]?.productId ?? '')?.brand ?? '—', 'purchases-by-brand'),
      {
        id: 'pr-most', title: 'Most Purchased Products', desc: 'Products ranked by units purchased.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, { qty: number; value: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.qty; cur.value += l.qty * l.unitCost; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].qty - x[1].qty).slice(0, 15).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Most Purchased Products', 'Products ranked by units purchased.', 'most-purchased',
              [card('Units', num(a.qty), GREEN), card('Products', num(m.size), BLUE)],
              [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'bar', data: rows.slice(0, 10).map((r) => ({ name: String(r.group), a: Number(String(r.qty).replace(/,/g, '')) })), aLabel: 'Units' }, chartTitle: 'Top 10 by units',
          }
        },
      },
      {
        id: 'pr-fast', title: 'Fast Moving Purchased Items', desc: 'Highest-turnover purchased items.',
        build: (f) => {
          const v = dimReport('x', 'Fast Moving Purchased Items', '', (t) => productName(t.lines[0]?.productId ?? ''), 'fast-moving', 'bar').build(f)
          v.desc = 'Highest-turnover purchased items.'
          return v
        },
      },
      {
        id: 'pr-slow', title: 'Slow Moving Purchased Items', desc: 'Least purchased items in the period.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, number>()
          for (const t of list) for (const l of t.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty)
          const rows = PRODUCTS.map((p) => ({ group: p.name, category: p.category, qty: num(m.get(p.id) ?? 0) }))
            .sort((x, y) => Number(String(x.qty).replace(/,/g, '')) - Number(String(y.qty).replace(/,/g, ''))).slice(0, 15)
          return baseView(f, 'Slow Moving Purchased Items', 'Least purchased items in the period.', 'slow-moving-purchased',
            [card('Catalogue', num(PRODUCTS.length), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Purchased', right: true }], rows)
        },
      },
      {
        id: 'pr-costtrend', title: 'Product Cost Trend Analysis', desc: 'Monthly average unit cost for the filtered product.',
        build: (f) => {
          const pid = f.product || 'sp06'
          const list = filterTxns(f)
          const m = new Map<string, { cost: number; qty: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) if (l.productId === pid) {
            const cur = m.get(t.date.slice(0, 7)) ?? { cost: 0, qty: 0, txns: [] }
            cur.cost += l.qty * l.unitCost; cur.qty += l.qty; cur.txns.push(t)
            m.set(t.date.slice(0, 7), cur)
          }
          const keys = [...m.keys()].sort()
          const rows = keys.map((k) => ({ group: monthLabel(k), qty: num(m.get(k)!.qty), avg: money2(m.get(k)!.cost / Math.max(1, m.get(k)!.qty)), __txns: m.get(k)!.txns }))
          return {
            ...baseView(f, 'Product Cost Trend Analysis', `Monthly average unit cost for ${productName(pid)}.`, 'product-cost-trend',
              [card('Product', productName(pid), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'qty', label: 'Units', right: true }, { key: 'avg', label: 'Avg unit cost', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(m.get(k)!.cost / Math.max(1, m.get(k)!.qty)) })), aLabel: 'Avg cost ₵' }, chartTitle: 'Unit cost trend',
          }
        },
      },
      {
        id: 'pr-cost', title: 'Procurement Cost Analysis', desc: 'Goods value vs landed cost per product.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, { gross: number; txns: PurTxn[]; qty: number }>()
          for (const t of list) {
            const share = t.gross > 0 ? (t.landed - t.gross) / t.gross : 0
            for (const l of t.lines) {
              const cur = m.get(l.productId) ?? { gross: 0, txns: [], qty: 0 }
              const lineGross = l.qty * l.unitCost
              cur.gross += lineGross * (1 + share); cur.qty += l.qty; cur.txns.push(t)
              m.set(l.productId, cur)
            }
          }
          const rows = [...m.entries()].sort((x, y) => y[1].gross - x[1].gross).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), landed: money2(v.gross), __txns: v.txns }))
          const a = totals(list)
          return baseView(f, 'Procurement Cost Analysis', 'Goods value vs landed cost per product.', 'procurement-cost-analysis',
            [card('Landed', money(a.landed), VIOLET), card('Charges', money(a.charges), AMBER)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'landed', label: 'Landed (alloc.)', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'ret', title: 'Purchase Return Reports',
    reports: [
      {
        id: 'rt-sum', title: 'Purchase Return Summary', desc: 'Returns overview & trend.',
        build: (f) => {
          const list = filterTxns(f)
          const a = totals(list)
          const g = groupAgg(list.filter((t) => t.returned), bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => ({ group: monthLabel(k), returns: num(g.get(k)!.returnsCount), value: money2(g.get(k)!.returns), __txns: g.get(k)!.txns }))
          return {
            ...baseView(f, 'Purchase Return Summary', 'Returns overview & trend.', 'purchase-return-summary',
              [card('Returns', num(a.returnsCount), RED), card('Return value', money(a.returns), ROSE), card('Return rate', pct(a.gross ? (a.returns / a.gross) * 100 : 0), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'returns', label: 'Returns', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'area', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.returns) })), aLabel: 'Returns ₵' }, chartTitle: 'Return trend',
          }
        },
      },
      {
        id: 'rt-detail', title: 'Purchase Return Details', desc: 'Every return with reason.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned).sort((x, y) => y.date.localeCompare(x.date))
          const rows = list.map((t) => ({ po: t.id, date: dmy(t.date), supplier: t.supplier, reason: t.returnReason ?? '—', value: money2(t.returnValue), __txns: [t] }))
          const a = totals(list)
          return baseView(f, 'Purchase Return Details', 'Every return with reason.', 'purchase-return-details',
            [card('Returns', num(list.length), RED), card('Value', money(a.returns), ROSE)],
            [{ key: 'po', label: 'PO' }, { key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'reason', label: 'Reason' }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rt-sup', title: 'Returns by Supplier', desc: 'Returned value per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].sort((x, y) => y[1].returns - x[1].returns).map(([k, a]) => ({ group: k, returns: num(a.returnsCount), value: money2(a.returns), __txns: a.txns }))
          return {
            ...baseView(f, 'Returns by Supplier', 'Returned value per supplier.', 'returns-by-supplier',
              [card('Return value', money(totals(list).returns), ROSE)],
              [{ key: 'group', label: 'Supplier' }, { key: 'returns', label: 'Returns', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.returns) })) }, chartTitle: 'Returns by supplier',
          }
        },
      },
      {
        id: 'rt-prod', title: 'Returns by Product', desc: 'Returned units per product.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned)
          const m = new Map<string, { qty: number; value: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) if (l.returnedQty > 0) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.returnedQty; cur.value += l.returnedQty * l.unitCost; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].value - x[1].value).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          return baseView(f, 'Returns by Product', 'Returned units per product.', 'returns-by-product-p',
            [card('Products', num(m.size), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rt-reason', title: 'Return Reason Analysis', desc: 'Returns grouped by reason.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned)
          const g = groupAgg(list, (t) => t.returnReason ?? '—')
          const rows = [...g.entries()].sort((x, y) => y[1].returns - x[1].returns).map(([k, a]) => ({ group: k, returns: num(a.returnsCount), value: money2(a.returns), __txns: a.txns }))
          return {
            ...baseView(f, 'Return Reason Analysis', 'Returns grouped by reason.', 'return-reason-analysis',
              [card('Returns', num(list.length), RED)],
              [{ key: 'group', label: 'Reason' }, { key: 'returns', label: 'Returns', right: true }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.returns) })) }, chartTitle: 'Returns by reason',
          }
        },
      },
      {
        id: 'rt-defect', title: 'Defective Product Analysis', desc: 'Defective/quality returns per product.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned && (t.returnReason === 'Defective' || t.returnReason === 'Quality issue'))
          const m = new Map<string, { qty: number; value: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) if (l.returnedQty > 0) {
            const cur = m.get(l.productId) ?? { qty: 0, value: 0, txns: [] }
            cur.qty += l.returnedQty; cur.value += l.returnedQty * l.unitCost; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].sort((x, y) => y[1].value - x[1].value).map(([k, v]) => ({ group: productName(k), qty: num(v.qty), value: money2(v.value), __txns: v.txns }))
          return baseView(f, 'Defective Product Analysis', 'Defective/quality returns per product.', 'defective-analysis',
            [card('Defective returns', num(list.length), RED)],
            [{ key: 'group', label: 'Product' }, { key: 'qty', label: 'Units', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rt-hist', title: 'Supplier Return History', desc: 'Chronological return history per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.returned).sort((x, y) => y.date.localeCompare(x.date))
          const rows = list.map((t) => ({ date: dmy(t.date), po: t.id, supplier: t.supplier, reason: t.returnReason ?? '—', value: money2(t.returnValue), __txns: [t] }))
          return baseView(f, 'Supplier Return History', 'Chronological return history per supplier.', 'supplier-return-history',
            [card('Returns', num(list.length), RED)],
            [{ key: 'date', label: 'Date' }, { key: 'po', label: 'PO' }, { key: 'supplier', label: 'Supplier' }, { key: 'reason', label: 'Reason' }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'rt-cost', title: 'Return Cost Analysis', desc: 'Monthly return cost vs purchase value.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), purchases: money2(a.gross), returns: money2(a.returns), rate: pct(a.gross ? (a.returns / a.gross) * 100 : 0), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Return Cost Analysis', 'Monthly return cost vs purchase value.', 'return-cost-analysis',
              [card('Purchases', money(a.gross), GREEN), card('Returns', money(a.returns), ROSE)],
              [{ key: 'group', label: 'Month' }, { key: 'purchases', label: 'Purchases', right: true }, { key: 'returns', label: 'Returns', right: true }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.returns) })), aLabel: 'Returns ₵' }, chartTitle: 'Return cost trend',
          }
        },
      },
    ],
  },
  {
    id: 'cost', title: 'Cost & Expense Analysis Reports',
    reports: [
      {
        id: 'co-proc', title: 'Procurement Cost Analysis', desc: 'Monthly goods value, charges and landed cost.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), gross: money2(a.gross), charges: money2(a.charges), landed: money2(a.landed), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Procurement Cost Analysis', 'Monthly goods value, charges and landed cost.', 'procurement-cost',
              [card('Goods', money(a.gross), GREEN), card('Charges', money(a.charges), AMBER), card('Landed', money(a.landed), VIOLET)],
              [{ key: 'group', label: 'Month' }, { key: 'gross', label: 'Goods', right: true }, { key: 'charges', label: 'Charges', right: true }, { key: 'landed', label: 'Landed', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.gross), b: Math.round(g.get(k)!.landed) })), aLabel: 'Goods', bLabel: 'Landed' }, chartTitle: 'Goods vs landed',
          }
        },
      },
      {
        id: 'co-landed', title: 'Landed Cost Analysis', desc: 'Landed cost per product incl. allocated charges.',
        build: (f) => {
          const list = filterTxns(f)
          const m = new Map<string, { gross: number; landed: number; txns: PurTxn[] }>()
          for (const t of list) {
            const share = t.gross > 0 ? t.landed / t.gross : 1
            for (const l of t.lines) {
              const cur = m.get(l.productId) ?? { gross: 0, landed: 0, txns: [] }
              const lineGross = l.qty * l.unitCost
              cur.gross += lineGross; cur.landed += lineGross * share; cur.txns.push(t)
              m.set(l.productId, cur)
            }
          }
          const rows = [...m.entries()].sort((x, y) => y[1].landed - x[1].landed).map(([k, v]) => ({ group: productName(k), goods: money2(v.gross), landed: money2(v.landed), uplift: pct(v.gross ? ((v.landed - v.gross) / v.gross) * 100 : 0), __txns: v.txns }))
          const a = totals(list)
          return baseView(f, 'Landed Cost Analysis', 'Landed cost per product incl. allocated charges.', 'landed-cost-analysis',
            [card('Landed', money(a.landed), VIOLET), card('Uplift', pct(a.gross ? ((a.landed - a.gross) / a.gross) * 100 : 0), AMBER)],
            [{ key: 'group', label: 'Product' }, { key: 'goods', label: 'Goods', right: true }, { key: 'landed', label: 'Landed', right: true }, { key: 'uplift', label: 'Uplift', right: true }], rows)
        },
      },
      {
        id: 'co-charges', title: 'Additional Purchase Charges', desc: 'Freight, tax, duty and other charges.',
        build: (f) => {
          const list = filterTxns(f)
          const a = totals(list)
          const rows = [
            { group: 'Freight', value: money2(list.reduce((s, t) => s + t.freight, 0)) },
            { group: 'Tax / VAT', value: money2(list.reduce((s, t) => s + t.tax, 0)) },
            { group: 'Import duty', value: money2(list.reduce((s, t) => s + t.importDuty, 0)) },
            { group: 'Other charges', value: money2(list.reduce((s, t) => s + t.otherCharges, 0)) },
          ]
          return {
            ...baseView(f, 'Additional Purchase Charges', 'Freight, tax, duty and other charges.', 'additional-charges',
              [card('Total charges', money(a.charges), AMBER), card('Charge rate', pct(a.landed ? (a.charges / a.landed) * 100 : 0), ROSE)],
              [{ key: 'group', label: 'Charge type' }, { key: 'value', label: 'Value', right: true }], rows),
            chart: { kind: 'pie', data: rows.map((r) => ({ name: String(r.group), value: Math.round(a.charges) })) }, chartTitle: 'Charge composition',
          }
        },
      },
      {
        id: 'co-freight', title: 'Freight Cost Analysis', desc: 'Freight spend per supplier.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.freight > 0)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, pos: num(a.pos), freight: money2(a.txns.reduce((s, t) => s + t.freight, 0)), perPO: money2(a.txns.reduce((s, t) => s + t.freight, 0) / Math.max(1, a.pos)), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.freight).replace(/[₵,]/g, '')) - parseFloat(String(x.freight).replace(/[₵,]/g, '')))
          const total = list.reduce((s, t) => s + t.freight, 0)
          return baseView(f, 'Freight Cost Analysis', 'Freight spend per supplier.', 'freight-analysis',
            [card('Freight', money(total), AMBER)],
            [{ key: 'group', label: 'Supplier' }, { key: 'pos', label: 'POs', right: true }, { key: 'freight', label: 'Freight', right: true }, { key: 'perPO', label: 'Per PO', right: true }], rows)
        },
      },
      {
        id: 'co-import', title: 'Import Cost Analysis', desc: 'Import duty and related costs.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.importDuty > 0)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, pos: num(a.pos), duty: money2(a.txns.reduce((s, t) => s + t.importDuty, 0)), __txns: a.txns }))
          const total = list.reduce((s, t) => s + t.importDuty, 0)
          return baseView(f, 'Import Cost Analysis', 'Import duty and related costs.', 'import-cost-analysis',
            [card('Import duty', money(total), AMBER), card('Import POs', num(list.length), BLUE)],
            [{ key: 'group', label: 'Supplier' }, { key: 'pos', label: 'POs', right: true }, { key: 'duty', label: 'Duty', right: true }], rows)
        },
      },
      {
        id: 'co-tax', title: 'Tax on Purchases Report', desc: 'Monthly purchase tax (VAT).',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), gross: money2(a.gross), tax: money2(a.txns.reduce((s, t) => s + t.tax, 0)), __txns: a.txns } })
          const tax = list.reduce((s, t) => s + t.tax, 0)
          return {
            ...baseView(f, 'Tax on Purchases Report', 'Monthly purchase tax (VAT).', 'tax-on-purchases',
              [card('Tax paid', money(tax), AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'gross', label: 'Goods', right: true }, { key: 'tax', label: 'Tax', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.txns.reduce((s, t) => s + t.tax, 0)) })), aLabel: 'Tax ₵' }, chartTitle: 'Monthly purchase tax',
          }
        },
      },
      {
        id: 'co-break', title: 'Purchase Expense Breakdown', desc: 'Where every cedi of landed cost goes.',
        build: (f) => {
          const list = filterTxns(f)
          const a = totals(list)
          const rows = [
            { group: 'Goods value', value: money2(a.gross), share: pct(a.landed ? (a.gross / a.landed) * 100 : 0) },
            { group: 'Freight', value: money2(list.reduce((s, t) => s + t.freight, 0)), share: pct(a.landed ? (list.reduce((s, t) => s + t.freight, 0) / a.landed) * 100 : 0) },
            { group: 'Tax / VAT', value: money2(list.reduce((s, t) => s + t.tax, 0)), share: pct(a.landed ? (list.reduce((s, t) => s + t.tax, 0) / a.landed) * 100 : 0) },
            { group: 'Import duty', value: money2(list.reduce((s, t) => s + t.importDuty, 0)), share: pct(a.landed ? (list.reduce((s, t) => s + t.importDuty, 0) / a.landed) * 100 : 0) },
            { group: 'Other', value: money2(list.reduce((s, t) => s + t.otherCharges, 0)), share: pct(a.landed ? (list.reduce((s, t) => s + t.otherCharges, 0) / a.landed) * 100 : 0) },
          ]
          return {
            ...baseView(f, 'Purchase Expense Breakdown', 'Where every cedi of landed cost goes.', 'expense-breakdown',
              [card('Landed', money(a.landed), VIOLET)],
              [{ key: 'group', label: 'Component' }, { key: 'value', label: 'Value', right: true }, { key: 'share', label: 'Share', right: true }], rows),
            chart: { kind: 'pie', data: rows.map((r) => ({ name: String(r.group), value: Math.round(parseFloat(String(r.value).replace(/[₵,]/g, ''))) })) }, chartTitle: 'Landed cost composition',
          }
        },
      },
      {
        id: 'co-save', title: 'Cost Saving Opportunities Report', desc: 'Suppliers with high charges or poor OTD — consolidation candidates.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => {
            const chargeRate = a.landed ? (a.charges / a.landed) * 100 : 0
            const otd = a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 100
            return { group: k, landed: money2(a.landed), chargeRate: pct(chargeRate), otd: pct(otd), potential: money2(a.charges + (100 - otd) / 100 * a.landed * 0.05), __txns: a.txns }
          }).sort((x, y) => parseFloat(String(y.chargeRate)) - parseFloat(String(x.chargeRate)))
          const a = totals(list)
          return baseView(f, 'Cost Saving Opportunities Report', 'Suppliers with high charges or poor OTD — consolidation candidates.', 'cost-saving-opportunities',
            [card('Negotiated savings', money(a.savings), LIME), card('Charges paid', money(a.charges), AMBER)],
            [{ key: 'group', label: 'Supplier' }, { key: 'landed', label: 'Spend', right: true }, { key: 'chargeRate', label: 'Charge %', right: true }, { key: 'otd', label: 'OTD', right: true }, { key: 'potential', label: 'Saving potential', right: true }], rows)
        },
      },
    ],
  },
  {
    id: 'invty', title: 'Inventory Procurement Reports',
    reports: [
      {
        id: 'in-replen', title: 'Stock Replenishment Report', desc: 'Items at or below reorder point.',
        build: (f) => {
          void f
          const rows = STOCK.filter((s) => s.onHand <= s.reorderPoint).map((s) => ({ group: productName(s.productId), onHand: num(s.onHand), reorder: num(s.reorderPoint), usage: num(s.monthlyUsage), suggest: num(Math.max(0, s.reorderPoint * 2 - s.onHand)) }))
          return baseView(f, 'Stock Replenishment Report', 'Items at or below reorder point.', 'stock-replenishment',
            [card('Below reorder', num(rows.length), RED), card('Catalogue', num(STOCK.length), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'onHand', label: 'On hand', right: true }, { key: 'reorder', label: 'Reorder pt', right: true }, { key: 'usage', label: 'Monthly use', right: true }, { key: 'suggest', label: 'Suggested buy', right: true }], rows)
        },
      },
      {
        id: 'in-reorder', title: 'Reorder Analysis', desc: 'Coverage days and reorder urgency.',
        build: (f) => {
          void f
          const rows = STOCK.map((s) => ({ group: productName(s.productId), onHand: num(s.onHand), coverage: `${Math.round((s.onHand / Math.max(1, s.monthlyUsage)) * 30)}d`, urgency: s.onHand <= s.reorderPoint ? 'Reorder now' : s.onHand <= s.reorderPoint * 1.3 ? 'Plan soon' : 'Healthy' }))
            .sort((x, y) => (String(x.urgency) === 'Reorder now' ? -1 : String(y.urgency) === 'Reorder now' ? 1 : 0))
          return baseView(f, 'Reorder Analysis', 'Coverage days and reorder urgency.', 'reorder-analysis',
            [card('Reorder now', num(rows.filter((r) => r.urgency === 'Reorder now').length), RED)],
            [{ key: 'group', label: 'Product' }, { key: 'onHand', label: 'On hand', right: true }, { key: 'coverage', label: 'Coverage', right: true }, { key: 'urgency', label: 'Urgency' }], rows)
        },
      },
      {
        id: 'in-plan', title: 'Inventory Purchase Planning', desc: 'Planned (reorder-based) vs actual purchases per month.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const planTotal = STOCK.reduce((s, x) => s + x.monthlyUsage, 0)
          const rows = keys.map((k) => ({ group: monthLabel(k), planned: num(planTotal), actual: num(g.get(k)!.qty), __txns: g.get(k)!.txns }))
          return {
            ...baseView(f, 'Inventory Purchase Planning', 'Planned (reorder-based) vs actual purchases per month.', 'purchase-planning',
              [card('Monthly plan', num(planTotal), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'planned', label: 'Planned units', right: true }, { key: 'actual', label: 'Purchased', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: planTotal, b: g.get(k)!.qty })), aLabel: 'Planned', bLabel: 'Purchased' }, chartTitle: 'Plan vs actual',
          }
        },
      },
      {
        id: 'in-lead', title: 'Lead Time Forecasting', desc: 'Average lead time per product (for planning).',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const m = new Map<string, { sum: number; n: number; txns: PurTxn[] }>()
          for (const t of list) for (const l of t.lines) {
            const cur = m.get(l.productId) ?? { sum: 0, n: 0, txns: [] }
            cur.sum += t.leadDays; cur.n++; cur.txns.push(t)
            m.set(l.productId, cur)
          }
          const rows = [...m.entries()].map(([k, v]) => ({ group: productName(k), deliveries: num(v.n), avgLead: `${(v.sum / v.n).toFixed(1)}d`, buffer: `${Math.ceil((v.sum / v.n) * 1.2)}d`, __txns: v.txns }))
            .sort((x, y) => parseFloat(String(y.avgLead)) - parseFloat(String(x.avgLead)))
          return baseView(f, 'Lead Time Forecasting', 'Average lead time per product (for planning).', 'lead-time-forecast',
            [card('Products', num(m.size), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'deliveries', label: 'Deliveries', right: true }, { key: 'avgLead', label: 'Avg lead', right: true }, { key: 'buffer', label: 'Buffered', right: true }], rows)
        },
      },
      {
        id: 'in-cover', title: 'Stock Coverage Analysis', desc: 'Months of coverage per product.',
        build: (f) => {
          void f
          const rows = STOCK.map((s) => ({ group: productName(s.productId), onHand: num(s.onHand), monthly: num(s.monthlyUsage), coverage: `${(s.onHand / Math.max(1, s.monthlyUsage)).toFixed(1)}mo` }))
            .sort((x, y) => parseFloat(String(x.coverage)) - parseFloat(String(y.coverage)))
          return baseView(f, 'Stock Coverage Analysis', 'Months of coverage per product.', 'stock-coverage',
            [card('Items', num(STOCK.length), BLUE)],
            [{ key: 'group', label: 'Product' }, { key: 'onHand', label: 'On hand', right: true }, { key: 'monthly', label: 'Monthly use', right: true }, { key: 'coverage', label: 'Coverage', right: true }], rows)
        },
      },
      {
        id: 'in-forecast', title: 'Procurement Forecast', desc: 'Next-month forecast = 3-month average spend.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort().slice(-3)
          const avg = keys.length ? keys.reduce((s, k) => s + g.get(k)!.landed, 0) / keys.length : 0
          const rows: Row[] = [...g.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([k, a]) => ({ group: monthLabel(k), landed: money2(a.landed), __txns: a.txns }))
          rows.push({ group: 'NEXT MONTH (forecast)', landed: money2(avg) })
          return {
            ...baseView(f, 'Procurement Forecast', 'Next-month forecast = 3-month average spend.', 'procurement-forecast',
              [card('Forecast', money(avg), VIOLET, 'next month'), card('3-mo avg basis', num(keys.length), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'landed', label: 'Landed', right: true }], rows),
            chart: { kind: 'line', data: rows.slice(0, -1).map((r) => ({ name: String(r.group), a: Math.round(parseFloat(String(r.landed).replace(/[₵,]/g, ''))) })), aLabel: 'Landed ₵' }, chartTitle: 'Spend history & forecast basis',
          }
        },
      },
      {
        id: 'in-demand', title: 'Demand vs Purchase Analysis', desc: 'Monthly usage (demand) vs purchased units.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const demand = STOCK.reduce((s, x) => s + x.monthlyUsage, 0)
          const rows = keys.map((k) => ({ group: monthLabel(k), demand: num(demand), purchased: num(g.get(k)!.qty), gap: num(g.get(k)!.qty - demand), __txns: g.get(k)!.txns }))
          return {
            ...baseView(f, 'Demand vs Purchase Analysis', 'Monthly usage (demand) vs purchased units.', 'demand-vs-purchase',
              [card('Monthly demand', num(demand), BLUE)],
              [{ key: 'group', label: 'Month' }, { key: 'demand', label: 'Demand', right: true }, { key: 'purchased', label: 'Purchased', right: true }, { key: 'gap', label: 'Gap', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: demand, b: g.get(k)!.qty })), aLabel: 'Demand', bLabel: 'Purchased' }, chartTitle: 'Demand vs purchases',
          }
        },
      },
    ],
  },
  {
    id: 'branch', title: 'Branch & Warehouse Purchase Reports',
    reports: [
      dimReport('br-branch', 'Purchases by Branch', 'Spend per branch.', (t) => t.branch, 'purchases-by-branch', 'bar'),
      dimReport('br-wh', 'Purchases by Warehouse', 'Spend per warehouse.', (t) => t.warehouse, 'purchases-by-warehouse', 'bar'),
      {
        id: 'br-recv', title: 'Warehouse Receiving Performance', desc: 'GRNs, on-time rate and variances per warehouse.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, (t) => t.warehouse)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, grns: num(a.txns.length), onTime: pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), variances: num(a.txns.filter((t) => t.qtyVariance !== 0).length), value: money2(a.landed), __txns: a.txns }))
          return baseView(f, 'Warehouse Receiving Performance', 'GRNs, on-time rate and variances per warehouse.', 'warehouse-receiving',
            [card('Warehouses', num(g.size), BLUE)],
            [{ key: 'group', label: 'Warehouse' }, { key: 'grns', label: 'GRNs', right: true }, { key: 'onTime', label: 'On-time', right: true }, { key: 'variances', label: 'Variances', right: true }, { key: 'value', label: 'Value', right: true }], rows)
        },
      },
      {
        id: 'br-inter', title: 'Inter-Branch Procurement Analysis', desc: 'Inter-branch vs direct purchases.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => (t.interBranch ? 'Inter-branch' : 'Direct'))
          const rows = [...g.entries()].map(([k, a]) => aggRow(k, a))
          return {
            ...baseView(f, 'Inter-Branch Procurement Analysis', 'Inter-branch vs direct purchases.', 'inter-branch',
              [card('POs', num(list.length), BLUE)], STD_COLS, rows),
            chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'Inter-branch share',
          }
        },
      },
      {
        id: 'br-comp', title: 'Branch Procurement Comparison', desc: 'Branch league table.',
        build: (f) => {
          const v = dimReport('x', 'Branch Procurement Comparison', '', (t) => t.branch, 'branch-comparison', 'bar').build(f)
          v.desc = 'Branch league table.'
          return v
        },
      },
    ],
  },
  {
    id: 'kpi', title: 'Procurement KPI Reports',
    reports: [
      {
        id: 'kp-cycle', title: 'Procurement Cycle Time', desc: 'Approval + lead time per month.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => {
            const a = g.get(k)!
            const cycle = a.pos ? a.txns.reduce((s, t) => s + t.approvalDays, 0) / a.pos + (a.leadCount ? a.leadSum / a.leadCount : 0) : 0
            return { group: monthLabel(k), cycle: `${cycle.toFixed(1)}d`, __txns: a.txns }
          })
          const a = totals(list)
          const cycle = a.pos ? list.reduce((s, t) => s + t.approvalDays, 0) / a.pos + (a.leadCount ? a.leadSum / a.leadCount : 0) : 0
          return {
            ...baseView(f, 'Procurement Cycle Time', 'Approval + lead time per month.', 'cycle-time',
              [card('Avg cycle', `${cycle.toFixed(1)}d`, AMBER)],
              [{ key: 'group', label: 'Month' }, { key: 'cycle', label: 'Cycle time', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.cycle)) })), aLabel: 'Days' }, chartTitle: 'Cycle time trend',
          }
        },
      },
      {
        id: 'kp-otd', title: 'Supplier On-Time Delivery Rate', desc: 'Monthly OTD rate.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), otd: pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Supplier On-Time Delivery Rate', 'Monthly OTD rate.', 'otd-rate',
              [card('OTD', pct(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'otd', label: 'OTD', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.otd)) })), aLabel: 'OTD %' }, chartTitle: 'On-time delivery trend',
          }
        },
      },
      {
        id: 'kp-fulfil', title: 'Purchase Order Fulfillment Rate', desc: 'Monthly closed-PO rate.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; const c = a.txns.filter((t) => t.poStatus === 'closed').length; return { group: monthLabel(k), rate: pct(a.pos ? (c / a.pos) * 100 : 0), __txns: a.txns } })
          const c = list.filter((t) => t.poStatus === 'closed').length
          return {
            ...baseView(f, 'Purchase Order Fulfillment Rate', 'Monthly closed-PO rate.', 'po-fulfilment-rate',
              [card('Fulfillment', pct(list.length ? (c / list.length) * 100 : 0), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.rate)) })), aLabel: '%' }, chartTitle: 'Fulfillment trend',
          }
        },
      },
      {
        id: 'kp-eff', title: 'Procurement Efficiency Score', desc: 'Composite monthly score (OTD 50%, savings 25%, quality 25%).',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const score = (a: PurAgg) => Math.round(
            (a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0) * 0.5 +
            Math.min(100, (a.savings / Math.max(1, a.landed)) * 1000) * 0.25 +
            (1 - Math.min(1, a.returns / Math.max(1, a.gross))) * 100 * 0.25,
          )
          const rows = keys.map((k) => ({ group: monthLabel(k), score: String(score(g.get(k)!)), __txns: g.get(k)!.txns }))
          const a = totals(list)
          return {
            ...baseView(f, 'Procurement Efficiency Score', 'Composite monthly score (OTD 50%, savings 25%, quality 25%).', 'efficiency-score',
              [card('Score', String(score(a)), GREEN, 'out of 100')],
              [{ key: 'group', label: 'Month' }, { key: 'score', label: 'Score', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: Number(r.score) })), aLabel: 'Score' }, chartTitle: 'Efficiency trend',
          }
        },
      },
      {
        id: 'kp-costred', title: 'Cost Reduction KPI', desc: 'Monthly negotiated savings vs goods value.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), savings: money2(a.savings), rate: pct((a.savings / Math.max(1, a.gross + a.savings)) * 100), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Cost Reduction KPI', 'Monthly negotiated savings vs goods value.', 'cost-reduction-kpi',
              [card('Savings', money(a.savings), LIME), card('Rate', pct((a.savings / Math.max(1, a.gross + a.savings)) * 100), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'savings', label: 'Savings', right: true }, { key: 'rate', label: 'Rate', right: true }], rows),
            chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.savings) })), aLabel: 'Savings ₵' }, chartTitle: 'Monthly savings',
          }
        },
      },
      {
        id: 'kp-quality', title: 'Supplier Quality KPI', desc: 'Monthly return rate.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; return { group: monthLabel(k), returnRate: pct(a.gross ? (a.returns / a.gross) * 100 : 0), __txns: a.txns } })
          const a = totals(list)
          return {
            ...baseView(f, 'Supplier Quality KPI', 'Monthly return rate.', 'quality-kpi',
              [card('Return rate', pct(a.gross ? (a.returns / a.gross) * 100 : 0), ROSE)],
              [{ key: 'group', label: 'Month' }, { key: 'returnRate', label: 'Return rate', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.returnRate)) })), aLabel: '%' }, chartTitle: 'Quality trend',
          }
        },
      },
      {
        id: 'kp-savings', title: 'Procurement Savings KPI', desc: 'Savings per supplier.',
        build: (f) => {
          const list = filterTxns(f)
          const g = groupAgg(list, (t) => t.supplier)
          const rows = [...g.entries()].map(([k, a]) => ({ group: k, savings: money2(a.savings), rate: pct((a.savings / Math.max(1, a.gross + a.savings)) * 100), __txns: a.txns }))
            .sort((x, y) => parseFloat(String(y.savings).replace(/[₵,]/g, '')) - parseFloat(String(x.savings).replace(/[₵,]/g, '')))
          const a = totals(list)
          return baseView(f, 'Procurement Savings KPI', 'Savings per supplier.', 'savings-kpi',
            [card('Total savings', money(a.savings), LIME)],
            [{ key: 'group', label: 'Supplier' }, { key: 'savings', label: 'Savings', right: true }, { key: 'rate', label: 'Rate', right: true }], rows)
        },
      },
      {
        id: 'kp-accuracy', title: 'Order Accuracy KPI', desc: 'Receipts without quantity variance.',
        build: (f) => {
          const list = filterTxns(f).filter((t) => t.grn)
          const g = groupAgg(list, bucketMonth)
          const keys = [...g.keys()].sort()
          const rows = keys.map((k) => { const a = g.get(k)!; const ok = a.txns.filter((t) => t.qtyVariance === 0).length; return { group: monthLabel(k), accuracy: pct(a.txns.length ? (ok / a.txns.length) * 100 : 0), __txns: a.txns } })
          const ok = list.filter((t) => t.qtyVariance === 0).length
          return {
            ...baseView(f, 'Order Accuracy KPI', 'Receipts without quantity variance.', 'accuracy-kpi',
              [card('Accuracy', pct(list.length ? (ok / list.length) * 100 : 0), GREEN)],
              [{ key: 'group', label: 'Month' }, { key: 'accuracy', label: 'Accuracy', right: true }], rows),
            chart: { kind: 'line', data: rows.map((r) => ({ name: String(r.group), a: parseFloat(String(r.accuracy)) })), aLabel: '%' }, chartTitle: 'Order accuracy trend',
          }
        },
      },
    ],
  },
  {
    id: 'graph', title: 'Graphical Analytics Dashboard',
    reports: [
      chartReport('g-trend', 'Purchase Trend Line Chart', 'Monthly landed cost & payments.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.landed), b: Math.round(g.get(k)!.paid) })), aLabel: 'Landed', bLabel: 'Payments' }, chartTitle: 'Purchase trend' }
      }),
      chartReport('g-bar', 'Monthly Procurement Bar Chart', 'Monthly landed cost bars.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.landed) })), aLabel: 'Landed' }, chartTitle: 'Monthly procurement' }
      }),
      chartReport('g-spend', 'Spend Analysis Pie Chart', 'Spend share per category.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—')
        return { chart: { kind: 'pie', data: [...g.entries()].sort((x, y) => y[1].landed - x[1].landed).map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'Spend by category' }
      }),
      chartReport('g-supperf', 'Supplier Performance Dashboard', 'OTD vs spend per supplier.', (f) => {
        const g = groupAgg(filterTxns(f).filter((t) => t.grn), (t) => t.supplier)
        return { chart: { kind: 'bar', data: [...g.entries()].sort((x, y) => y[1].landed - x[1].landed).slice(0, 10).map(([k, v]) => ({ name: k, a: Math.round(v.onTime + v.late ? (v.onTime / (v.onTime + v.late)) * 100 : 0) })), aLabel: 'OTD %' }, chartTitle: 'Supplier on-time performance' }
      }),
      chartReport('g-topsup', 'Top Supplier Analysis', 'Top 10 suppliers by spend.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => t.supplier)
        return { chart: { kind: 'bar', data: [...g.entries()].sort((x, y) => y[1].landed - x[1].landed).slice(0, 10).map(([k, v]) => ({ name: k, a: Math.round(v.landed) })), aLabel: 'Landed' }, chartTitle: 'Top suppliers' }
      }),
      chartReport('g-cat', 'Purchase Category Breakdown', 'Spend per category pie.', (f) => {
        const g = groupAgg(filterTxns(f), (t) => productDim(t.lines[0]?.productId ?? '')?.category ?? '—')
        return { chart: { kind: 'pie', data: [...g.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.landed) })) }, chartTitle: 'Category breakdown' }
      }),
      chartReport('g-prodtrend', 'Product Procurement Trend', 'Monthly units for filtered product.', (f) => {
        const pid = f.product || 'sp06'
        const m = new Map<string, number>()
        for (const t of filterTxns(f)) for (const l of t.lines) if (l.productId === pid) m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) + l.qty)
        const keys = [...m.keys()].sort()
        return { chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: m.get(k)! })), aLabel: 'Units' }, chartTitle: `${productName(pid)} procurement` }
      }),
      chartReport('g-costtrend', 'Procurement Cost Trend', 'Goods vs landed monthly.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'line', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.gross), b: Math.round(g.get(k)!.landed) })), aLabel: 'Goods', bLabel: 'Landed' }, chartTitle: 'Cost trend' }
      }),
      chartReport('g-payables', 'Outstanding Payables Dashboard', 'Monthly outstanding balances.', (f) => {
        const g = groupAgg(filterTxns(f), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'area', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.outstanding) })), aLabel: 'Outstanding' }, chartTitle: 'Payables' }
      }),
      chartReport('g-otdgauge', 'Supplier Delivery Performance Gauge', 'Overall OTD rate.', (f) => {
        const a = totals(filterTxns(f).filter((t) => t.grn))
        const otd = Math.round(a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0)
        return {
          chart: { kind: 'pie', data: [{ name: 'On-time', value: otd }, { name: 'Late', value: 100 - otd }] }, chartTitle: `On-time delivery ${otd}%`,
          metrics: [card('On-time rate', pct(otd), GREEN), card('Deliveries', num(a.onTime + a.late), BLUE)],
        }
      }),
      chartReport('g-returns', 'Purchase Return Analysis Chart', 'Monthly return value.', (f) => {
        const g = groupAgg(filterTxns(f).filter((t) => t.returned), bucketMonth); const keys = [...g.keys()].sort()
        return { chart: { kind: 'bar', data: keys.map((k) => ({ name: monthLabel(k), a: Math.round(g.get(k)!.returns) })), aLabel: 'Returns ₵' }, chartTitle: 'Returns' }
      }),
      chartReport('g-kpi', 'Procurement KPI Scorecards', 'Scorecard: OTD, fulfillment, accuracy, savings rate.', (f) => {
        const all = filterTxns(f)
        const grn = all.filter((t) => t.grn)
        const a = totals(all)
        const otd = a.onTime + a.late ? (a.onTime / (a.onTime + a.late)) * 100 : 0
        const fulfil = all.length ? (all.filter((t) => t.poStatus === 'closed').length / all.length) * 100 : 0
        const accuracy = grn.length ? (grn.filter((t) => t.qtyVariance === 0).length / grn.length) * 100 : 0
        const savingsRate = (a.savings / Math.max(1, a.gross + a.savings)) * 100
        return {
          chart: { kind: 'bar', data: [{ name: 'OTD', a: Math.round(otd) }, { name: 'Fulfillment', a: Math.round(fulfil) }, { name: 'Accuracy', a: Math.round(accuracy) }, { name: 'Savings idx', a: Math.round(Math.min(100, savingsRate * 10)) }], aLabel: '%' },
          chartTitle: 'KPI scorecards',
          metrics: [card('OTD', pct(otd), GREEN), card('Fulfillment', pct(fulfil), BLUE), card('Accuracy', pct(accuracy), VIOLET), card('Savings rate', pct(savingsRate), LIME)],
        }
      }),
    ],
  },
]

// ---------------- helpers referenced above ----------------
function dimApproved(f: PurchaseFilters): ReportView {
  const r = f.preset === 'custom' ? { start: f.start, end: f.end } : presetRange(f.preset)
  const rows: Row[] = [...REQS.filter((q) => q.status === 'approved'), ...PTXNS.filter((t) => t.reqStatus === 'approved').map((t) => ({ id: t.reqId, date: t.reqDate, department: t.department, employee: t.buyer, supplier: t.supplier, status: t.reqStatus, approvalDays: t.approvalDays, value: t.gross, converted: true }))]
    .filter((q) => q.date >= r.start && q.date <= r.end)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((q) => ({ id: q.id, date: dmy(q.date), department: q.department, employee: q.employee, supplier: q.supplier, approval: `${q.approvalDays}d`, value: money2(q.value) }))
  return baseView(f, 'Approved Requisitions', 'Approved requisitions in the period.', 'approved-requisitions',
    [card('Approved', num(rows.length), GREEN)],
    [{ key: 'id', label: 'Ref' }, { key: 'date', label: 'Date' }, { key: 'department', label: 'Department' }, { key: 'employee', label: 'Requested by' }, { key: 'supplier', label: 'Supplier' }, { key: 'approval', label: 'Approval time', right: true }, { key: 'value', label: 'Value', right: true }], rows)
}
