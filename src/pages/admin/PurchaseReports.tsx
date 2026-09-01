import { useMemo } from 'react'
import { FileText, Truck, RotateCcw, TrendingUp, Printer } from 'lucide-react'
import { PageHeader, Button, StatCard, Badge, Segmented, Empty } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../lib/utils'
import { Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'

const PIE_COLORS = ['#C8F542', '#38BDF8', '#A78BFA', '#FBBF24', '#FB7185', '#34D399', '#60A5FA', '#F59E0B']

export function PurchaseReports() {
  const app = useApp()
  const { purchases, purchaseOrders, purchaseReturns, suppliers, inventory } = app
  const toast = useToast()

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id

  // ---- Summary metrics ----
  const totalSpend = purchases.reduce((s, p) => s + p.total, 0)
  const openOrders = purchaseOrders.filter((o) => o.status === 'draft' || o.status === 'ordered')
  const openOrdersValue = openOrders.reduce((s, o) => s + o.total, 0)
  const returnValue = purchaseReturns.reduce((s, r) => s + r.total, 0)
  const receivedCount = purchases.filter((p) => p.status === 'received').length

  // ---- Supplier breakdown ----
  const bySupplier = useMemo(() => {
    const map = new Map<string, number>()
    purchases.forEach((p) => map.set(p.supplierId, (map.get(p.supplierId) || 0) + p.total))
    purchaseOrders.forEach((o) => map.set(o.supplierId, (map.get(o.supplierId) || 0) + o.total))
    return Array.from(map.entries())
      .map(([id, total]) => ({ name: supplierName(id), value: total }))
      .sort((a, b) => b.value - a.value)
  }, [purchases, purchaseOrders, suppliers])

  // ---- Monthly spend ----
  const byMonth = useMemo(() => {
    const map = new Map<string, number>()
    purchases.forEach((p) => {
      const m = (p.date || p.createdAt).slice(0, 7)
      map.set(m, (map.get(m) || 0) + p.total)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }))
  }, [purchases])

  // ---- Top items purchased ----
  const topItems = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>()
    const add = (itemId: string, qty: number, value: number) => {
      const cur = map.get(itemId) || { qty: 0, value: 0 }
      map.set(itemId, { qty: cur.qty + qty, value: cur.value + value })
    }
    purchases.forEach((p) => p.lines.forEach((l) => add(l.itemId, l.quantity, l.quantity * l.unitCost)))
    purchaseOrders.forEach((o) => o.lines.forEach((l) => add(l.itemId, l.quantity, l.quantity * l.unitCost)))
    return Array.from(map.entries())
      .map(([id, v]) => ({ name: itemName(id), ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [purchases, purchaseOrders, inventory])

  // ---- Report blocks (exportable) ----
  const blocks = [
    {
      t: 'Purchase summary', d: `${purchases.length} purchases · ${formatGhs(totalSpend)}`,
      filename: 'purchase-summary',
      rows: purchases.map((p) => ({ number: p.number, supplier: supplierName(p.supplierId), date: p.date, status: p.status, total: p.total })),
    },
    {
      t: 'Purchase orders', d: `${purchaseOrders.length} orders`,
      filename: 'purchase-orders',
      rows: purchaseOrders.map((o) => ({ number: o.number, supplier: supplierName(o.supplierId), date: o.date, expected: o.expectedDate || '', status: o.status, total: o.total })),
    },
    {
      t: 'Purchase returns', d: `${purchaseReturns.length} returns · ${formatGhs(returnValue)}`,
      filename: 'purchase-returns',
      rows: purchaseReturns.map((r) => ({ number: r.number, supplier: supplierName(r.supplierId), date: r.date, reason: r.reason || '', status: r.status, total: r.total })),
    },
    {
      t: 'Spend by supplier', d: `${bySupplier.length} suppliers`,
      filename: 'spend-by-supplier',
      rows: bySupplier.map((s) => ({ supplier: s.name, total: s.value })),
    },
    {
      t: 'Monthly spend', d: `${byMonth.length} months`,
      filename: 'monthly-spend',
      rows: byMonth.map((m) => ({ month: m.month, total: m.total })),
    },
    {
      t: 'Top purchased items', d: `${topItems.length} items`,
      filename: 'top-items',
      rows: topItems.map((i) => ({ item: i.name, quantity: i.qty, value: i.value })),
    },
  ]

  const summaryRows = [
    { label: 'Total purchases', value: String(purchases.length) },
    { label: 'Received', value: String(receivedCount) },
    { label: 'Total spend', value: formatGhsExact(totalSpend) },
    { label: 'Open orders', value: `${openOrders.length} (${formatGhs(openOrdersValue)})` },
    { label: 'Returns value', value: formatGhsExact(returnValue) },
    { label: 'Suppliers', value: String(suppliers.length) },
  ]

  return (
    <div>
      <PageHeader
        title="Purchase reports"
        desc="Spend, orders, returns, and supplier analytics for procurement."
        actions={
          <Button variant="outline" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}>
            <Printer className="size-5" style={{ width: 20, height: 20 }} /> Print / PDF
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total spend" value={formatGhs(totalSpend)} icon={<TrendingUp className="size-4" />} />
        <StatCard label="Open orders" value={formatGhs(openOrdersValue)} hint={`${openOrders.length} orders`} icon={<Truck className="size-4" />} />
        <StatCard label="Returns" value={formatGhs(returnValue)} hint={`${purchaseReturns.length} returns`} icon={<RotateCcw className="size-4" />} />
        <StatCard label="Received" value={String(receivedCount)} hint={`of ${purchases.length} purchases`} icon={<FileText className="size-4" />} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Monthly spend</p>
          {byMonth.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Bar dataKey="total" fill="#C8F542" name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No purchases yet" />}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Spend by supplier</p>
          {bySupplier.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySupplier} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {bySupplier.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No supplier data" />}
        </div>
      </div>

      {/* Top items */}
      {topItems.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="mb-3 text-sm font-semibold">Top purchased items</p>
          <div className="grid gap-2 md:grid-cols-2">
            {topItems.map((i, idx) => (
              <div key={i.name} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone="zinc">#{idx + 1}</Badge>
                  <span className="truncate">{i.name}</span>
                </span>
                <span className="text-mist">{i.qty} units · <span className="font-semibold text-inherit">{formatGhs(i.value)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="card mt-4 table-wrap">
        <table className="data">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            {summaryRows.map((r) => (
              <tr key={r.label}><td className="font-semibold">{r.label}</td><td>{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

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
        Reports are generated from your live purchase, order, return, and supplier data. Dates shown as {formatDate(new Date().toISOString())}.
      </p>
    </div>
  )
}
