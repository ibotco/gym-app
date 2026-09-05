import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, Receipt, Banknote, CreditCard, Smartphone, X, ChevronDown, Percent, Tags, Layers, Check as CheckIcon, ArrowLeft, Trash2, User, MapPin, CalendarDays, Maximize2, Minimize2, PackageSearch, ScanLine, Search, Lock } from 'lucide-react'
import { Button, Input, Select, Badge, Modal, Field, Empty, SearchField, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import { stockStatus, INVENTORY } from '../../lib/inventory'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { cn } from '../../lib/utils'
import { branchClosure, branchDepth, branchesTreeOrder, visibleBranches } from '../../lib/accessScope'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { DEFAULT_PRODUCT_IMAGE } from '../../lib/image'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel, recordDiscountUsage } from '../../lib/discounts'
import { resolveTaxDiscountPolicy, taxDiscountViolation } from '../../lib/taxDiscountPolicy'
import type { InventoryItem, PaymentMethod, Sale, SaleDiscountType } from '../../types'

type CartLine = { itemId: string; quantity: number; discount: number }

/** Common Ghana cedi notes offered as one-tap tender shortcuts. */
const QUICK_TENDER = [5, 10, 20, 50, 100, 200, 500, 1000, 2000]

// Uploaded image wins; otherwise the seeded catalogue image for this product
// id (covers browsers with inventory saved before images existed), then a
// per-category fallback, then the shared default product image.
const POS_CATEGORY_IMAGES: Record<string, string> = {
  Supplements: '/images/program-nutrition.jpg',
  Beverages: '/images/program-nutrition.jpg',
  Snacks: '/images/program-nutrition.jpg',
  Apparel: '/images/gym-floor.jpg',
  Equipment: '/images/gym-weights.jpg',
  Recovery: '/images/program-yoga.jpg',
}

const SEED_IMAGES_BY_ID: Record<string, string> = Object.fromEntries(
  INVENTORY.map((s) => [s.id, s.image]).filter((entry) => entry[1]),
)

function posProductImage(item: InventoryItem) {
  return item.image || SEED_IMAGES_BY_ID[item.id] || POS_CATEGORY_IMAGES[item.category] || DEFAULT_PRODUCT_IMAGE
}

/** Wraps the matched substring in a <mark> so cashiers see why a row matched. */
function highlightMatch(text: string, query: string) {
  const needle = query.trim()
  if (!needle) return text
  const at = text.toLowerCase().indexOf(needle.toLowerCase())
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="pos-scan-mark">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}

/** "Company-Mandated Tax" / "Mandatory Discount" style chip for POS drawers. */
function PolicyChip({ label, locked }: { label: string; locked?: boolean }) {
  const strong = label !== 'Optional'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        strong ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-zinc-500/15 text-mist',
      )}
    >
      {locked && <Lock className="size-2.5" aria-hidden />}
      {label}
    </span>
  )
}

type FilterOption = { name: string; count: number; image?: string }

