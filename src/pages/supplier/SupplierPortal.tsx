import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PageHeader, StatCard, Badge } from '../../components/ui'
import { formatGhs, formatDate } from '../../lib/utils'
import { ClipboardList, Truck, Boxes, Clock } from 'lucide-react'

export function SupplierPortal() {
  const { user } = useAuth()
  const { suppliers, purchaseOrders, purchases, inventory } = useApp()
  const supplier = suppliers.find((s) => s.userId === user?.id)

  const myOrders = supplier ? purchaseOrders.filter((o) => o.supplierId === supplier.id) : []
  const myDeliveries = supplier ? purchases.filter((p) => p.supplierId === supplier.id) : []
  const openOrders = myOrders.filter((o) => o.status === 'draft' || o.status === 'ordered')
  const openTotal = openOrders.reduce((s, o) => s + o.total, 0)
  const suppliedItems = supplier ? inventory.filter((i) => i.supplierId === supplier.id) : []

  return (
    <div>
      <PageHeader
        eyebrow="Supplier portal"
        title={`Welcome, ${supplier?.name || user?.name.split(' ')[0]}.`}
        desc={supplier ? `${supplier.category || 'Supplier'} · ${supplier.email}` : 'Supplier account'}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open orders" value={formatGhs(openTotal)} hint={`${openOrders.length} outstanding`} icon={<ClipboardList className="size-4" />} />
        <StatCard label="Purchase orders" value={String(myOrders.length)} icon={<ClipboardList className="size-4" />} />
        <StatCard label="Deliveries" value={String(myDeliveries.length)} icon={<Truck className="size-4" />} />
        <StatCard label="Items supplied" value={String(suppliedItems.length)} icon={<Boxes className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">Purchase orders</h3>
          {myOrders.length ? (
            <table className="data mt-3">
              <thead><tr><th>Number</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {myOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-sm font-semibold">{o.number}</td>
                    <td className="text-mist">{formatDate(o.date)}</td>
                    <td><Badge tone={o.status === 'received' ? 'lime' : o.status === 'cancelled' ? 'rose' : 'amber'}>{o.status}</Badge></td>
                    <td className="text-right font-semibold">{formatGhs(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-mist">No purchase orders on file yet.</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold">Deliveries</h3>
          {myDeliveries.length ? (
            <table className="data mt-3">
              <thead><tr><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {myDeliveries.map((p) => (
                  <tr key={p.id}>
                    <td className="text-mist">{formatDate(p.date)}</td>
                    <td><Badge tone={p.status === 'received' ? 'lime' : 'amber'}>{p.status}</Badge></td>
                    <td className="text-right font-semibold">{formatGhs(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-mist">No deliveries recorded yet.</p>
          )}
        </div>
      </div>

      <div className="card mt-4 p-5">
        <h3 className="font-semibold">Account details</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ['Name', supplier?.name || '—'],
            ['Contact', supplier?.contact || '—'],
            ['Email', user?.email || '—'],
            ['Phone', user?.phone || supplier?.phone || '—'],
            ['Category', supplier?.category || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
              <span className="text-mist">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
