import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, Plus, Minus, Receipt, Banknote, CreditCard, Smartphone, X, ChevronDown, Percent } from 'lucide-react'
import { PageHeader, Button, Input, Select, Badge, Modal, Field, Empty, SearchField, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import { stockStatus } from '../../lib/inventory'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { cn } from '../../lib/utils'
import { visibleBranches } from '../../lib/accessScope'
import { DEFAULT_PRODUCT_IMAGE } from '../../lib/image'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel, recordDiscountUsage } from '../../lib/discounts'
import type { InventoryItem, PaymentMethod, Sale, SaleDiscountType } from '../../types'

type CartLine = { itemId: string; quantity: number; discount: number }

// Uploaded image wins; otherwise a sensible existing asset per category,
// falling back to the shared default product image.
const POS_CATEGORY_IMAGES: Record<string, string> = {
  Supplements: '/images/program-nutrition.jpg',
  Beverages: '/images/program-nutrition.jpg',
  Snacks: '/images/program-nutrition.jpg',
  Apparel: '/images/gym-floor.jpg',
  Equipment: '/images/gym-weights.jpg',
  Recovery: '/images/program-yoga.jpg',
}

function posProductImage(item: InventoryItem) {
  return item.image || POS_CATEGORY_IMAGES[item.category] || DEFAULT_PRODUCT_IMAGE
}

function saleTotals(sale: Sale) {
  const grossSubtotal = sale.lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice), 0)
  const lineDiscountTotal = sale.lines.reduce((sum, line) => sum + Math.max(0, line.discount || 0), 0)
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscountTotal)
  const details = sale.details
  const discountAmount = Math.max(0, details?.discountAmount || 0)
  const orderDiscount = Math.min(
    netSubtotal,
    details?.discountType === 'percentage' ? netSubtotal * discountAmount / 100 : discountAmount,
  )
  const taxableSubtotal = Math.max(0, netSubtotal - orderDiscount)
  const orderTax = taxableSubtotal * Math.max(0, details?.orderTaxRate || 0) / 100
  const shippingCharges = Math.max(0, details?.shippingCharges || 0)
  const expenseTotal = (details?.additionalExpenses || []).reduce((sum, expense) => sum + Math.max(0, expense.amount), 0)
  return { grossSubtotal, lineDiscountTotal, orderDiscount, orderTax, shippingCharges, expenseTotal, total: sale.total }
}

