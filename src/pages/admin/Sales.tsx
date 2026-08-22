import { useState } from 'react'
import { Plus, Trash2, ArrowDownToLine, Receipt , X} from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, Select, Empty, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import type { SaleLine, PaymentMethod } from '../../types'

export function Sales() {
  const app = useApp()
  const { inventory, members, users, sales, recordSale, refundSale, deleteSale, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [saleModal, setSaleModal] = useState(false)
  const [saleCustomer, setSaleCustomer] = useState<'member' | 'walkin'>('walkin')
  const [saleMemberId, setSaleMemberId] = useState('')
  const [saleCustomerName, setSaleCustomerName] = useState('')
  const [saleMethod, setSaleMethod] = useState<PaymentMethod>('cash')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saleLines, setSaleLines] = useState<SaleLine[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const memberName = (id?: string) => {
    const m = members.find((x) => x.id === id)
    return m ? users.find((u) => u.id === m.userId)?.name || id : undefined
  }

  const saleTotal = saleLines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unitPrice || 0), 0)

  const openNewSale = () => {
    setSaleCustomer('walkin')
    setSaleMemberId('')
    setSaleCustomerName('')
    setSaleMethod('cash')
    setSaleDate(new Date().toISOString().slice(0, 10))
    setSaleLines([{ itemId: '', quantity: 1, unitPrice: 0 }])
    setSaleModal(true)
  }

  const submitSale = () => {
    const r = recordSale({
      memberId: saleCustomer === 'member' ? saleMemberId || undefined : undefined,
      customerName: saleCustomer === 'walkin' ? saleCustomerName || 'Walk-in customer' : undefined,
      lines: saleLines,
      method: saleMethod,
      userId: user?.id || 'system',
      date: saleDate || undefined,
    })
    if (!r.ok) { toast.error(r.error || 'Could not record sale'); return }
    log(user?.id || 'system', 'SALE', 'Sales', `Sale ${r.sale?.number} — ${formatGhsExact(r.sale?.total || 0)}`)
    toast.success('Sale recorded', r.sale?.number)
    setSaleModal(false)
  }

  return (
    <div>
      <PageHeader
        title="Sales"
        desc="Record and review product sales."
        actions={canManage ? <Button onClick={openNewSale}><Plus className="size-4" /> New sale</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Customer</th><th>Items</th><th>Method</th><th>Total</th><th>Status</th><th>Date</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.number}</td>
                <td>{s.memberId ? memberName(s.memberId) : s.customerName || 'Walk-in'}</td>
                <td>
                  {s.lines.map((l) => (
                    <p key={l.itemId} className="text-xs text-mist">{itemName(l.itemId)} × {l.quantity}</p>
                  ))}
                </td>
                <td className="text-mist">{s.method}</td>
                <td>{formatGhsExact(s.total)}</td>
                <td><StatusBadge status={s.status === 'completed' ? 'paid' : 'refunded'} /></td>
                <td className="whitespace-nowrap text-mist">{s.date || s.createdAt.slice(0, 10)}</td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      {s.status === 'completed' && (
                        <button className="rounded-lg p-2 text-mist hover:text-sky-400" title="Refund sale" onClick={() => { const r = refundSale(s.id); r.ok ? toast.success('Sale refunded', 'Stock returned to inventory') : toast.error(r.error || 'Could not refund') }}><ArrowDownToLine className="size-4" /></button>
                      )}
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete sale" onClick={() => { deleteSale(s.id); toast.success('Sale deleted') }}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && <Empty title="No sales yet" desc="Record your first sale with the New sale button." />}
      </div>

      {/* Sale editor */}
      <Modal open={saleModal} onClose={() => setSaleModal(false)} title="New sale" wide>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer">
              <Select value={saleCustomer} onChange={(e) => setSaleCustomer(e.target.value as 'member' | 'walkin')}>
                <option value="walkin">Walk-in customer</option>
                <option value="member">Member</option>
              </Select>
            </Field>
            {saleCustomer === 'member' ? (
              <Field label="Member">
                <Select value={saleMemberId} onChange={(e) => setSaleMemberId(e.target.value)}>
                  <option value="">Select member…</option>
                  {members.map((m) => {
                    const u = users.find((x) => x.id === m.userId)
                    return <option key={m.id} value={m.id}>{u?.name}</option>
                  })}
                </Select>
              </Field>
            ) : (
              <Field label="Customer name"><Input value={saleCustomerName} onChange={(e) => setSaleCustomerName(e.target.value)} placeholder="Optional" /></Field>
            )}
            <Field label="Payment method">
              <Select value={saleMethod} onChange={(e) => setSaleMethod(e.target.value as PaymentMethod)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="momo">Mobile Money</option>
                <option value="paystack">Paystack</option>
                <option value="payaza">Payaza</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="hubtel">Hubtel</option>
              </Select>
            </Field>
            <Field label="Date">
              <DatePicker value={saleDate} onChange={setSaleDate} />
            </Field>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Items</p>
              <Button size="sm" variant="ghost" onClick={() => setSaleLines((s) => [...s, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="size-4" /> Add line</Button>
            </div>
            <div className="mb-1 grid grid-cols-[1fr_76px_96px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span />
            </div>
            <div className="space-y-2">
              {saleLines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_76px_96px_40px] items-center gap-2">
                  <Select className="min-w-0" value={l.itemId} onChange={(e) => setSaleLines((s) => s.map((x, j) => j === i ? { ...x, itemId: e.target.value, unitPrice: x.unitPrice || inventory.find((it) => it.id === e.target.value)?.sellPrice || 0 } : x))}>
                    <option value="">Select item…</option>
                    {inventory.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.quantity} in stock)</option>)}
                  </Select>
                  <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setSaleLines((s) => s.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} />
                  <Input aria-label="Unit price" type="number" min={0} value={l.unitPrice} onChange={(e) => setSaleLines((s) => s.map((x, j) => j === i ? { ...x, unitPrice: Number(e.target.value) || 0 } : x))} />
                  <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setSaleLines((s) => s.filter((_, j) => j !== i))}><X className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <p className="text-sm text-mist">Total</p>
            <p className="font-display text-lg">{formatGhsExact(saleTotal)}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaleModal(false)}>Cancel</Button>
            <Button onClick={submitSale}><Receipt className="size-4" /> Record sale</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
