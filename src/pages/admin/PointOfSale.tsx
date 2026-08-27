import { useMemo, useState } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, Receipt, Banknote, CreditCard, Smartphone , X} from 'lucide-react'
import { PageHeader, Button, Input, Select, Badge, Modal, Field, Empty, SearchField, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import { stockStatus } from '../../lib/inventory'
import { cn } from '../../lib/utils'
import type { InventoryItem, PaymentMethod, Sale } from '../../types'

type CartLine = { itemId: string; quantity: number }

export function PointOfSale() {
  const app = useApp()
  const { inventory, members, users, sales, branches, invoices, company, recordSale, log } = app
  const { user } = useAuth()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerType, setCustomerType] = useState<'walkin' | 'member'>('walkin')
  const [memberId, setMemberId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receipt, setReceipt] = useState<Sale | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const todaysSales = sales.filter((s) => s.createdAt.slice(0, 10) === today)
  const todaysTotal = todaysSales.reduce((sum, s) => sum + s.total, 0)

  const products = useMemo(() => {
    return inventory.filter((i) => {
      const blob = `${i.name} ${i.sku} ${i.category}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    })
  }, [inventory, q])

  const itemOf = (id: string) => inventory.find((i) => i.id === id)
  const memberName = (id?: string) => {
    const m = members.find((x) => x.id === id)
    return m ? users.find((u) => u.id === m.userId)?.name || id : undefined
  }

  const subtotal = cart.reduce((sum, l) => sum + (itemOf(l.itemId)?.sellPrice || 0) * l.quantity, 0)

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      const inCart = existing?.quantity || 0
      if (inCart >= item.quantity) {
        toast.error('Not enough stock', `${item.name} only has ${item.quantity} in stock.`)
        return prev
      }
      if (existing) return prev.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { itemId: item.id, quantity: 1 }]
    })
  }

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.itemId !== itemId) return l
          const item = itemOf(itemId)
          const next = l.quantity + delta
          if (next > (item?.quantity || 0)) {
            toast.error('Not enough stock', `${item?.name} only has ${item?.quantity} in stock.`)
            return l
          }
          return { ...l, quantity: next }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  const removeLine = (itemId: string) => setCart((prev) => prev.filter((l) => l.itemId !== itemId))

  const completeSale = () => {
    if (!cart.length) {
      toast.error('Cart is empty')
      return
    }
    const r = recordSale({
      memberId: customerType === 'member' ? memberId || undefined : undefined,
      customerName: customerType === 'walkin' ? customerName.trim() || 'Walk-in customer' : undefined,
      lines: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: itemOf(l.itemId)?.sellPrice || 0 })),
      method,
      userId: user?.id || 'system',
      date: saleDate || undefined,
    })
    if (!r.ok) {
      toast.error(r.error || 'Could not complete sale')
      return
    }
    log(user?.id || 'system', 'SALE', 'POS', `Sale ${r.sale?.number} — ${formatGhsExact(r.sale?.total || 0)} (${method})`)
    setReceipt(r.sale || null)
    setCart([])
    setMemberId('')
    setCustomerName('')
    setMethod('cash')
    setSaleDate(new Date().toISOString().slice(0, 10))
    toast.success('Sale completed', r.sale?.number)
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        desc="Sell products at the counter — cart, payment, and receipt in one screen."
        actions={<Badge tone="lime">{formatGhsExact(todaysTotal)} today · {todaysSales.length} sales</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Product catalogue */}
        <div className="card p-4">
          <div className="mb-3">
            <SearchField value={q} onChange={setQ} placeholder="Search products…" className="max-w-sm" />
          </div>
          <div className="grid max-h-[64vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((i) => {
              const st = stockStatus(i)
              const out = st === 'out'
              const inCart = cart.find((l) => l.itemId === i.id)?.quantity || 0
              return (
                <button
                  key={i.id}
                  onClick={() => addToCart(i)}
                  disabled={out}
                  className={cn(
                    'card flex flex-col items-start gap-1 p-3 text-left transition',
                    out ? 'opacity-50' : 'hover:border-lime/50',
                  )}
                >
                  <div className="flex w-full items-start justify-between">
                    <p className="font-semibold leading-tight">{i.name}</p>
                    {inCart > 0 && <Badge tone="lime">{inCart}</Badge>}
                  </div>
                  <p className="text-xs text-mist">{i.category} · {i.quantity} {i.unit} left</p>
                  <p className="mt-1 font-display text-lg">{formatGhsExact(i.sellPrice)}</p>
                  {st === 'low' && <p className="text-[10px] text-amber-400">Low stock</p>}
                  {out && <p className="text-[10px] text-ember">Out of stock</p>}
                </button>
              )
            })}
            {!products.length && <Empty title="No products" desc="Try a different search." />}
          </div>
        </div>

        {/* Cart */}
        <div className="card flex flex-col p-4">
          <h3 className="flex items-center gap-2 font-semibold"><ShoppingCart className="size-4 text-lime" /> Cart</h3>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {cart.map((l) => {
              const item = itemOf(l.itemId)
              if (!item) return null
              return (
                <div key={l.itemId} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-mist">{formatGhsExact(item.sellPrice)} × {l.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="icon" variant="ghost" onClick={() => changeQty(l.itemId, -1)} aria-label="Decrease"><Minus className="size-4" /></Button>
                    <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
                    <Button size="icon" variant="ghost" onClick={() => changeQty(l.itemId, 1)} aria-label="Increase"><Plus className="size-4" /></Button>
                    <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => removeLine(l.itemId)}><X className="size-4" /></button>
                  </div>
                </div>
              )
            })}
            {!cart.length && <p className="py-6 text-center text-sm text-mist">Cart is empty — tap products to add them.</p>}
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-mist">Subtotal</p>
              <p className="font-display text-xl">{formatGhsExact(subtotal)}</p>
            </div>

            <div className="grid gap-2">
              <Field label="Customer">
                <Select value={customerType} onChange={(e) => setCustomerType(e.target.value as 'walkin' | 'member')}>
                  <option value="walkin">Walk-in customer</option>
                  <option value="member">Member</option>
                </Select>
              </Field>
              {customerType === 'member' ? (
                <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">Select member…</option>
                  {members.map((m) => {
                    const u = users.find((x) => x.id === m.userId)
                    return <option key={m.id} value={m.id}>{u?.name}</option>
                  })}
                </Select>
              ) : (
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" />
              )}
            </div>

            <Field label="Date">
              <DatePicker value={saleDate} onChange={setSaleDate} />
            </Field>

            <div>
              <p className="mb-1.5 text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'momo', label: 'MoMo', icon: Smartphone },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition',
                      method === m.id ? 'border-lime bg-lime/10 ring-1 ring-lime' : 'border-line hover:border-lime/40',
                    )}
                  >
                    <m.icon className="size-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" disabled={!cart.length} onClick={completeSale}>
              <Receipt className="size-4" /> Complete sale · {formatGhsExact(subtotal)}
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice modal */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Sale complete" wide>
        {receipt && (
          <div className="space-y-3">
            <div id="pos-invoice" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Invoice</p>
                  <p className="text-xs text-zinc-500">{invoices.find((i) => i.id === receipt.invoiceId)?.number || receipt.number}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-between text-xs text-zinc-600">
                <div>
                  <p className="font-semibold">Bill to</p>
                  <p>{receipt.memberId ? memberName(receipt.memberId) : receipt.customerName || 'Walk-in customer'}</p>
                </div>
                <div className="text-right">
                  <p><span className="font-semibold">Date:</span> {receipt.date || receipt.createdAt.slice(0, 10)}</p>
                  <p><span className="font-semibold">Paid via:</span> {receipt.method}</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.map((l) => (
                      <tr key={l.itemId} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemOf(l.itemId)?.name || l.itemId}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.quantity * l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <div className="w-48 space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span><span>{formatGhsExact(receipt.total)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-300 pt-1 text-base font-bold">
                    <span>Total</span><span>{formatGhsExact(receipt.total)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}>Print invoice</Button>
              <Button variant="outline" onClick={() => setReceipt(null)}>New sale</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
