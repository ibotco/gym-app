import { useMemo } from 'react'
import { FileText, TrendingUp, Receipt, ClipboardList, Truck, RotateCcw, Percent, Printer, Package } from 'lucide-react'
import { PageHeader, Button, StatCard, Badge, Empty } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../lib/utils'
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { methodLabel } from '../../lib/paystack'

const PIE_COLORS = ['#C8F542', '#38BDF8', '#A78BFA', '#FBBF24', '#FB7185', '#34D399', '#60A5FA', '#F59E0B']

export function SalesReports() {
  const app = useApp()
  const { sales, invoices, proposals, estimates, salesOrders, shipments, discounts, salesReturns, inventory, members, users } = app
  const toast = useToast()

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const memberName = (id?: string) => {
    const m = members.find((x) => x.id === id)
    return m ? users.find((u) => u.id === m.userId)?.name || id : undefined
  }

  // ---- Summary metrics ----
  const totalRevenue = sales.filter((s) => s.status !== 'refunded').reduce((sum, s) => sum + s.total, 0)
  const returnsValue = salesReturns.reduce((sum, r) => sum + r.total, 0)
  const openOrdersValue = salesOrders.filter((o) => o.status === 'draft' || o.status === 'confirmed').reduce((sum, o) => sum + o.total, 0)
  const inTransit = shipments.filter((s) => s.status === 'shipped' || s.status === 'in_transit').length
  const activeDiscounts = discounts.filter((d) => d.status === 'active').length

  // ---- Sales by month ----
  const salesByMonth = useMemo(() => {
    const map = new Map<string, number>()
    sales.forEach((s) => {
      if (s.status === 'refunded') return
      const m = (s.date || s.createdAt).slice(0, 7)
      map.set(m, (map.get(m) || 0) + s.total)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }))
  }, [sales])

  // ---- Sales by payment method ----
  const salesByMethod = useMemo(() => {
    const map = new Map<string, number>()
    sales.forEach((s) => {
      if (s.status === 'refunded') return
      map.set(s.method, (map.get(s.method) || 0) + s.total)
    })
    return Array.from(map.entries()).map(([method, value]) => ({ name: methodLabel(method), value }))
  }, [sales])

  // ---- Top selling products ----
  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>()
    sales.forEach((s) => s.lines.forEach((l) => {
      const cur = map.get(l.itemId) || { qty: 0, value: 0 }
      map.set(l.itemId, { qty: cur.qty + l.quantity, value: cur.value + l.quantity * l.unitPrice })
    }))
    return Array.from(map.entries())
      .map(([id, v]) => ({ name: itemName(id), ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [sales, inventory])

  // ---- Document pipeline summary ----
  const pipeline = [
    { label: 'Proposals', count: proposals.length, value: proposals.reduce((s, p) => s + p.total, 0) },
    { label: 'Estimates', count: estimates.length, value: estimates.reduce((s, e) => s + e.total, 0) },
    { label: 'Sales orders', count: salesOrders.length, value: salesOrders.reduce((s, o) => s + o.total, 0) },
    { label: 'Invoices', count: invoices.length, value: invoices.reduce((s, i) => s + i.total, 0) },
    { label: 'Shipments', count: shipments.length, value: shipments.reduce((s, sh) => s + sh.total, 0) },
    { label: 'Sales returns', count: salesReturns.length, value: salesReturns.reduce((s, r) => s + r.total, 0) },
  ]

  // ---- Report blocks (exportable) ----
  const blocks = [
    { t: 'Sales summary', d: `${sales.length} sales · ${formatGhs(totalRevenue)}`, filename: 'sales-summary', rows: sales.map((s) => ({ number: s.number, customer: s.memberId ? memberName(s.memberId) : s.customerName, date: s.date, method: s.method, total: s.total, status: s.status })) },
    { t: 'Sales by month', d: `${salesByMonth.length} months`, filename: 'sales-by-month', rows: salesByMonth.map((m) => ({ month: m.month, revenue: m.total })) },
    { t: 'Sales by payment method', d: `${salesByMethod.length} methods`, filename: 'sales-by-method', rows: salesByMethod.map((m) => ({ method: m.name, revenue: m.value })) },
    { t: 'Top selling products', d: `${topProducts.length} products`, filename: 'top-products', rows: topProducts.map((p) => ({ product: p.name, quantity: p.qty, value: p.value })) },
    { t: 'Sales orders', d: `${salesOrders.length} orders`, filename: 'sales-orders', rows: salesOrders.map((o) => ({ number: o.number, customer: o.memberId ? memberName(o.memberId) : o.customerName, date: o.date, total: o.total, status: o.status })) },
    { t: 'Invoices', d: `${invoices.length} invoices`, filename: 'invoices', rows: invoices.map((i) => ({ number: i.number, customer: i.memberId ? memberName(i.memberId) : i.customerName, issued: i.issuedAt, total: i.total, status: i.status })) },
    { t: 'Sales returns', d: `${salesReturns.length} returns · ${formatGhs(returnsValue)}`, filename: 'sales-returns', rows: salesReturns.map((r) => ({ number: r.number, customer: r.memberId ? memberName(r.memberId) : r.customerName, date: r.date, reason: r.reason || '', total: r.total, status: r.status })) },
    { t: 'Shipments', d: `${shipments.length} shipments`, filename: 'shipments', rows: shipments.map((s) => ({ number: s.number, customer: s.memberId ? memberName(s.memberId) : s.customerName, carrier: s.carrier || '', date: s.date, total: s.total, status: s.status })) },
    { t: 'Discounts', d: `${activeDiscounts} active of ${discounts.length}`, filename: 'discounts', rows: discounts.map((d) => ({ code: d.code, name: d.name, type: d.type, value: d.value, used: d.used, status: d.status })) },
  ]

  return (
    <div>
      <PageHeader
        title="Sales reports"
        desc="Revenue, pipeline, and performance across every sales channel."
        actions={
          <Button variant="outline" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}>
            <Printer className="size-5" style={{ width: 20, height: 20 }} /> Print / PDF
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" value={formatGhs(totalRevenue)} hint={`${sales.length} sales`} icon={<TrendingUp className="size-4" />} />
        <StatCard label="Open orders" value={formatGhs(openOrdersValue)} hint="draft + confirmed" icon={<ClipboardList className="size-4" />} />
        <StatCard label="Returns" value={formatGhs(returnsValue)} hint={`${salesReturns.length} returns`} icon={<RotateCcw className="size-4" />} />
        <StatCard label="Active discounts" value={String(activeDiscounts)} hint={`${shipments.length} shipments · ${inTransit} in transit`} icon={<Percent className="size-4" />} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Revenue by month</p>
          {salesByMonth.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByMonth}>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Bar dataKey="total" fill="#C8F542" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No sales yet" />}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Sales by payment method</p>
          {salesByMethod.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={salesByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {salesByMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No sales yet" />}
        </div>
      </div>

      {/* Document pipeline */}
      <div className="card mt-4 p-4">
        <p className="mb-3 text-sm font-semibold">Sales pipeline</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pipeline.map((p) => (
            <div key={p.label} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5 text-sm">
              <span className="font-medium">{p.label}</span>
              <span className="text-mist">{p.count} · <span className="font-semibold text-inherit">{formatGhs(p.value)}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="mb-3 text-sm font-semibold">Top selling products</p>
          <div className="grid gap-2 md:grid-cols-2">
            {topProducts.map((p, idx) => (
              <div key={p.name} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone="zinc">#{idx + 1}</Badge>
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="text-mist">{p.qty} units · <span className="font-semibold text-inherit">{formatGhs(p.value)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exportable reports */}
      <h2 className="font-display mt-8 text-xl">Export reports</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.t} className="card p-5">
            <h3 className="font-semibold">{b.t}</h3>
            <p className="mt-1 text-sm text-mist">{b.d}</p>
            <div className="mt-4">
              <ExportButtons filename={b.filename} rows={b.rows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist">
        Reports are generated from live sales, invoice, order, shipment, return, and discount data. Generated {formatDate(new Date().toISOString())}.
      </p>
    </div>
  )
}
