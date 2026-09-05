import { useMemo, useState } from 'react'
import { Truck, PackageCheck, Receipt, Undo2, Printer, AlertTriangle } from 'lucide-react'
import { PageHeader, Button, StatCard, Segmented, Empty } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../../lib/utils'
import { balanceOf, paidAgainst, receivedQty, statusLabel } from '../../../lib/procurement'
import { ProcStatus, SubHead } from './common'
import { Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'

const PIE_COLORS = ['#C8F542', '#38BDF8', '#A78BFA', '#FBBF24', '#FB7185', '#34D399', '#60A5FA', '#F59E0B']

type Tab = 'overview' | 'orders' | 'receipts' | 'payables' | 'returns'

export function ProcurementReports() {
  const {
    procPurchaseOrders, goodsReceipts, supplierInvoices, supplierPayments, procReturns,
    suppliers, inventory,
  } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const poNumber = (id?: string) => procPurchaseOrders.find((o) => o.id === id)?.number || '—'
  const grnNumber = (id?: string) => goodsReceipts.find((g) => g.id === id)?.number || '—'

  /* ── Headline metrics ─────────────────────────────────────────────── */
  const committed = procPurchaseOrders
    .filter((o) => !['draft', 'rejected', 'cancelled'].includes(o.status))
    .reduce((s, o) => s + o.total, 0)

  const postedReceipts = goodsReceipts.filter((g) => g.status === 'posted')
  const receivedValue = postedReceipts.reduce((s, g) => s + g.total, 0)

  const liveInvoices = supplierInvoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled')
  const invoicedValue = liveInvoices.reduce((s, i) => s + i.total, 0)
  const outstanding = liveInvoices.reduce((s, i) => s + balanceOf(i, supplierPayments), 0)
  const paidValue = supplierPayments.filter((p) => p.status === 'posted').reduce((s, p) => s + p.amount, 0)

  const postedReturns = procReturns.filter((r) => r.status === 'returned' || r.status === 'closed')
  const returnValue = postedReturns.reduce((s, r) => s + r.total, 0)

  /**
   * GRNI exposure: goods received but not yet invoiced. This is the classic
   * three-way-match gap and the number a controller cares about most.
   */
  const grni = useMemo(() => {
    const invoicedGrnIds = new Set(liveInvoices.map((i) => i.goodsReceiptId).filter(Boolean))
    return postedReceipts
      .filter((g) => !invoicedGrnIds.has(g.id))
      .map((g) => ({ grn: g, value: g.total }))
  }, [postedReceipts, liveInvoices])
  const grniValue = grni.reduce((s, r) => s + r.value, 0)

  /* ── Breakdowns ───────────────────────────────────────────────────── */
  const bySupplier = useMemo(() => {
    const map = new Map<string, number>()
    liveInvoices.forEach((i) => map.set(i.supplierId, (map.get(i.supplierId) || 0) + i.total))
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: supplierName(id), value }))
      .sort((a, b) => b.value - a.value)
  }, [liveInvoices, suppliers])

  const byMonth = useMemo(() => {
    const map = new Map<string, number>()
    postedReceipts.forEach((g) => {
      const k = g.date.slice(0, 7)
      map.set(k, (map.get(k) || 0) + g.total)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({ month: m, value: v }))
  }, [postedReceipts])

  const byStatus = useMemo(() => {
    const map = new Map<string, number>()
    procPurchaseOrders.forEach((o) => map.set(o.status, (map.get(o.status) || 0) + 1))
    return Array.from(map.entries()).map(([s, count]) => ({ name: statusLabel(s), value: count }))
  }, [procPurchaseOrders])

  /** Ordered but not fully delivered — the open-commitment list. */
  const openOrders = useMemo(
    () => procPurchaseOrders
      .filter((o) => ['approved', 'sent', 'partially_received'].includes(o.status))
      .map((o) => {
        const ordered = o.lines.reduce((s, l) => s + l.quantity, 0)
        const got = o.lines.reduce((s, l) => s + receivedQty(goodsReceipts, o.id, l.itemId), 0)
        return { o, ordered, got, pct: ordered ? Math.round((got / ordered) * 100) : 0 }
      })
      .sort((a, b) => a.pct - b.pct),
    [procPurchaseOrders, goodsReceipts],
  )

  const today = new Date().toISOString().slice(0, 10)
  const overdue = liveInvoices.filter((i) => i.dueDate && i.dueDate < today && balanceOf(i, supplierPayments) > 0)

  /* ── Export rows follow the active tab ────────────────────────────── */
  const exportRows = useMemo(() => {
    if (tab === 'orders') return openOrders.map(({ o, ordered, got, pct }) => ({
      Number: o.number, Supplier: supplierName(o.supplierId), Date: o.date,
      Status: statusLabel(o.status), Ordered: ordered, Received: got, 'Received %': pct, Total: o.total,
    }))
    if (tab === 'receipts') return postedReceipts.map((g) => ({
      GRN: g.number, Date: g.date, Supplier: supplierName(g.supplierId), PO: poNumber(g.purchaseOrderId),
      Units: g.lines.reduce((s, l) => s + l.quantityReceiving, 0), Value: g.total,
    }))
    if (tab === 'payables') return liveInvoices.map((i) => ({
      Invoice: i.number, Supplier: supplierName(i.supplierId), Date: i.invoiceDate, Due: i.dueDate || '',
      Total: i.total, Paid: paidAgainst(supplierPayments, i.id), Balance: balanceOf(i, supplierPayments),
      Status: statusLabel(i.status),
    }))
    if (tab === 'returns') return procReturns.map((r) => ({
      Return: r.number, Date: r.returnDate, Supplier: supplierName(r.supplierId),
      GRN: grnNumber(r.goodsReceiptId), Reason: r.reason,
      Units: r.lines.reduce((s, l) => s + l.quantityReturned, 0), Value: r.total, Status: statusLabel(r.status),
    }))
    return bySupplier.map((s) => ({ Supplier: s.name, Invoiced: s.value }))
  }, [tab, openOrders, postedReceipts, liveInvoices, procReturns, bySupplier, supplierPayments])

  return (
    <div>
      <PageHeader
        title="Purchase reports"
        desc="Spend, deliveries, payables and returns across the procurement chain."
        actions={
          <div className="flex gap-2">
            <ExportButtons
              filename={`procurement-${tab}`}
              rows={exportRows}
              onDone={(label, ok) => ok ? toast.success(`${label} exported`) : toast.error(`${label} export failed`)}
            />
            <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Committed on orders" value={formatGhs(committed)} icon={<Truck className="size-4" />} />
        <StatCard label="Goods received" value={formatGhs(receivedValue)} hint={`${postedReceipts.length} posted GRNs`} icon={<PackageCheck className="size-4" />} />
        <StatCard label="Outstanding payables" value={formatGhs(outstanding)} hint={`${liveInvoices.length} invoices`} icon={<Receipt className="size-4" />} />
        <StatCard label="Returns" value={formatGhs(returnValue)} hint={`${procReturns.length} returns`} icon={<Undo2 className="size-4" />} />
      </div>

      {(grniValue > 0 || overdue.length > 0) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {grniValue > 0 && (
            <div className="card flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">Received not invoiced — {formatGhsExact(grniValue)}</p>
                <p className="text-xs text-mist">
                  {grni.length} posted receipt(s) have no purchase invoice yet. This is your GRNI accrual.
                </p>
              </div>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="card flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-500" />
              <div>
                <p className="text-sm font-semibold">{overdue.length} overdue invoice(s)</p>
                <p className="text-xs text-mist">
                  {formatGhsExact(overdue.reduce((s, i) => s + balanceOf(i, supplierPayments), 0))} past its due date.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'orders', label: 'Open orders' },
          { id: 'receipts', label: 'Receipts' },
          { id: 'payables', label: 'Payables' },
          { id: 'returns', label: 'Returns' },
        ]}
      />

      <div className="mt-4 space-y-4">
        {tab === 'overview' && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-4">
                <SubHead>Invoiced by supplier</SubHead>
                {bySupplier.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={bySupplier} dataKey="value" nameKey="name" outerRadius={90} label>
                        {bySupplier.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatGhsExact(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty title="No invoices yet" />}
              </div>
              <div className="card p-4">
                <SubHead>Goods received by month</SubHead>
                {byMonth.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byMonth}>
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v) => formatGhsExact(Number(v))} />
                      <Bar dataKey="value" fill="#C8F542" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty title="No posted receipts yet" />}
              </div>
            </div>

            <div className="card p-4">
              <SubHead>Purchase orders by status</SubHead>
              {byStatus.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byStatus}>
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty title="No purchase orders yet" />}
            </div>

            <div className="card p-4">
              <SubHead>Procurement chain totals</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    <tr><td>Committed on approved orders</td><td className="text-right font-semibold">{formatGhsExact(committed)}</td></tr>
                    <tr><td>Goods received (posted GRNs)</td><td className="text-right font-semibold">{formatGhsExact(receivedValue)}</td></tr>
                    <tr><td>Received not invoiced (GRNI)</td><td className="text-right font-semibold">{formatGhsExact(grniValue)}</td></tr>
                    <tr><td>Invoiced by suppliers</td><td className="text-right font-semibold">{formatGhsExact(invoicedValue)}</td></tr>
                    <tr><td>Paid to suppliers</td><td className="text-right font-semibold">{formatGhsExact(paidValue)}</td></tr>
                    <tr><td>Outstanding payables</td><td className="text-right font-semibold">{formatGhsExact(outstanding)}</td></tr>
                    <tr><td>Returned to suppliers</td><td className="text-right font-semibold">{formatGhsExact(returnValue)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>PO</th><th>Supplier</th><th>Date</th><th>Required</th><th>Status</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Progress</th><th className="text-right">Value</th></tr></thead>
              <tbody>
                {openOrders.map(({ o, ordered, got, pct }) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs font-semibold">{o.number}</td>
                    <td>{supplierName(o.supplierId)}</td>
                    <td className="text-mist">{formatDate(o.date)}</td>
                    <td className={o.requiredDate && o.requiredDate < today ? 'font-semibold text-rose-500' : 'text-mist'}>
                      {o.requiredDate ? formatDate(o.requiredDate) : '—'}
                    </td>
                    <td><ProcStatus status={o.status} /></td>
                    <td className="text-right">{ordered}</td>
                    <td className="text-right">{got}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-500/20">
                          <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-mist">{pct}%</span>
                      </div>
                    </td>
                    <td className="text-right">{formatGhsExact(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!openOrders.length && <Empty title="No open orders" desc="Every approved order has been fully received." />}
          </div>
        )}

        {tab === 'receipts' && (
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>PO</th><th>Items</th><th className="text-right">Units</th><th className="text-right">Value</th><th>Invoiced</th></tr></thead>
              <tbody>
                {postedReceipts.map((g) => {
                  const invoiced = liveInvoices.some((i) => i.goodsReceiptId === g.id)
                  return (
                    <tr key={g.id}>
                      <td className="font-mono text-xs font-semibold">{g.number}</td>
                      <td className="text-mist">{formatDate(g.date)}</td>
                      <td>{supplierName(g.supplierId)}</td>
                      <td className="font-mono text-xs">{poNumber(g.purchaseOrderId)}</td>
                      <td className="max-w-[16rem] truncate text-mist">{g.lines.map((l) => itemName(l.itemId)).join(', ')}</td>
                      <td className="text-right">{g.lines.reduce((s, l) => s + l.quantityReceiving, 0)}</td>
                      <td className="text-right">{formatGhsExact(g.total)}</td>
                      <td>{invoiced ? <ProcStatus status="posted" /> : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Not invoiced</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!postedReceipts.length && <Empty title="No posted receipts" />}
          </div>
        )}

        {tab === 'payables' && (
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>Invoice</th><th>Supplier</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
              <tbody>
                {liveInvoices.map((i) => {
                  const bal = balanceOf(i, supplierPayments)
                  const isOverdue = i.dueDate && i.dueDate < today && bal > 0
                  return (
                    <tr key={i.id}>
                      <td className="font-mono text-xs font-semibold">{i.number}</td>
                      <td>{supplierName(i.supplierId)}</td>
                      <td className="text-mist">{formatDate(i.invoiceDate)}</td>
                      <td className={isOverdue ? 'font-semibold text-rose-500' : 'text-mist'}>{i.dueDate ? formatDate(i.dueDate) : '—'}</td>
                      <td className="text-right">{formatGhsExact(i.total)}</td>
                      <td className="text-right text-mist">{formatGhsExact(paidAgainst(supplierPayments, i.id))}</td>
                      <td className="text-right font-semibold">{formatGhsExact(bal)}</td>
                      <td><ProcStatus status={i.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!liveInvoices.length && <Empty title="No posted invoices" />}
          </div>
        )}

        {tab === 'returns' && (
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>Return</th><th>Date</th><th>Supplier</th><th>GRN</th><th>Reason</th><th className="text-right">Units</th><th className="text-right">Value</th><th>Status</th></tr></thead>
              <tbody>
                {procReturns.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs font-semibold">{r.number}</td>
                    <td className="text-mist">{formatDate(r.returnDate)}</td>
                    <td>{supplierName(r.supplierId)}</td>
                    <td className="font-mono text-xs">{grnNumber(r.goodsReceiptId)}</td>
                    <td className="max-w-[14rem] truncate text-mist">{r.reason}</td>
                    <td className="text-right">{r.lines.reduce((s, l) => s + l.quantityReturned, 0)}</td>
                    <td className="text-right">{formatGhsExact(r.total)}</td>
                    <td><ProcStatus status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!procReturns.length && <Empty title="No returns" desc="Nothing has been sent back to a supplier." />}
          </div>
        )}
      </div>
    </div>
  )
}
