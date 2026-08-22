import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PageHeader, StatCard, Badge } from '../../components/ui'
import { formatGhs, formatDate } from '../../lib/utils'
import { Wallet, FileText, Receipt, Clock } from 'lucide-react'

export function CustomerPortal() {
  const { user } = useAuth()
  const { customers, invoices, sales } = useApp()
  const customer = customers.find((c) => c.userId === user?.id)

  const myInvoices = customer
    ? invoices.filter((i) => {
        const nm = (customer.name || '').toLowerCase()
        const co = (customer.company || '').toLowerCase()
        const c = (i.customerName || '').toLowerCase()
        return c === nm || (co && c === co)
      })
    : []

  const mySales = customer
    ? sales.filter((s) => {
        const nm = (customer.name || '').toLowerCase()
        const co = (customer.company || '').toLowerCase()
        const c = (s.customerName || '').toLowerCase()
        return c === nm || (co && c === co)
      })
    : []

  const openTotal = myInvoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Customer portal"
        title={`Welcome, ${customer?.name || user?.name.split(' ')[0]}.`}
        desc={customer ? `${customer.category} · ${customer.company || 'Individual customer'}` : 'Customer account'}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lifetime spend" value={formatGhs(customer?.totalSpent || 0)} icon={<Wallet className="size-4" />} />
        <StatCard label="Open invoices" value={formatGhs(openTotal)} hint={`${myInvoices.filter((i) => i.status !== 'paid').length} outstanding`} icon={<Receipt className="size-4" />} />
        <StatCard label="Invoices" value={String(myInvoices.length)} icon={<FileText className="size-4" />} />
        <StatCard label="Member since" value={customer ? formatDate(customer.createdAt) : '—'} icon={<Clock className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">Invoices</h3>
          {myInvoices.length ? (
            <table className="data mt-3">
              <thead><tr><th>Number</th><th>Issued</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {myInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-sm font-semibold">{i.number}</td>
                    <td className="text-mist">{formatDate(i.issuedAt)}</td>
                    <td><Badge tone={i.status === 'paid' ? 'lime' : i.status === 'overdue' ? 'rose' : 'amber'}>{i.status}</Badge></td>
                    <td className="text-right font-semibold">{formatGhs(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-mist">No invoices on file yet.</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold">Recent purchases</h3>
          {mySales.length ? (
            <table className="data mt-3">
              <thead><tr><th>Date</th><th>Method</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {mySales.map((s) => (
                  <tr key={s.id}>
                    <td className="text-mist">{formatDate(s.date)}</td>
                    <td>{s.method}</td>
                    <td className="text-right font-semibold">{formatGhs(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-mist">No purchases recorded yet.</p>
          )}
        </div>
      </div>

      <div className="card mt-4 p-5">
        <h3 className="font-semibold">Account details</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ['Name', customer?.name || '—'],
            ['Email', user?.email || '—'],
            ['Phone', user?.phone || '—'],
            ['Category', customer?.category || '—'],
            ['Company', customer?.company || '—'],
            ['Address', customer?.address || '—'],
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