export function PointOfSale() {
  const app = useApp()
  const { inventory, members, users, sales, branches, invoices, company, branchSettings, activeCompanyId, activeBranchId, recordSale, log } = app
  const { user } = useAuth()
  const toast = useToast()
  const isSuperAdmin = user?.role === 'super_admin'
  const canSelectBranch = isSuperAdmin || user?.role === 'gym_manager' || user?.role === 'company_admin'
  const availableBranches = useMemo(
    () => visibleBranches(user, branches, activeCompanyId).filter((branch) => branch.status !== 'inactive'),
    [activeCompanyId, branches, user],
  )

  const [q, setQ] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerType, setCustomerType] = useState<'walkin' | 'member'>('walkin')
  const [memberId, setMemberId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [branchId, setBranchId] = useState(() => activeBranchId || availableBranches[0]?.id || '')
  const [discountType, setDiscountType] = useState<SaleDiscountType>('percentage')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxName, setTaxName] = useState('none')
  const [orderTaxRate, setOrderTaxRate] = useState(0)
  const [discountTaxOpen, setDiscountTaxOpen] = useState(true)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discountId, setDiscountId] = useState('')
  const [tableDiscounts, setTableDiscounts] = useState(() => activeDiscounts())

  const today = new Date().toISOString().slice(0, 10)
  const saleBranchId = canSelectBranch ? branchId : user?.branchId || activeBranchId || availableBranches[0]?.id || ''
  const saleCompanyId = branches.find((branch) => branch.id === saleBranchId)?.companyId || activeCompanyId

  useEffect(() => {
    if (!canSelectBranch || !activeBranchId || !availableBranches.some((branch) => branch.id === activeBranchId)) return
    if (branchId !== activeBranchId) setBranchId(activeBranchId)
  }, [activeBranchId, availableBranches, canSelectBranch])

  useEffect(() => {
    if (!canSelectBranch) return
    if (branchId && availableBranches.some((branch) => branch.id === branchId)) return
    setBranchId(availableBranches[0]?.id || '')
  }, [availableBranches, branchId, canSelectBranch])

  const taxOptions = useMemo(() => {
    const settings = branchSettingsFor(branchSettings, saleBranchId)
    const configuredTaxes = settings?.taxRates?.length ? settings.taxRates : DEFAULT_BRANCH_TAXES
    return configuredTaxes.filter((tax) => tax.status === 'active')
  }, [branchSettings, saleBranchId])

  useEffect(() => {
    if (taxName === 'none') {
      if (orderTaxRate !== 0) setOrderTaxRate(0)
      return
    }
    const selectedTax = taxOptions.find((tax) => tax.name === taxName)
    if (!selectedTax) {
      setTaxName('none')
      setOrderTaxRate(0)
      return
    }
    if (selectedTax.rate !== orderTaxRate) setOrderTaxRate(selectedTax.rate)
  }, [taxName, taxOptions, orderTaxRate])

  useEffect(() => {
    if (discountTaxOpen) setTableDiscounts(activeDiscounts())
  }, [discountTaxOpen])

  const selectedDiscount = tableDiscounts.find((d) => d.id === discountId) || null

  const todaysSales = sales.filter((s) => s.createdAt.slice(0, 10) === today)
  const todaysTotal = todaysSales.reduce((sum, s) => sum + s.total, 0)

  const products = useMemo(() => {
    return inventory.filter((i) => {
      if (i.active === false) return false
      const locIds = i.branchIds?.length ? i.branchIds : (i.branchId ? [i.branchId] : [])
      if (locIds.length && saleBranchId && !locIds.includes(saleBranchId)) return false
      const blob = `${i.name} ${i.sku} ${i.category}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    })
  }, [inventory, q, saleBranchId])

  const itemOf = (id: string) => inventory.find((i) => i.id === id)
  const memberName = (id?: string) => {
    const m = members.find((x) => x.id === id)
    return m ? users.find((u) => u.id === m.userId)?.name || id : undefined
  }

  const grossSubtotal = cart.reduce((sum, l) => sum + (itemOf(l.itemId)?.sellPrice || 0) * l.quantity, 0)
  const lineDiscountTotal = cart.reduce(
    (sum, l) => sum + Math.max(0, Math.min(l.discount || 0, (itemOf(l.itemId)?.sellPrice || 0) * l.quantity)),
    0,
  )
  const subtotal = Math.max(0, grossSubtotal - lineDiscountTotal)
  const requestedDiscount = Math.max(0, discountAmount)
  // A Discounts-table selection overrides the manual type/amount inputs and is
  // evaluated with the shared rules engine (min spend, cap, window, limits).
  const cartItemIds = cart.map((l) => l.itemId)
  const productNameById = (id: string) => inventory.find((item) => item.id === id)?.name
  const codeDiscountValue = selectedDiscount ? computeDiscount(selectedDiscount, subtotal, cartItemIds) : null
  const codeBlock = selectedDiscount ? discountBlockReason(selectedDiscount, subtotal, { itemIds: cartItemIds, productName: productNameById }) : null
  const codeShortfall = selectedDiscount && codeBlock && selectedDiscount.minSpend && subtotal < selectedDiscount.minSpend
    ? selectedDiscount.minSpend - subtotal
    : 0
  const discountValue = codeDiscountValue ?? (discountType === 'percentage' ? subtotal * requestedDiscount / 100 : requestedDiscount)
  const appliedDiscount = Math.min(subtotal, discountValue)
  const taxableSubtotal = Math.max(0, subtotal - appliedDiscount)
  const orderTax = taxableSubtotal * Math.max(0, orderTaxRate) / 100
  const totalPayable = Math.max(0, taxableSubtotal + orderTax)

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      const inCart = existing?.quantity || 0
      if (inCart >= item.quantity) {
        toast.error('Not enough stock', `${item.name} only has ${item.quantity} in stock.`)
        return prev
      }
      if (existing) return prev.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { itemId: item.id, quantity: 1, discount: 0 }]
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

  /** Per-line discount in GHS, clamped to 0..(price × qty) so a line can never go negative. */
  const setLineDiscount = (itemId: string, amount: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l
        const lineMax = (itemOf(itemId)?.sellPrice || 0) * l.quantity
        const next = Number.isFinite(amount) ? Math.max(0, Math.min(amount, lineMax)) : 0
        return { ...l, discount: next }
      }),
    )
  }

  // First step of the save: validate, then ask for confirmation. The sale is
  // only recorded once the cashier confirms in the review dialog below.
  const requestCompleteSale = () => {
    if (!cart.length) {
      toast.error('Cart is empty')
      return
    }
    if (!saleBranchId) {
      toast.error('Select a branch', 'Choose the branch that should receive this sale.')
      return
    }
    setConfirmOpen(true)
  }

  const completeSale = () => {
    if (!cart.length) {
      toast.error('Cart is empty')
      setConfirmOpen(false)
      return
    }
    if (!saleBranchId) {
      toast.error('Select a branch', 'Choose the branch that should receive this sale.')
      return
    }
    const r = recordSale({
      companyId: saleCompanyId || undefined,
      branchId: saleBranchId || undefined,
      memberId: customerType === 'member' ? memberId || undefined : undefined,
      customerName: customerType === 'walkin' ? customerName.trim() || 'Walk-in customer' : undefined,
      lines: cart.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: itemOf(l.itemId)?.sellPrice || 0,
        discount: Math.max(0, Math.min(l.discount || 0, (itemOf(l.itemId)?.sellPrice || 0) * l.quantity)),
      })),
      method,
      userId: user?.id || 'system',
      date: saleDate || undefined,
      total: totalPayable,
      details: {
        discountType: selectedDiscount ? 'fixed' : discountType,
        discountAmount: selectedDiscount ? (codeDiscountValue ?? 0) : requestedDiscount,
        discountId: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.id : undefined,
        discountCode: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.code : undefined,
        discountName: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.name : undefined,
        taxName: taxName === 'none' ? undefined : taxName,
        orderTaxRate: Math.max(0, orderTaxRate),
        payment: {
          amount: totalPayable,
          paidOn: new Date().toISOString(),
          method,
        },
      },
    })
    if (!r.ok) {
      toast.error(r.error || 'Could not complete sale')
      return
    }
    log(user?.id || 'system', 'SALE', 'POS', `Sale ${r.sale?.number} — ${formatGhsExact(r.sale?.total || 0)} (${method})`)
    setReceipt(r.sale || null)
    setConfirmOpen(false)
    setCart([])
    setMemberId('')
    setCustomerName('')
    setMethod('cash')
    setSaleDate(new Date().toISOString().slice(0, 10))
    if (selectedDiscount && (codeDiscountValue ?? 0) > 0) recordDiscountUsage(selectedDiscount.id)
    setDiscountId('')
    setDiscountType('percentage')
    setDiscountAmount(0)
    setTaxName('none')
    setOrderTaxRate(0)
    setDiscountTaxOpen(true)
    toast.success('Sale completed', r.sale?.number)
  }

  const receiptTotals = receipt ? saleTotals(receipt) : null

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
                    'group card flex flex-col items-start gap-1 overflow-hidden p-0 text-left transition',
                    out ? 'opacity-50' : 'hover:border-lime/50',
                  )}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <img
                      src={posProductImage(i)}
                      alt=""
                      loading="lazy"
                      onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">{i.category}</span>
                  </div>
                  <div className="w-full p-3 pt-2">
                    <div className="flex w-full items-start justify-between gap-2">
                      <p className="font-semibold leading-tight">{i.name}</p>
                      {inCart > 0 && <Badge tone="lime">{inCart}</Badge>}
                    </div>
                    <p className="text-xs text-mist">{i.quantity} {i.unit} left</p>
                    <p className="mt-1 font-display text-lg">{formatGhsExact(i.sellPrice)}</p>
                    {st === 'low' && <p className="text-[10px] text-amber-400">Low stock</p>}
                    {out && <p className="text-[10px] text-ember">Out of stock</p>}
                  </div>
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
              const lineGross = item.sellPrice * l.quantity
              const lineDiscount = Math.max(0, Math.min(l.discount || 0, lineGross))
              return (
                <div key={l.itemId} className="rounded-xl border border-white/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
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
                  <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/5 pt-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-mist">
                      Line discount (GH₵)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={lineDiscount || ''}
                        placeholder="0"
                        aria-label={`Line discount for ${item.name}`}
                        onChange={(e) => setLineDiscount(l.itemId, Number(e.target.value))}
                        className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-right text-xs font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-lime dark:bg-zinc-900"
                      />
                    </label>
                    <p className={cn('text-xs font-semibold tabular-nums', lineDiscount > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-mist')}>
                      {formatGhsExact(lineGross - lineDiscount)}
                    </p>
                  </div>
                </div>
              )
            })}
            {!cart.length && <p className="py-6 text-center text-sm text-mist">Cart is empty — tap products to add them.</p>}
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-mist">Subtotal</p>
              <p className="font-display text-xl">{formatGhsExact(grossSubtotal)}</p>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="-mt-2 flex items-center justify-between">
                <p className="text-xs text-mist">Line discounts</p>
                <p className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-300">− {formatGhsExact(lineDiscountTotal)}</p>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setDiscountTaxOpen((open) => !open)}
                aria-expanded={discountTaxOpen}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold"><Percent className="size-4 text-lime" /> Discount &amp; tax <span className="text-xs font-normal text-mist">Optional</span></span>
                <span className="flex items-center gap-2 text-xs font-semibold text-mist">
                  {appliedDiscount > 0
                    ? `${formatGhsExact(appliedDiscount)} discount`
                    : orderTax > 0
                      ? `${formatGhsExact(orderTax)} tax`
                      : 'Add options'}
                  <ChevronDown className={cn('size-4 transition-transform', discountTaxOpen ? '' : '-rotate-90')} />
                </span>
              </button>
              {discountTaxOpen && (
                <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                  <Field label="Discount code">
                    <Select
                      value={discountId}
                      onChange={(event) => {
                        const nextId = event.target.value
                        setDiscountId(nextId)
                        const next = tableDiscounts.find((d) => d.id === nextId)
                        if (next) {
                          setDiscountType(next.type)
                          setDiscountAmount(next.value)
                        }
                      }}
                    >
                      <option value="">Manual discount</option>
                      {tableDiscounts.map((d) => <option key={d.id} value={d.id}>{discountLabel(d)}</option>)}
                    </Select>
                  </Field>
                  {selectedDiscount ? (
                    <div className="self-end pb-1 text-[11px] leading-snug">
                      {codeBlock ? (
                        <span className="font-medium text-amber-500">
                          <span className="font-semibold">{selectedDiscount.name}</span> not applied — {codeBlock}.
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-500">
                          <span className="font-semibold">{selectedDiscount.name}</span> ({selectedDiscount.code}) applies −{formatGhsExact(appliedDiscount)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="self-end pb-1 text-[11px] text-muted">Pick a code from the Discounts table or set a manual amount.</div>
                  )}
                  <Field label="Discount type">
                    <Select value={discountType} disabled={!!selectedDiscount} onChange={(event) => setDiscountType(event.target.value as SaleDiscountType)}>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </Select>
                  </Field>
                  <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
                    <Input type="number" min="0" step="0.01" disabled={!!selectedDiscount} value={discountAmount} onChange={(event) => {
                      const value = Number(event.target.value)
                      setDiscountAmount(Number.isFinite(value) ? Math.max(0, value) : 0)
                    }} />
                  </Field>
                  <Field label="Tax name">
                    <Select value={taxName} onChange={(event) => {
                      const nextName = event.target.value
                      const selectedTax = taxOptions.find((tax) => tax.name === nextName)
                      setTaxName(nextName)
                      setOrderTaxRate(selectedTax?.rate || 0)
                    }}>
                      <option value="none">No tax</option>
                      {taxOptions.map((tax) => <option key={tax.name} value={tax.name}>{tax.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Tax rate (%)">
                    <Input value={`${orderTaxRate}%`} readOnly aria-label="Associated tax rate" />
                  </Field>
                  <div className="rounded-xl border border-line bg-zinc-50 p-3 dark:bg-white/[0.025] sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-mist">Adjusted total</p>
                      <span className="text-[11px] font-medium text-muted">Applied to subtotal</span>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-line/70 bg-white px-3 py-2 dark:bg-zinc-900">
                        <p className="text-xs text-mist">Discount</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-300">− {formatGhsExact(appliedDiscount)}</p>
                      </div>
                      <div className="rounded-lg border border-line/70 bg-white px-3 py-2 dark:bg-zinc-900">
                        <p className="text-xs text-mist">Tax</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-300">+ {formatGhsExact(orderTax)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedDiscount && codeBlock && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs leading-snug text-amber-700 dark:text-amber-300">
                <p className="font-bold">{selectedDiscount.name} ({selectedDiscount.code}) is not applied to this sale.</p>
                <p className="mt-0.5">
                  {codeBlock.charAt(0).toUpperCase() + codeBlock.slice(1)}.
                  {codeShortfall > 0 && <span> Add {formatGhsExact(codeShortfall)} more to the sale to use it.</span>}
                  <span> Pick “Manual discount” to enter a custom amount instead.</span>
                </p>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm font-semibold">Total payable</p>
              <p className="font-display text-2xl text-lime-ink dark:text-lime">{formatGhsExact(totalPayable)}</p>
            </div>

            <div className="grid gap-2">
              {canSelectBranch && (
                <Field label="Branch">
                  <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                    <option value="">Select branch…</option>
                    {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </Select>
                </Field>
              )}
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

            <Button className="w-full" size="lg" disabled={!cart.length} onClick={requestCompleteSale}>
              <Receipt className="size-4" /> Complete sale · {formatGhsExact(totalPayable)}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm-before-save review */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm this sale?">
        {cart.length > 0 && (
          <div className="space-y-4">
            {selectedDiscount && codeBlock && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs leading-snug text-amber-700 dark:text-amber-300">
                <span className="font-bold">{selectedDiscount.name} ({selectedDiscount.code})</span> is not applied to this sale — {codeBlock}.
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-left uppercase tracking-wide text-[11px] text-mist dark:bg-white/[0.03]">
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => {
                    const item = itemOf(l.itemId)
                    if (!item) return null
                    const leftAfter = Math.max(0, item.quantity - l.quantity)
                    const lineGross = item.sellPrice * l.quantity
                    const lineDiscount = Math.max(0, Math.min(l.discount || 0, lineGross))
                    return (
                      <tr key={l.itemId} className="border-t border-line">
                        <td className="px-3 py-2">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-mist">
                            {formatGhsExact(item.sellPrice)} each · {leftAfter} left after sale
                            {lineDiscount > 0 && <span className="text-rose-600 dark:text-rose-300"> · − {formatGhsExact(lineDiscount)} line discount</span>}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">×{l.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatGhsExact(lineGross - lineDiscount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 rounded-xl border border-line bg-zinc-50 p-3 text-sm dark:bg-white/[0.025]">
              <div className="flex justify-between">
                <span className="text-mist">Subtotal</span>
                <span className="tabular-nums">{formatGhsExact(grossSubtotal)}</span>
              </div>
              {lineDiscountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-mist">Line discounts</span>
                  <span className="tabular-nums text-rose-600 dark:text-rose-300">− {formatGhsExact(lineDiscountTotal)}</span>
                </div>
              )}
              {appliedDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-mist">Discount{selectedDiscount ? ` — ${selectedDiscount.name} (${selectedDiscount.code})` : discountType === 'percentage' ? ` (${requestedDiscount}%)` : ' (fixed)'}</span>
                  <span className="tabular-nums text-rose-600 dark:text-rose-300">− {formatGhsExact(appliedDiscount)}</span>
                </div>
              )}
              {orderTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-mist">{taxName === 'none' ? 'Tax' : taxName} ({orderTaxRate}%)</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-300">+ {formatGhsExact(orderTax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold">
                <span>Total payable</span>
                <span className="tabular-nums text-lime-ink dark:text-lime">{formatGhsExact(totalPayable)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-mist">Customer</p>
                <p className="font-semibold">{customerType === 'member' ? (memberName(memberId) || 'Member') : (customerName.trim() || 'Walk-in customer')}</p>
              </div>
              <div>
                <p className="text-xs text-mist">Branch</p>
                <p className="font-semibold">{branches.find((b) => b.id === saleBranchId)?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-mist">Date</p>
                <p className="font-semibold">{saleDate}</p>
              </div>
              <div>
                <p className="text-xs text-mist">Payment</p>
                <p className="font-semibold">{method === 'momo' ? 'MoMo' : method.charAt(0).toUpperCase() + method.slice(1)}</p>
              </div>
            </div>

            <p className="text-xs text-mist">
              Saving records the payment, creates a paid invoice, and deducts the items from stock.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={completeSale}>
                <Receipt className="size-4" /> Confirm &amp; save · {formatGhsExact(totalPayable)}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
                        <td className="px-3 py-2 text-right">{formatGhsExact(Math.max(0, l.quantity * l.unitPrice - (l.discount || 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <div className="w-56 space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span><span>{formatGhsExact(receiptTotals?.grossSubtotal || 0)}</span>
                  </div>
                  {(receiptTotals?.lineDiscountTotal || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Line discount</span><span>−{formatGhsExact(receiptTotals?.lineDiscountTotal || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.orderDiscount || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount{receipt.details?.discountName ? ` — ${receipt.details.discountName}` : ''}{receipt.details?.discountCode ? ` (${receipt.details.discountCode})` : ''}</span><span>−{formatGhsExact(receiptTotals?.orderDiscount || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.orderTax || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>{receipt.details?.taxName || 'Tax'}</span><span>+{formatGhsExact(receiptTotals?.orderTax || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.shippingCharges || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Shipping</span><span>+{formatGhsExact(receiptTotals?.shippingCharges || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.expenseTotal || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Additional expenses</span><span>+{formatGhsExact(receiptTotals?.expenseTotal || 0)}</span>
                    </div>
                  )}
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