/** Dropdown list of categories / brands with live counts and multi-select. */
function FilterMenu({
  title,
  options,
  selected,
  onToggle,
  onClear,
  onDone,
  emptyLabel,
}: {
  title: string
  options: FilterOption[]
  selected: string[]
  onToggle: (name: string) => void
  onClear: () => void
  onDone: () => void
  emptyLabel: string
}) {
  const total = options.reduce((sum, option) => sum + option.count, 0)
  return (
    <div className="menu-pop absolute left-0 top-full z-50 mt-2 w-64 rounded-xl p-2 shadow-xl" role="menu">
      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-mist">{title}</p>

      {options.length === 0 ? (
        <p className="px-2 py-3 text-sm text-mist">{emptyLabel}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5',
              selected.length === 0 && 'text-lime',
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn('grid size-4 place-items-center rounded border', selected.length === 0 ? 'border-lime bg-lime text-black' : 'border-line')}>
                {selected.length === 0 && <CheckIcon className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              All
            </span>
            <span className="text-xs text-mist">{total}</span>
          </button>

          <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto pr-0.5">
            {options.map((option) => {
              const on = selected.includes(option.name)
              return (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => onToggle(option.name)}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5',
                    on && 'font-semibold text-lime',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-lime bg-lime text-black' : 'border-line')}>
                      {on && <CheckIcon className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    {option.image && (
                      <img
                        src={option.image}
                        alt=""
                        loading="lazy"
                        onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }}
                        className="size-7 shrink-0 rounded-md border border-line object-cover"
                      />
                    )}
                    <span className="truncate">{option.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-mist">{option.count}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5">
            <button type="button" onClick={onClear} className="rounded-lg px-2 py-1 text-xs font-semibold text-mist transition hover:text-ember">Clear</button>
            <button type="button" onClick={onDone} className="rounded-lg px-2 py-1 text-xs font-semibold text-lime transition hover:underline">Done</button>
          </div>
        </>
      )}
    </div>
  )
}

/** Removable pill shown under the toolbar for each active filter. */
function FilterChip({ icon, label, onRemove }: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/50 bg-lime/10 px-2.5 py-1 text-xs font-semibold text-lime">
      {icon}
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} className="rounded-full p-0.5 transition hover:bg-lime/20">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
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

export function PointOfSale({ screen }: { screen?: number }) {
  const app = useApp()
  const { inventory: scopedInventory, inventoryUnscoped, members, users, sales, branches, invoices, company, branchSettings, activeCompanyId, activeBranchId, recordSale, log } = app
  // The counter sells across branches — catalogue uses the full list; the
  // checkout's Branch field decides which branch the sale belongs to.
  const inventory = inventoryUnscoped ?? scopedInventory
  const { user } = useAuth()
  const toast = useToast()
  const isSuperAdmin = user?.role === 'super_admin'
  const canSelectBranch = isSuperAdmin || user?.role === 'gym_manager' || user?.role === 'company_admin'
  const availableBranches = useMemo(
    () => visibleBranches(user, branches, activeCompanyId).filter((branch) => branch.status !== 'inactive'),
    [activeCompanyId, branches, user],
  )

  const [q, setQ] = useState('')
  // Catalogue filters — multi-select, driven by the products actually on sale at this branch.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [brandMenuOpen, setBrandMenuOpen] = useState(false)
  const categoryMenuRef = useRef<HTMLDivElement | null>(null)
  const brandMenuRef = useRef<HTMLDivElement | null>(null)
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
  const [discountTaxOpen, setDiscountTaxOpen] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** Cash tendered by the customer, as typed. Presentation-only: the recorded
      sale total is still totalPayable — this drives the change-due readout. */
  const [amountReceived, setAmountReceived] = useState('')
  const [receivedTouched, setReceivedTouched] = useState(false)
  const [discountId, setDiscountId] = useState('')
  const [tableDiscounts, setTableDiscounts] = useState(() => activeDiscounts())
  /** Catalogue scope: 'all' shows every branch's products; a branch id narrows the grid. */
  const [catalogueScope, setCatalogueScope] = useState<'all' | string>('all')

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

  // ── Company tax & discount policy (Settings → Tax & Discount) ──
  const policy = useMemo(() => resolveTaxDiscountPolicy(company), [company])

  /** Seed the company defaults onto a fresh ticket and enforce hidden modes. */
  useEffect(() => {
    if (!policy.tax.visible) {
      if (taxName !== 'none') setTaxName('none')
      if (orderTaxRate !== 0) setOrderTaxRate(0)
      return
    }
    if (policy.tax.required && taxName === 'none') {
      const preferred = policy.tax.defaultName && taxOptions.find((t) => t.name === policy.tax.defaultName)
      if (preferred) {
        setTaxName(preferred.name)
        setOrderTaxRate(preferred.rate)
      } else if (policy.tax.defaultRate > 0) {
        setOrderTaxRate(policy.tax.defaultRate)
      }
    }
  }, [policy, taxOptions, taxName, orderTaxRate])

  useEffect(() => {
    if (!policy.discount.visible) {
      if (discountAmount !== 0) setDiscountAmount(0)
      if (discountId) setDiscountId('')
      return
    }
    if (policy.discount.required && discountAmount === 0 && !discountId && policy.discount.defaultValue > 0) {
      setDiscountType(policy.discount.defaultType)
      setDiscountAmount(policy.discount.defaultValue)
    }
  }, [policy, discountAmount, discountId])

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

  useDismissOnOutside(categoryMenuOpen, categoryMenuRef, () => setCategoryMenuOpen(false))
  useDismissOnOutside(brandMenuOpen, brandMenuRef, () => setBrandMenuOpen(false))

  const inventoryBranches = branches
  const companyBranchIds = useMemo(
    () => new Set(branches.filter((b) => b.companyId === activeCompanyId).map((b) => b.id)),
    [branches, activeCompanyId],
  )

  /** Everything sellable — the pool the filter buttons are built from.
      Defaults to the whole catalogue across branches; a scope narrows it. */

  const branchProducts = useMemo(() => {
    // A parent scope covers its child branches too (branch closure).
    const scopeIds = catalogueScope !== 'all' ? new Set(branchClosure(inventoryBranches, catalogueScope)) : null
    return inventory.filter((i) => {
      if (i.active === false) return false
      const locIds = i.branchIds?.length ? i.branchIds : (i.branchId ? [i.branchId] : [])
      if (scopeIds) {
        if (locIds.length && !locIds.some((id) => scopeIds.has(id))) return false
      } else if (locIds.length && !locIds.some((id) => companyBranchIds.has(id))) {
        return false
      }
      return true
    })
  }, [inventory, catalogueScope, companyBranchIds, inventoryBranches])

  /** Category / brand options with live counts, so empty groups never show up.
      Each option carries a sample product image for visual browsing. */
  const facet = (pick: (item: InventoryItem) => string | undefined) => {
    const counts = new Map<string, number>()
    const samples = new Map<string, InventoryItem>()
    for (const item of branchProducts) {
      const value = (pick(item) || '').trim()
      if (!value) continue
      counts.set(value, (counts.get(value) || 0) + 1)
      if (!samples.has(value)) samples.set(value, item)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, image: posProductImage(samples.get(name)!) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const categoryOptions = useMemo(() => facet((item) => item.category), [branchProducts])
  const brandOptions = useMemo(() => facet((item) => item.brand), [branchProducts])

  const products = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return branchProducts.filter((i) => {
      if (selectedCategories.length && !selectedCategories.includes((i.category || '').trim())) return false
      if (selectedBrands.length && !selectedBrands.includes((i.brand || '').trim())) return false
      const blob = `${i.name} ${i.sku} ${i.category} ${i.brand || ''}`.toLowerCase()
      return !needle || blob.includes(needle)
    })
  }, [branchProducts, q, selectedBrands, selectedCategories])

  const activeFilterCount = selectedCategories.length + selectedBrands.length
  const toggleValue = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
  const clearFilters = () => { setSelectedCategories([]); setSelectedBrands([]) }

  /** Drop selections that no longer exist (branch switch, product edits). */
  useEffect(() => {
    const names = new Set(categoryOptions.map((option) => option.name))
    setSelectedCategories((current) => (current.every((name) => names.has(name)) ? current : current.filter((name) => names.has(name))))
  }, [categoryOptions])
  useEffect(() => {
    const names = new Set(brandOptions.map((option) => option.name))
    setSelectedBrands((current) => (current.every((name) => names.has(name)) ? current : current.filter((name) => names.has(name))))
  }, [brandOptions])

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
  // Hidden mode means the feature is not calculated at all, not merely hidden.
  const appliedDiscount = policy.discount.visible ? Math.min(subtotal, discountValue) : 0
  const taxableSubtotal = Math.max(0, subtotal - appliedDiscount)
  const orderTax = policy.tax.visible ? taxableSubtotal * Math.max(0, orderTaxRate) / 100 : 0
  const totalPayable = Math.max(0, taxableSubtotal + orderTax)

  // ── Tender / change-due (display + guard only, never changes the sale total) ──
  const receivedValue = Number(amountReceived)
  const receivedParsed = amountReceived.trim() !== '' && Number.isFinite(receivedValue) ? Math.max(0, receivedValue) : null
  const shortBy = receivedParsed === null ? totalPayable : Math.max(0, totalPayable - receivedParsed)
  const changeDue = receivedParsed === null ? 0 : Math.max(0, receivedParsed - totalPayable)
  // Tolerate float dust (e.g. 0.005) so an exact tender is never blocked.
  const paymentSufficient = receivedParsed !== null && receivedParsed + 0.005 >= totalPayable

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      const inCart = existing?.quantity || 0
      // Non-inventory items are unlimited — never capped by stock.
      if (!item.nonInventory && inCart >= item.quantity) {
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
          if (!item?.nonInventory && next > (item?.quantity || 0)) {
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
    const violation = taxDiscountViolation(policy, { taxName: taxName === 'none' ? '' : taxName, taxRate: orderTaxRate, discountValue: appliedDiscount })
    if (violation) {
      setDiscountTaxOpen(true)
      toast.error('Company policy', violation)
      return
    }
    // Prefill the exact amount so a card / MoMo / exact-cash sale is one tap.
    setAmountReceived(totalPayable.toFixed(2))
    setReceivedTouched(false)
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
    const policyViolation = taxDiscountViolation(policy, { taxName: taxName === 'none' ? '' : taxName, taxRate: orderTaxRate, discountValue: appliedDiscount })
    if (policyViolation) {
      setConfirmOpen(false)
      setDiscountTaxOpen(true)
      toast.error('Company policy', policyViolation)
      return
    }
    if (!paymentSufficient) {
      setReceivedTouched(true)
      toast.error('Insufficient payment', `Collect ${formatGhsExact(shortBy)} more before saving this sale.`)
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
    setDiscountTaxOpen(false)
    setAmountReceived('')
    setReceivedTouched(false)
    toast.success('Sale completed', changeDue > 0 ? `${r.sale?.number} · change ${formatGhsExact(changeDue)}` : r.sale?.number)
  }

  const receiptTotals = receipt ? saleTotals(receipt) : null

  // ── Advanced POS presentation helpers (no business logic) ──
  const scanRef = useRef<HTMLInputElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  const posLocationName =
    branches.find((b) => b.id === saleBranchId)?.name ||
    branches.find((b) => b.id === activeBranchId)?.name ||
    company.name

  const cartItemCount = cart.reduce((sum, l) => sum + l.quantity, 0)

  const clockLabel = useMemo(
    () => `${String(clock.getDate()).padStart(2, '0')}/${String(clock.getMonth() + 1).padStart(2, '0')}/${clock.getFullYear()} ${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`,
    [clock],
  )

  useEffect(() => {
    if (screen !== 2) return
    const id = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen !== 2) return
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [screen])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  // ── Smart product search (presentation only — reuses the same addToCart rules) ──
  const [scanOpen, setScanOpen] = useState(false)
  const [scanActive, setScanActive] = useState(0)
  const scanBoxRef = useRef<HTMLDivElement | null>(null)
  const scanListRef = useRef<HTMLUListElement | null>(null)

  /** Every code a scanner or cashier might type for a product. */
  const codesOf = (item: InventoryItem) =>
    [item.sku, item.barcode, item.code].filter(Boolean).map((value) => String(value).toLowerCase())

  /** Products without their own barcode are scanned by SKU. */
  const barcodeOf = (item: InventoryItem) => item.barcode || item.sku

  /** Top matches on name / SKU / barcode / product code, exact codes first. */
  const scanSuggestions = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return [] as InventoryItem[]
    const scored = products
      .map((item) => {
        const codes = codesOf(item)
        const name = item.name.toLowerCase()
        let rank = 99
        if (codes.includes(needle)) rank = 0
        else if (name === needle) rank = 1
        else if (codes.some((code) => code.startsWith(needle))) rank = 2
        else if (name.startsWith(needle)) rank = 3
        else if (name.includes(needle)) rank = 4
        else if (codes.some((code) => code.includes(needle))) rank = 5
        else if (`${item.category} ${item.brand || ''}`.toLowerCase().includes(needle)) rank = 6
        return { item, rank }
      })
      .filter((entry) => entry.rank < 99)
      .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name))
    return scored.slice(0, 8).map((entry) => entry.item)
  }, [products, q])

  useEffect(() => { setScanActive(0) }, [q])

  // Keep the highlighted suggestion scrolled into view for keyboard-only use.
  useEffect(() => {
    if (!scanOpen) return
    const node = scanListRef.current?.children[scanActive] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [scanActive, scanOpen])

  useDismissOnOutside(scanOpen, scanBoxRef, () => setScanOpen(false))

  /** Add + reset + refocus, so scanning can continue without touching the mouse. */
  const commitScan = (item: InventoryItem) => {
    addToCart(item)
    setQ('')
    setScanOpen(false)
    setScanActive(0)
    scanRef.current?.focus()
  }

  const onScanChange = (value: string) => {
    setQ(value)
    setScanOpen(true)
    // A scanner types a full code in one burst: match a code exactly and ring it up.
    const needle = value.trim().toLowerCase()
    if (needle.length < 4) return
    const exactCode = products.find((item) => codesOf(item).includes(needle))
    if (exactCode) commitScan(exactCode)
  }

  /** Arrow keys move the highlight, Enter rings up, Escape closes the dropdown. */
  const onScanKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!scanSuggestions.length) return
      event.preventDefault()
      setScanOpen(true)
      setScanActive((current) => {
        const last = scanSuggestions.length - 1
        if (event.key === 'ArrowDown') return current >= last ? 0 : current + 1
        return current <= 0 ? last : current - 1
      })
      return
    }
    if (event.key === 'Escape') {
      setScanOpen(false)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const needle = q.trim().toLowerCase()
    if (!needle) return
    const exact = products.find((i) => codesOf(i).includes(needle))
    const highlighted = scanOpen ? scanSuggestions[scanActive] : undefined
    const target = exact || highlighted || (products.length === 1 ? products[0] : undefined)
    if (!target) {
      toast.error('No exact match', 'Refine the search or tap the product in the catalogue.')
      return
    }
    commitScan(target)
  }

  /** Cursor lands in the search field the moment the cashier opens the terminal. */
  useEffect(() => {
    if (screen !== 2) return
    const id = window.setTimeout(() => scanRef.current?.focus(), 80)
    return () => window.clearTimeout(id)
  }, [screen])

  // ── Drawer presentation driven by the company policy ──
  const showDiscountTaxDrawer = policy.discount.visible || policy.tax.visible
  const drawerTitle =
    policy.discount.visible && policy.tax.visible ? 'Discount & tax' : policy.discount.visible ? 'Discount' : 'Tax'
  // Both features usually share a status (e.g. both Optional) — show a single
  // chip in that case, and only split into two when they actually differ.
  const drawerChips = (() => {
    const chips: { key: string; label: string; locked: boolean }[] = []
    if (policy.discount.visible) chips.push({ key: 'discount', label: policy.discount.label, locked: !policy.discount.editable })
    if (policy.tax.visible) chips.push({ key: 'tax', label: policy.tax.label, locked: !policy.tax.editable })
    const identical = chips.length === 2 && chips[0].label === chips[1].label && chips[0].locked === chips[1].locked
    const shown = identical ? [chips[0]] : chips
    return (
      <span className="flex items-center gap-1">
        {shown.map((chip) => (
          <PolicyChip
            key={chip.key}
            label={!identical && chips.length === 2 ? `${chip.key === 'tax' ? 'Tax' : 'Discount'}: ${chip.label}` : chip.label}
            locked={chip.locked}
          />
        ))}
      </span>
    )
  })()
  /** Mandatory rules that are not yet satisfied, surfaced before checkout. */
  const policyWarning = taxDiscountViolation(policy, {
    taxName: taxName === 'none' ? '' : taxName,
    taxRate: orderTaxRate,
    discountValue: appliedDiscount,
  })

  /** Clear the ticket back to a fresh sale — mirrors the post-save reset, records nothing. */
  const clearTicket = () => {
    if (!cart.length) return
    if (!window.confirm('Cancel this transaction and clear all items?')) return
    setCart([])
    setMemberId('')
    setCustomerName('')
    setDiscountId('')
    setDiscountType('percentage')
    setDiscountAmount(0)
    setTaxName('none')
    setOrderTaxRate(0)
    setDiscountTaxOpen(false)
    scanRef.current?.focus()
  }

  return (
    <div className="flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
      {screen !== 2 && (
        <>
        {/* Slim terminal bar — POS runs full-screen, outside the dashboard chrome. */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-[#e7e7df] px-3 dark:border-white/10 dark:bg-[#050506] md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/admin"
              title="Back to admin"
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <h1 className="flex items-center gap-2 truncate font-display text-lg font-semibold tracking-tight">
              <ShoppingCart className="size-5 shrink-0 text-lime" />
              {screen === 2 ? 'Advanced POS' : 'Standard POS'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Catalogue branch"
              value={catalogueScope}
              onChange={(e) => setCatalogueScope(e.target.value)}
              className="w-36 text-xs sm:w-44"
            >
              <option value="all">All branches</option>
              {branchesTreeOrder(availableBranches).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branchDepth(availableBranches, branch.id) > 0 ? '↳ ' : ''}{branch.name}
                </option>
              ))}
            </Select>
            <Badge tone="lime">{formatGhsExact(todaysTotal)} today · {todaysSales.length} sales</Badge>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 px-3 pb-4 pt-3 md:px-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Product catalogue */}
          <div className="card flex min-h-0 flex-col p-4">
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField value={q} onChange={setQ} placeholder="Search products…" className="w-full sm:max-w-xs" />

                {/* Categories */}
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    type="button"
                    onClick={() => { setCategoryMenuOpen((open) => !open); setBrandMenuOpen(false) }}
                    aria-expanded={categoryMenuOpen}
                    aria-haspopup="true"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                      selectedCategories.length
                        ? 'border-lime/60 bg-lime/10 text-lime'
                        : 'border-line text-mist hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Tags className="size-4" aria-hidden />
                    Categories
                    {selectedCategories.length > 0 && (
                      <span className="grid size-5 place-items-center rounded-full bg-lime text-[11px] font-bold text-black">{selectedCategories.length}</span>
                    )}
                    <ChevronDown className={cn('size-4 transition', categoryMenuOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {categoryMenuOpen && (
                    <FilterMenu
                      title="Filter by category"
                      options={categoryOptions}
                      selected={selectedCategories}
                      onToggle={(name) => setSelectedCategories((current) => toggleValue(current, name))}
                      onClear={() => setSelectedCategories([])}
                      onDone={() => setCategoryMenuOpen(false)}
                      emptyLabel="No categories yet"
                    />
                  )}
                </div>

                {/* Brands */}
                <div className="relative" ref={brandMenuRef}>
                  <button
                    type="button"
                    onClick={() => { setBrandMenuOpen((open) => !open); setCategoryMenuOpen(false) }}
                    aria-expanded={brandMenuOpen}
                    aria-haspopup="true"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                      selectedBrands.length
                        ? 'border-lime/60 bg-lime/10 text-lime'
                        : 'border-line text-mist hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Layers className="size-4" aria-hidden />
                    Brands
                    {selectedBrands.length > 0 && (
                      <span className="grid size-5 place-items-center rounded-full bg-lime text-[11px] font-bold text-black">{selectedBrands.length}</span>
                    )}
                    <ChevronDown className={cn('size-4 transition', brandMenuOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {brandMenuOpen && (
                    <FilterMenu
                      title="Filter by brand"
                      options={brandOptions}
                      selected={selectedBrands}
                      onToggle={(name) => setSelectedBrands((current) => toggleValue(current, name))}
                      onClear={() => setSelectedBrands([])}
                      onDone={() => setBrandMenuOpen(false)}
                      emptyLabel="No brands set on products yet"
                    />
                  )}
                </div>

                <span className="ml-auto text-xs text-mist">
                  {products.length} {products.length === 1 ? 'product' : 'products'}
                </span>
              </div>

              {/* Active selections */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedCategories.map((name) => (
                    <FilterChip key={`cat-${name}`} icon={<Tags className="size-3" aria-hidden />} label={name} onRemove={() => setSelectedCategories((current) => toggleValue(current, name))} />
                  ))}
                  {selectedBrands.map((name) => (
                    <FilterChip key={`brand-${name}`} icon={<Layers className="size-3" aria-hidden />} label={name} onRemove={() => setSelectedBrands((current) => toggleValue(current, name))} />
                  ))}
                  <button type="button" onClick={clearFilters} className="rounded-full px-2 py-1 text-xs font-semibold text-mist underline-offset-2 transition hover:text-ember hover:underline">
                    Clear all
                  </button>
                </div>
              )}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                    <div className="relative h-40 w-full flex-none overflow-hidden bg-zinc-100 dark:bg-zinc-800">
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
                      <p className="text-xs text-mist">{st === 'non' ? 'Non-inventory · unlimited' : `${i.quantity} ${i.unit} left`}</p>
                      <p className="mt-1 font-display text-lg">{formatGhsExact(i.sellPrice)}</p>
                      {st === 'low' && <p className="text-[10px] text-amber-400">Low stock</p>}
                      {out && <p className="text-[10px] text-ember">Out of stock</p>}
                    </div>
                  </button>
                )
              })}
              {!products.length && (
                <div className="sm:col-span-2 xl:col-span-3">
                  <Empty
                    title="No products"
                    desc={activeFilterCount > 0 ? 'Nothing matches these filters at this branch.' : 'Try a different search.'}
                  />
                  {activeFilterCount > 0 && (
                    <div className="mt-2 text-center">
                      <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="card flex min-h-0 flex-col p-4">
            <h3 className="flex items-center gap-2 font-semibold"><ShoppingCart className="size-4 text-lime" /> Cart</h3>

            <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
              {cart.map((l) => {
                const item = itemOf(l.itemId)
                if (!item) return null
                const lineGross = item.sellPrice * l.quantity
                const lineDiscount = Math.max(0, Math.min(l.discount || 0, lineGross))
                return (
                  <div key={l.itemId} className="rounded-xl border border-white/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <img
                          src={posProductImage(item)}
                          alt=""
                          loading="lazy"
                          onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }}
                          className="size-10 shrink-0 rounded-lg border border-line object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-mist">{formatGhsExact(item.sellPrice)} × {l.quantity}</p>
                        </div>
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

              <div className="space-y-3 border-t border-line pt-3">
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

              {showDiscountTaxDrawer && (
              <div className="overflow-hidden rounded-xl border border-line">
                <button
                  type="button"
                  onClick={() => setDiscountTaxOpen((open) => !open)}
                  aria-expanded={discountTaxOpen}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Percent className="size-4 text-lime" /> {drawerTitle} {drawerChips}</span>
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
                    {policy.discount.visible && (
                    <>
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
                      <Select value={discountType} disabled={!!selectedDiscount || !policy.discount.editable} onChange={(event) => setDiscountType(event.target.value as SaleDiscountType)}>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed amount</option>
                      </Select>
                    </Field>
                    <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
                      <Input type="number" min="0" step="0.01" disabled={!!selectedDiscount || !policy.discount.editable} value={discountAmount} onChange={(event) => {
                        const value = Number(event.target.value)
                        setDiscountAmount(Number.isFinite(value) ? Math.max(0, value) : 0)
                      }} />
                    </Field>
                    </>
                    )}
                    {policy.tax.visible && (
                    <>
                    <Field label="Tax name">
                      <Select value={taxName} disabled={!policy.tax.editable} onChange={(event) => {
                        const nextName = event.target.value
                        const selectedTax = taxOptions.find((tax) => tax.name === nextName)
                        setTaxName(nextName)
                        setOrderTaxRate(selectedTax?.rate || 0)
                      }}>
                        {!policy.tax.required && <option value="none">No tax</option>}
                        {taxOptions.map((tax) => <option key={tax.name} value={tax.name}>{tax.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Tax rate (%)">
                      <Input value={`${orderTaxRate}%`} readOnly aria-label="Associated tax rate" />
                    </Field>
                    </>
                    )}
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
              )}

              {policyWarning && (
                <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold leading-snug text-amber-700 dark:text-amber-300">
                  {policyWarning}
                </div>
              )}

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
              <div className="grid gap-2">
                {canSelectBranch && (
                  <Field label="Branch">
                    <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                      <option value="">Select branch…</option>
                      {branchesTreeOrder(availableBranches).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branchDepth(availableBranches, branch.id) > 0 ? '↳ ' : ''}{branch.name}
                        </option>
                      ))}
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

              </div>
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-sm font-semibold">Total payable</p>
              <p className="font-display text-2xl text-lime-ink dark:text-lime">{formatGhsExact(totalPayable)}</p>
            </div>

            <Button className="mt-3 w-full shrink-0" size="lg" disabled={!cart.length || !!policyWarning} onClick={requestCompleteSale}>
              <Receipt className="size-4" /> Complete sale · {formatGhsExact(totalPayable)}
            </Button>
          </div>
        </div>
        </>
      )}

      {screen === 2 && (
        <>
        {/* ─────────── Advanced POS: cashier workspace ─────────── */}
        {/* Terminal bar — location, live clock, session takings, catalogue scope. */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0b0b0d] md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/admin"
              title="Back to admin"
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ArrowLeft className="size-4" aria-hidden />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <span className="hidden items-center gap-1.5 text-sm sm:flex">
              <MapPin className="size-4 shrink-0 text-lime" aria-hidden />
              <span className="text-mist">Location:</span>
              <span className="truncate font-semibold">{posLocationName}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-2.5 py-1.5 text-xs font-bold text-black tabular-nums">
              <CalendarDays className="size-3.5" aria-hidden />
              {clockLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              aria-label="Catalogue branch"
              value={catalogueScope}
              onChange={(e) => setCatalogueScope(e.target.value)}
              className="w-32 text-xs sm:w-44"
            >
              <option value="all">All branches</option>
              {branchesTreeOrder(availableBranches).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branchDepth(availableBranches, branch.id) > 0 ? '↳ ' : ''}{branch.name}
                </option>
              ))}
            </Select>
            <Badge tone="lime">{formatGhsExact(todaysTotal)} today · {todaysSales.length} sales</Badge>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              className="hidden size-9 place-items-center rounded-lg border border-line text-mist transition hover:text-lime sm:grid"
            >
              {isFullscreen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 pt-3 md:px-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-4">
          {/* ══ Ticket column: customer → cart → summary → actions ══ */}
          <section aria-label="Current transaction" className="card flex min-h-0 flex-col overflow-hidden p-0">
            {/* Customer + scan row */}
            <div className="grid shrink-0 gap-2 border-b border-line p-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.9fr)]">
              <div className="flex items-center gap-2">
                <User className="size-4 shrink-0 text-mist" aria-hidden />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Select aria-label="Customer type" value={customerType} onChange={(e) => setCustomerType(e.target.value as 'walkin' | 'member')}>
                    <option value="walkin">Walk-in customer</option>
                    <option value="member">Member</option>
                  </Select>
                  {customerType === 'member' ? (
                    <Select aria-label="Select member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                      <option value="">Select member…</option>
                      {members.map((m) => {
                        const u = users.find((x) => x.id === m.userId)
                        return <option key={m.id} value={m.id}>{u?.name}</option>
                      })}
                    </Select>
                  ) : (
                    <Input aria-label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" />
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <div ref={scanBoxRef} className="pos-scan relative">
                  <div className="pos-scan-control">
                    <Search className="pos-scan-icon size-[18px]" aria-hidden />
                    <input
                      ref={scanRef}
                      value={q}
                      onChange={(e) => onScanChange(e.target.value)}
                      onKeyDown={onScanKeyDown}
                      onFocus={() => { if (q.trim()) setScanOpen(true) }}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      role="combobox"
                      aria-expanded={scanOpen && scanSuggestions.length > 0}
                      aria-controls="pos-scan-results"
                      aria-autocomplete="list"
                      aria-activedescendant={scanOpen && scanSuggestions.length ? `pos-scan-option-${scanActive}` : undefined}
                      aria-label="Search products, enter SKU, or scan barcode"
                      placeholder="Search products, enter SKU, or scan barcode…"
                      className="pos-scan-input"
                    />
                    {q ? (
                      <button
                        type="button"
                        onClick={() => { setQ(''); setScanOpen(false); scanRef.current?.focus() }}
                        aria-label="Clear search"
                        className="pos-scan-clear"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    ) : null}
                    <span className="pos-scan-badge" title="Barcode scanner ready">
                      <ScanLine className="size-[18px]" aria-hidden />
                    </span>
                  </div>

                  {scanOpen && q.trim() ? (
                    <div className="pos-scan-panel">
                      {scanSuggestions.length ? (
                        <>
                          <div className="pos-scan-head">
                            <span className="pos-scan-col-name">Product</span>
                            <span className="pos-scan-col-sku">SKU / Barcode</span>
                            <span className="pos-scan-col-stock">Stock</span>
                            <span className="pos-scan-col-price">Price</span>
                          </div>
                          <ul ref={scanListRef} id="pos-scan-results" role="listbox" className="pos-scan-list">
                            {scanSuggestions.map((item, index) => {
                              const soldOut = !item.nonInventory && item.quantity <= 0
                              return (
                                <li
                                  key={item.id}
                                  id={`pos-scan-option-${index}`}
                                  role="option"
                                  aria-selected={index === scanActive}
                                  onMouseEnter={() => setScanActive(index)}
                                  onMouseDown={(event) => { event.preventDefault(); commitScan(item) }}
                                  className={cn('pos-scan-row', index === scanActive && 'is-active', soldOut && 'is-out')}
                                >
                                  <span className="pos-scan-col-name">
                                    <img src={posProductImage(item)} alt="" className="pos-scan-thumb" />
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold">{highlightMatch(item.name, q)}</span>
                                      <span className="block truncate text-[11px] text-mist">{item.category}{item.brand ? ` · ${item.brand}` : ''}</span>
                                    </span>
                                  </span>
                                  <span className="pos-scan-col-sku">
                                    <span className="block truncate font-mono text-[11px]">{highlightMatch(item.sku, q)}</span>
                                    <span className="block truncate font-mono text-[11px] text-mist">{highlightMatch(barcodeOf(item), q)}</span>
                                  </span>
                                  <span className={cn('pos-scan-col-stock tabular-nums', item.nonInventory ? 'text-mist' : soldOut ? 'text-red-500' : item.quantity <= item.reorderPoint ? 'text-amber-500' : '')}>
                                    {item.nonInventory ? 'Non-inv' : soldOut ? 'Out' : item.quantity}
                                  </span>
                                  <span className="pos-scan-col-price tabular-nums font-semibold">{formatGhsExact(item.sellPrice)}</span>
                                </li>
                              )
                            })}
                          </ul>
                          <div className="pos-scan-foot">
                            <span>↑ ↓ to move · Enter to add · Esc to close</span>
                            <span>{scanSuggestions.length} match{scanSuggestions.length === 1 ? '' : 'es'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="pos-scan-empty">No product matches “{q.trim()}”.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {canSelectBranch ? (
                    <Select aria-label="Sale branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                      <option value="">Select branch…</option>
                      {branchesTreeOrder(availableBranches).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branchDepth(availableBranches, branch.id) > 0 ? '↳ ' : ''}{branch.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1.5 truncate rounded-xl border border-line px-3 text-sm text-mist">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{posLocationName}</span>
                    </div>
                  )}
                  <DatePicker value={saleDate} onChange={setSaleDate} />
                </div>
              </div>
            </div>

            {/* Cart table */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-mist dark:bg-white/[0.04]">
                    <th scope="col" className="w-10 px-3 py-2.5 font-semibold">#</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Product</th>
                    <th scope="col" className="w-36 px-3 py-2.5 text-center font-semibold">Quantity</th>
                    <th scope="col" className="w-28 px-3 py-2.5 text-right font-semibold">Unit price</th>
                    <th scope="col" className="w-28 px-3 py-2.5 text-right font-semibold">Discount</th>
                    <th scope="col" className="w-28 px-3 py-2.5 text-right font-semibold">Subtotal</th>
                    <th scope="col" className="w-12 px-3 py-2.5 text-right font-semibold"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l, index) => {
                    const item = itemOf(l.itemId)
                    if (!item) return null
                    const lineGross = item.sellPrice * l.quantity
                    const lineDiscount = Math.max(0, Math.min(l.discount || 0, lineGross))
                    return (
                      <tr key={l.itemId} className="border-b border-line last:border-0 even:bg-black/[0.015] dark:even:bg-white/[0.02]">
                        <td className="px-3 py-2 align-middle text-xs tabular-nums text-mist">{index + 1}</td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <img
                              src={posProductImage(item)}
                              alt=""
                              loading="lazy"
                              onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }}
                              className="size-9 shrink-0 rounded-lg border border-line object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight">{item.name}</p>
                              <p className="truncate text-[11px] text-mist">{item.sku} · {item.quantity} {item.unit} in stock</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="mx-auto flex w-fit items-center gap-1 rounded-lg border border-line p-0.5">
                            <button
                              type="button"
                              onClick={() => changeQty(l.itemId, -1)}
                              aria-label={`Decrease ${item.name}`}
                              className="grid size-7 place-items-center rounded-md text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
                            >
                              <Minus className="size-4" aria-hidden />
                            </button>
                            <span className="w-9 text-center text-sm font-bold tabular-nums" aria-live="polite">{l.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(l.itemId, 1)}
                              aria-label={`Increase ${item.name}`}
                              className="grid size-7 place-items-center rounded-md text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-300"
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-middle text-sm tabular-nums">{formatGhsExact(item.sellPrice)}</td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={lineDiscount || ''}
                            placeholder="0.00"
                            aria-label={`Line discount for ${item.name}`}
                            onChange={(e) => setLineDiscount(l.itemId, Number(e.target.value))}
                            className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right text-xs font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-lime dark:bg-zinc-900"
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-middle text-sm font-bold tabular-nums">{formatGhsExact(lineGross - lineDiscount)}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => removeLine(l.itemId)}
                            aria-label={`Remove ${item.name}`}
                            title="Remove line"
                            className="grid size-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {!cart.length && (
                <div className="grid place-items-center px-4 py-14 text-center">
                  <PackageSearch className="mb-2 size-10 text-mist/60" aria-hidden />
                  <p className="font-semibold">No items on this ticket</p>
                  <p className="mt-0.5 text-sm text-mist">Scan a bar code or tap a product from the catalogue to start.</p>
                </div>
              )}
            </div>

            {/* Discount &amp; tax drawer — visibility follows the company policy */}
            {showDiscountTaxDrawer && (
            <div className="shrink-0 border-t border-line">
              <button
                type="button"
                onClick={() => setDiscountTaxOpen((open) => !open)}
                aria-expanded={discountTaxOpen}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold"><Percent className="size-4 text-lime" aria-hidden /> {drawerTitle} {drawerChips}</span>
                <span className="flex items-center gap-2 text-xs font-semibold text-mist">
                  {appliedDiscount > 0
                    ? `${formatGhsExact(appliedDiscount)} discount`
                    : orderTax > 0
                      ? `${formatGhsExact(orderTax)} tax`
                      : 'Add options'}
                  <ChevronDown className={cn('size-4 transition-transform', discountTaxOpen ? '' : '-rotate-90')} aria-hidden />
                </span>
              </button>
              {discountTaxOpen && (
                <div className="grid max-h-[42vh] gap-3 overflow-y-auto border-t border-line p-3 sm:grid-cols-2">
                  {policy.discount.visible && (
                  <>
                  <Field label="Discount code">
                    <Select
                      disabled={!policy.discount.editable}
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
                    <Select value={discountType} disabled={!!selectedDiscount || !policy.discount.editable} onChange={(event) => setDiscountType(event.target.value as SaleDiscountType)}>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </Select>
                  </Field>
                  <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
                    <Input type="number" min="0" step="0.01" disabled={!!selectedDiscount || !policy.discount.editable} value={discountAmount} onChange={(event) => {
                      const value = Number(event.target.value)
                      setDiscountAmount(Number.isFinite(value) ? Math.max(0, value) : 0)
                    }} />
                  </Field>
                  </>
                  )}
                  {policy.tax.visible && (
                  <>
                  <Field label="Tax name">
                    <Select value={taxName} disabled={!policy.tax.editable} onChange={(event) => {
                      const nextName = event.target.value
                      const selectedTax = taxOptions.find((tax) => tax.name === nextName)
                      setTaxName(nextName)
                      setOrderTaxRate(selectedTax?.rate || 0)
                    }}>
                      {!policy.tax.required && <option value="none">No tax</option>}
                      {taxOptions.map((tax) => <option key={tax.name} value={tax.name}>{tax.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Tax rate (%)">
                    <Input value={`${orderTaxRate}%`} readOnly aria-label="Associated tax rate" />
                  </Field>
                  </>
                  )}
                </div>
              )}

              {selectedDiscount && codeBlock && (
                <div className="border-t border-line px-3 py-2 text-xs leading-snug text-amber-700 dark:text-amber-300">
                  <p className="font-bold">{selectedDiscount.name} ({selectedDiscount.code}) is not applied to this sale.</p>
                  <p className="mt-0.5">
                    {codeBlock.charAt(0).toUpperCase() + codeBlock.slice(1)}.
                    {codeShortfall > 0 && <span> Add {formatGhsExact(codeShortfall)} more to the sale to use it.</span>}
                    <span> Pick “Manual discount” to enter a custom amount instead.</span>
                  </p>
                </div>
              )}
            </div>
            )}

            {policyWarning && (
              <div className="shrink-0 border-t border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {policyWarning}
              </div>
            )}

            {/* Transaction summary strip */}
            <dl className="grid shrink-0 grid-cols-2 border-t border-line text-center sm:grid-cols-5">
              {([
                { label: 'Items', value: cartItemCount.toFixed(2), tone: '', show: true },
                { label: 'Subtotal', value: formatGhsExact(subtotal), tone: '', show: true },
                { label: 'Discount (−)', value: formatGhsExact(appliedDiscount), tone: 'text-rose-600 dark:text-rose-300', show: policy.discount.visible },
                { label: 'Order tax (+)', value: formatGhsExact(orderTax), tone: 'text-emerald-600 dark:text-emerald-300', show: policy.tax.visible },
              ]).filter((cell) => cell.show).map((cell) => (
                <div key={cell.label} className="border-r border-line px-2 py-2.5 last:border-r-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-mist">{cell.label}</dt>
                  <dd className={cn('mt-0.5 text-sm font-bold tabular-nums', cell.tone)}>{cell.value}</dd>
                </div>
              ))}
              <div className="col-span-2 bg-lime/15 px-2 py-2.5 sm:col-span-1">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-lime-ink dark:text-lime">Total payable</dt>
                <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-lime-ink dark:text-lime">{formatGhsExact(totalPayable)}</dd>
              </div>
            </dl>

            {/* Action bar */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line p-3">
              <Button variant="outline" disabled={!cart.length} onClick={clearTicket} className="text-rose-600 dark:text-rose-300">
                <X className="size-4" aria-hidden /> Cancel
              </Button>
              <div className="flex items-center gap-1.5" role="group" aria-label="Payment method">
                {([
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'momo', label: 'MoMo', icon: Smartphone },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    aria-pressed={method === m.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      method === m.id ? 'border-lime bg-lime/10 text-lime-ink ring-1 ring-lime dark:text-lime' : 'border-line text-mist hover:border-lime/40',
                    )}
                  >
                    <m.icon className="size-4" aria-hidden />
                    {m.label}
                  </button>
                ))}
              </div>
              <Button size="lg" className="ml-auto min-w-[13rem] flex-1 sm:flex-none" disabled={!cart.length || !!policyWarning} onClick={requestCompleteSale}>
                <Receipt className="size-4" aria-hidden /> Pay {formatGhsExact(totalPayable)}
              </Button>
            </div>
          </section>

          {/* ══ Catalogue column ══ */}
          <section aria-label="Product catalogue" className="card flex min-h-0 flex-col overflow-hidden p-0">
            <div className="shrink-0 space-y-2 border-b border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField value={q} onChange={setQ} placeholder="Search catalogue…" className="w-full sm:max-w-[14rem]" />

                <div className="relative" ref={categoryMenuRef}>
                  <button
                    type="button"
                    onClick={() => { setCategoryMenuOpen((open) => !open); setBrandMenuOpen(false) }}
                    aria-expanded={categoryMenuOpen}
                    aria-haspopup="true"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition',
                      selectedCategories.length ? 'border-lime/60 bg-lime/10 text-lime' : 'border-line text-mist hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Tags className="size-4" aria-hidden />
                    Category
                    <span className="grid size-5 place-items-center rounded-full bg-black/5 text-[10px] font-bold dark:bg-white/10">
                      {selectedCategories.length || categoryOptions.length}
                    </span>
                    <ChevronDown className={cn('size-3.5 transition', categoryMenuOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {categoryMenuOpen && (
                    <FilterMenu
                      title="Filter by category"
                      options={categoryOptions}
                      selected={selectedCategories}
                      onToggle={(name) => setSelectedCategories((current) => toggleValue(current, name))}
                      onClear={() => setSelectedCategories([])}
                      onDone={() => setCategoryMenuOpen(false)}
                      emptyLabel="No categories yet"
                    />
                  )}
                </div>

                <div className="relative" ref={brandMenuRef}>
                  <button
                    type="button"
                    onClick={() => { setBrandMenuOpen((open) => !open); setCategoryMenuOpen(false) }}
                    aria-expanded={brandMenuOpen}
                    aria-haspopup="true"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition',
                      selectedBrands.length ? 'border-lime/60 bg-lime/10 text-lime' : 'border-line text-mist hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Layers className="size-4" aria-hidden />
                    Brands
                    <span className="grid size-5 place-items-center rounded-full bg-black/5 text-[10px] font-bold dark:bg-white/10">
                      {selectedBrands.length || brandOptions.length}
                    </span>
                    <ChevronDown className={cn('size-3.5 transition', brandMenuOpen && 'rotate-180')} aria-hidden />
                  </button>
                  {brandMenuOpen && (
                    <FilterMenu
                      title="Filter by brand"
                      options={brandOptions}
                      selected={selectedBrands}
                      onToggle={(name) => setSelectedBrands((current) => toggleValue(current, name))}
                      onClear={() => setSelectedBrands([])}
                      onDone={() => setBrandMenuOpen(false)}
                      emptyLabel="No brands set on products yet"
                    />
                  )}
                </div>

                <span className="ml-auto text-xs text-mist">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedCategories.map((name) => (
                    <FilterChip key={`cat-${name}`} icon={<Tags className="size-3" aria-hidden />} label={name} onRemove={() => setSelectedCategories((current) => toggleValue(current, name))} />
                  ))}
                  {selectedBrands.map((name) => (
                    <FilterChip key={`brand-${name}`} icon={<Layers className="size-3" aria-hidden />} label={name} onRemove={() => setSelectedBrands((current) => toggleValue(current, name))} />
                  ))}
                  <button type="button" onClick={clearFilters} className="rounded-full px-2 py-1 text-xs font-semibold text-mist underline-offset-2 transition hover:text-ember hover:underline">
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((i) => {
                const st = stockStatus(i)
                const out = st === 'out'
                const inCart = cart.find((l) => l.itemId === i.id)?.quantity || 0
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => addToCart(i)}
                    disabled={out}
                    aria-label={`Add ${i.name} — ${formatGhsExact(i.sellPrice)}`}
                    className={cn(
                      'group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white text-left transition dark:bg-white/[0.02]',
                      out ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:border-lime hover:shadow-md focus-visible:border-lime',
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute right-1.5 top-1.5 z-10 grid min-w-6 place-items-center rounded-full bg-lime px-1.5 py-0.5 text-[11px] font-bold text-black shadow">
                        {inCart}
                      </span>
                    )}
                    <div className="aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={posProductImage(i)}
                        alt=""
                        loading="lazy"
                        onError={(event) => { event.currentTarget.src = DEFAULT_PRODUCT_IMAGE }}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-2">
                      <p className="line-clamp-2 text-xs font-semibold leading-tight">{i.name}</p>
                      <p className="text-[10px] text-mist">{i.sku}</p>
                      <p className="mt-auto pt-1 font-display text-sm font-bold text-lime-ink dark:text-lime">{formatGhsExact(i.sellPrice)}</p>
                      <p className={cn('text-[10px]', out ? 'text-ember' : st === 'low' ? 'text-amber-500' : 'text-mist')}>
                        {out ? 'Out of stock' : st === 'non' ? 'Non-inventory · unlimited' : `${i.quantity} ${i.unit} in stock`}
                      </p>
                    </div>
                  </button>
                )
              })}
              {!products.length && (
                <div className="sm:col-span-3 xl:col-span-4">
                  <Empty
                    title="No products"
                    desc={activeFilterCount > 0 ? 'Nothing matches these filters at this branch.' : 'Try a different search.'}
                  />
                  {activeFilterCount > 0 && (
                    <div className="mt-2 text-center">
                      <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
        </>
      )}

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
                            {formatGhsExact(item.sellPrice)} each · {item.nonInventory ? 'stock not tracked (unlimited)' : `${leftAfter} left after sale`}
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

            {/* Tender — Total ▸ Amount received ▸ Change due ▸ Payment method */}
            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <span className="text-sm font-semibold">Total amount</span>
                <span className="font-display text-lg font-bold tabular-nums text-lime-ink dark:text-lime">{formatGhsExact(totalPayable)}</span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pos-amount-received" className="mb-1 block text-xs font-semibold text-mist">
                    Amount received <span className="text-ember" aria-hidden>*</span>
                  </label>
                  <input
                    id="pos-amount-received"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    required
                    autoFocus
                    value={amountReceived}
                    onChange={(event) => { setAmountReceived(event.target.value); setReceivedTouched(true) }}
                    onBlur={() => setReceivedTouched(true)}
                    aria-required="true"
                    aria-invalid={receivedTouched && !paymentSufficient}
                    aria-describedby="pos-tender-help"
                    placeholder="0.00"
                    className={cn(
                      'w-full rounded-xl border bg-white px-3 py-2.5 text-right font-display text-lg font-bold tabular-nums focus:outline-none focus:ring-2 dark:bg-zinc-900',
                      receivedTouched && !paymentSufficient
                        ? 'border-ember focus:ring-ember/40'
                        : 'border-line focus:ring-lime/50',
                    )}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setAmountReceived(totalPayable.toFixed(2)); setReceivedTouched(true) }}
                      className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-mist transition hover:border-lime/50 hover:text-lime"
                    >
                      Exact
                    </button>
                    {QUICK_TENDER.filter((note) => note >= totalPayable).slice(0, 3).map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => { setAmountReceived(note.toFixed(2)); setReceivedTouched(true) }}
                        className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-mist transition hover:border-lime/50 hover:text-lime"
                      >
                        {formatGhsExact(note)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pos-change-due" className="mb-1 block text-xs font-semibold text-mist">Change due</label>
                  <output
                    id="pos-change-due"
                    htmlFor="pos-amount-received"
                    aria-live="polite"
                    className={cn(
                      'block w-full rounded-xl border px-3 py-2.5 text-right font-display text-lg font-bold tabular-nums',
                      changeDue > 0
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-line bg-zinc-50 text-mist dark:bg-white/[0.03]',
                    )}
                  >
                    {formatGhsExact(changeDue)}
                  </output>
                  <p id="pos-tender-help" className="mt-1.5 text-[11px] leading-snug">
                    {!paymentSufficient ? (
                      <span className="font-semibold text-ember">
                        Amount received is {formatGhsExact(shortBy)} short of the total payable.
                      </span>
                    ) : changeDue > 0 ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Hand back {formatGhsExact(changeDue)} in change.
                      </span>
                    ) : (
                      <span className="text-mist">Exact amount received — no change due.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5">
                <span className="text-xs font-semibold text-mist">Payment method</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  {method === 'cash' ? <Banknote className="size-4 text-lime" aria-hidden /> : method === 'card' ? <CreditCard className="size-4 text-lime" aria-hidden /> : <Smartphone className="size-4 text-lime" aria-hidden />}
                  {method === 'momo' ? 'MoMo' : method.charAt(0).toUpperCase() + method.slice(1)}
                </span>
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
                <p className="text-xs text-mist">Cashier</p>
                <p className="font-semibold">{user?.name || '—'}</p>
              </div>
            </div>

            <p className="text-xs text-mist">
              Saving records the payment, creates a paid invoice, and deducts the items from stock.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                onClick={completeSale}
                disabled={!paymentSufficient}
                title={paymentSufficient ? undefined : `Collect ${formatGhsExact(shortBy)} more to continue`}
              >
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
