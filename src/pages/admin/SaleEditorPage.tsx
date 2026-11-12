import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TaxMultiSelect, TaxLineCell, parseTaxSelection, sumTaxRates } from '../../components/TaxMultiSelect'
import { computeLineTaxes, lineTaxTotal, taxSummary, distinctTaxNames } from '../../lib/taxCalc'
import {
  ArrowLeft,
  ChevronDown,
  CirclePlus,
  FileUp,
  Info,
  Package,
  Paperclip,
  Percent,
  Plus,
  ReceiptText,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { Button, DatePicker, Field, Input, Select } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cn, formatGhsExact, formatDate } from '../../lib/utils'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { visibleBranches } from '../../lib/accessScope'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel, recordDiscountUsage } from '../../lib/discounts'
import { loadCoupons, loadCouponAssignments, couponBlockReason, couponValueLabel, recordCouponRedemption } from '../../lib/coupons'
import type { Coupon, CouponAssignment } from '../../types'
import { resolveTaxDiscountPolicy, taxDiscountViolation } from '../../lib/taxDiscountPolicy'
import { costCenterOnLineItems } from '../../lib/costCenters'
import { CostCenterSelect } from '../../components/CostCenterSelect'
import type {
  PaymentMethod,
  Sale,
  SaleAdditionalExpense,
  SaleDiscountType,
  SaleInput,
  SaleLine,
} from '../../types'

interface SaleEditorPageProps {
  sale?: Sale
  onClose: () => void
}

type SaleFormLine = SaleLine & { discount: number; /** Selected tax names while editing in PRODUCT tax mode. */ taxNames?: string[] }

type ExpenseRow = SaleAdditionalExpense & { id: string }

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'momo', label: 'Mobile Money' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'paystack', label: 'Paystack' },
  { value: 'payaza', label: 'Payaza' },
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'hubtel', label: 'Hubtel' },
]

const today = () => new Date().toISOString().slice(0, 10)

function localDateTime() {
  const value = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function Section({
  title,
  icon,
  children,
  aside,
  collapsible = false,
  open = true,
  onToggle,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  aside?: ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  const headerContent = (
    <>
      <span className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-lime/15 text-lime-ink dark:text-lime">{icon}</span>
        <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</span>
      </span>
      <span className="flex items-center gap-3">
        {aside}
        {collapsible && <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />}
      </span>
    </>
  )

  return (
    <section className="overflow-visible rounded-xl border border-line bg-white shadow-sm dark:bg-zinc-900">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:px-5 ${open ? 'border-line' : 'border-transparent'}`}
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          {headerContent}
        </div>
      )}
      {(!collapsible || open) && <div className="p-4 sm:p-5">{children}</div>}
    </section>
  )
}

function HelpLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Info className="size-3.5 text-muted" aria-hidden="true" />
    </span>
  )
}

function UploadField({
  label,
  icon,
  name,
  onChange,
}: {
  label: ReactNode
  icon: ReactNode
  name?: string
  onChange: (name: string) => void
}) {
  return (
    <Field label={label}>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-transparent px-3 text-sm text-muted transition hover:border-lime/60 hover:text-zinc-900 dark:hover:text-zinc-100">
        <span className="text-muted">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{name || 'Choose a file'}</span>
        <span className="shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 dark:bg-zinc-900">Browse</span>
        <input
          type="file"
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0]?.name || '')}
        />
      </label>
    </Field>
  )
}

export function SaleEditorPage({ sale, onClose }: SaleEditorPageProps) {
  const app = useApp()
  const { inventory, members, users, branches, accounts, branchSettings, activeBranchId, recordSale, updateSale, log, company } = app
  const showCostCenter = costCenterOnLineItems(company)
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(sale)
  const details = sale?.details
  const availableBranches = useMemo(
    () => visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive'),
    [app.activeCompanyId, branches, user],
  )

  const [businessLocation, setBusinessLocation] = useState(
    details?.businessLocation || availableBranches[0]?.name || '',
  )
  useEffect(() => {
    if (sale || !app.activeBranchId) return
    const selected = availableBranches.find((branch) => branch.id === app.activeBranchId)
    if (selected && selected.name !== businessLocation) setBusinessLocation(selected.name)
  }, [app.activeBranchId, availableBranches, businessLocation, sale])
  const [sellingPriceGroup, setSellingPriceGroup] = useState(details?.sellingPriceGroup || 'Default Selling Price')
  const [serviceType, setServiceType] = useState(details?.serviceType || '')
  const [subscribed, setSubscribed] = useState(Boolean(details?.subscribed))
  const [customerId, setCustomerId] = useState(sale?.memberId || 'walk-in')
  const [customerName, setCustomerName] = useState(sale?.customerName || (sale?.memberId ? users.find((candidate) => candidate.id === members.find((member) => member.id === sale.memberId)?.userId)?.name : undefined) || 'Walk-in Customer')
  const [payTerm, setPayTerm] = useState(details?.payTerm ? String(details.payTerm) : '')
  const [payTermUnit, setPayTermUnit] = useState(details?.payTermUnit || 'days')
  const [saleDate, setSaleDate] = useState(sale?.date || today())
  const [billingAddress, setBillingAddress] = useState(details?.billingAddress || '')
  const [saleStatus, setSaleStatus] = useState(sale?.status || '')
  const [invoiceScheme, setInvoiceScheme] = useState(details?.invoiceScheme || 'Default')
  const [invoiceNumber, setInvoiceNumber] = useState(details?.invoiceNumber || sale?.number || '')
  const [shippingAddress, setShippingAddress] = useState(details?.shippingAddress || '')
  const [table, setTable] = useState(details?.table || '')
  const [serviceStaff, setServiceStaff] = useState(details?.serviceStaff || '')
  const [attachedDocument, setAttachedDocument] = useState(details?.attachedDocumentName || '')
  const [shippingDocument, setShippingDocument] = useState(details?.shippingDocumentName || '')

  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<SaleFormLine[]>(() =>
    (sale?.lines || []).map((line) => ({ ...line, discount: line.discount || 0, taxNames: line.taxes?.map((t) => t.name) })))
  const [discountType, setDiscountType] = useState<SaleDiscountType>(details?.discountType || 'percentage')
  const [discountAmount, setDiscountAmount] = useState(details?.discountAmount || 0)
  const [discountId, setDiscountId] = useState(details?.discountId || '')
  const [tableDiscounts, setTableDiscounts] = useState(() => activeDiscounts())
  const [coupons, setCoupons] = useState(() => loadCoupons())
  const [couponAssignments, setCouponAssignments] = useState(() => loadCouponAssignments())
  const [couponAssignmentId, setCouponAssignmentId] = useState(details?.couponAssignmentId || '')
  const [taxName, setTaxName] = useState(details?.taxName || 'none')
  const [orderTaxRate, setOrderTaxRate] = useState(details?.orderTaxRate || 0)
  /** Names of every selected tax — multiple taxes combine additively. */
  const [taxSelection, setTaxSelection] = useState<string[]>(() =>
    parseTaxSelection(details?.taxName, details?.taxes),
  )
  /** GLOBAL = order taxes on every line (default); PRODUCT = taxes chosen per line. */
  const [taxMode, setTaxMode] = useState<'GLOBAL' | 'PRODUCT'>(details?.taxMode || 'GLOBAL')
  const [sellNote, setSellNote] = useState(details?.sellNote || '')
  const [shippingDetails, setShippingDetails] = useState(details?.shippingDetails || '')
  const [shippingCharges, setShippingCharges] = useState(details?.shippingCharges || 0)
  const [shippingStatus, setShippingStatus] = useState(details?.shippingStatus || '')
  const [deliveredTo, setDeliveredTo] = useState(details?.deliveredTo || '')
  const [deliveryPerson, setDeliveryPerson] = useState(details?.deliveryPerson || '')
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => (details?.additionalExpenses || []).map((item, index) => ({ ...item, id: `expense-${index}` })))

  const [paymentAmount, setPaymentAmount] = useState(details?.payment?.amount || 0)
  const [paidOn, setPaidOn] = useState(details?.payment?.paidOn || localDateTime())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(details?.payment?.method || sale?.method || 'cash')
  const [paymentAccount, setPaymentAccount] = useState(details?.payment?.account || 'none')
  const [paymentNote, setPaymentNote] = useState(details?.payment?.note || '')
  const [saving, setSaving] = useState(false)
  const [showProductResults, setShowProductResults] = useState(false)
  const [discountTaxOpen, setDiscountTaxOpen] = useState(() => Boolean(
    details?.discountAmount || details?.taxName || details?.orderTaxRate || details?.sellNote || sale?.lines.some((line) => (line.discount || 0) > 0),
  ))
  const [shippingExpensesOpen, setShippingExpensesOpen] = useState(() => Boolean(
    details?.shippingDetails || details?.shippingAddress || details?.shippingCharges || details?.shippingStatus || details?.deliveredTo || details?.deliveryPerson || details?.additionalExpenses?.length,
  ))

  useEffect(() => {
    if (discountTaxOpen) {
      setTableDiscounts(activeDiscounts())
      setCoupons(loadCoupons())
      setCouponAssignments(loadCouponAssignments())
    }
  }, [discountTaxOpen])

  const selectedDiscount = tableDiscounts.find((d) => d.id === discountId) || null

  const locations = useMemo(() => {
    const branchNames = availableBranches
      .map((branch) => branch.name.trim())
      .filter(Boolean)
    // Keep an existing saved location visible while editing if its branch was removed.
    if (businessLocation && !branchNames.includes(businessLocation)) return [businessLocation, ...branchNames]
    return branchNames
  }, [availableBranches, businessLocation])

  const locationBranchId = availableBranches.find((branch) => branch.name === businessLocation)?.id || sale?.branchId || user?.branchId || activeBranchId

  const customerOptions = useMemo(() => members.map((member) => ({
    value: member.id,
    label: users.find((candidate) => candidate.id === member.userId)?.name || member.id,
  })), [members, users])

  const staffOptions = useMemo(() => users
    .filter((candidate) => candidate.status !== 'inactive' && hasRole('super_admin', 'gym_manager', 'staff'))
    .map((candidate) => ({ value: candidate.id, label: candidate.name })), [users, hasRole])

  const taxOptions = useMemo(() => {
    const settings = branchSettingsFor(branchSettings, locationBranchId)
    const configuredTaxes = settings?.taxRates?.length ? settings.taxRates : DEFAULT_BRANCH_TAXES
    const activeTaxes = configuredTaxes.filter((tax) => tax.status === 'active')
    // Keep previously saved taxes visible while editing if they were later disabled.
    const stored: { name: string; rate: number }[] = details?.taxes?.length
      ? details.taxes.map((t) => ({ name: t.name, rate: t.rate }))
      : details?.taxName
        ? [{ name: details.taxName, rate: details.orderTaxRate || 0 }]
        : []
    const missing = stored.filter((t) => t.name && !activeTaxes.some((tax) => tax.name === t.name))
    if (missing.length) {
      return [...activeTaxes, ...missing.map((t) => ({ ...t, status: 'active' as const }))]
    }
    return activeTaxes
  }, [branchSettings, details, locationBranchId])

  /** Older sales stored only the rate — match it back to a configured tax once. */
  const legacyTaxSeeded = useRef(false)
  useEffect(() => {
    if (legacyTaxSeeded.current || taxSelection.length) return
    const legacyRate = details?.orderTaxRate || 0
    if (legacyRate > 0 && taxOptions.length) {
      legacyTaxSeeded.current = true
      const legacyTax = taxOptions.find((tax) => tax.rate === legacyRate)
      if (legacyTax) setTaxSelection([legacyTax.name])
    }
  }, [details, taxOptions, taxSelection.length])

  /** Keeps the combined taxName and the summed orderTaxRate in sync with the multi-tax selection. */
  useEffect(() => {
    const valid = taxSelection.filter((name) => taxOptions.some((tax) => tax.name === name))
    if (valid.length !== taxSelection.length) setTaxSelection(valid)
    setTaxName(valid.length ? valid.join(' + ') : 'none')
    setOrderTaxRate(sumTaxRates(taxOptions, valid))
  }, [taxSelection, taxOptions])

  const productResults = useMemo(() => {
    const tokens = productSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    return inventory
      .filter((item) => !item.branchId || !locationBranchId || item.branchId === locationBranchId)
      .filter((item) => tokens.every((token) => `${item.name} ${item.sku}`.toLowerCase().includes(token)))
      .slice(0, 7)
  }, [inventory, locationBranchId, productSearch])

  const grossSubtotal = useMemo(() => lines.reduce((sum, line) => sum + Math.max(0, line.quantity) * Math.max(0, line.unitPrice), 0), [lines])
  // ── Company tax & discount policy (Settings → Tax & Discount) ──
  const policy = useMemo(() => resolveTaxDiscountPolicy(app.company), [app.company])

  /** Hidden modes clear the fields; mandatory modes seed the company defaults. */
  useEffect(() => {
    if (!policy.tax.visible) {
      if (taxSelection.length) setTaxSelection([])
      if (taxName !== 'none') setTaxName('none')
      if (orderTaxRate !== 0) setOrderTaxRate(0)
      return
    }
    if (policy.tax.required && taxSelection.length === 0) {
      const preferred = policy.tax.defaultName && taxOptions.find((t) => t.name === policy.tax.defaultName)
      if (preferred) {
        setTaxSelection([preferred.name])
      } else if (policy.tax.defaultRate > 0) {
        setOrderTaxRate(policy.tax.defaultRate)
      }
    }
  }, [policy, taxOptions, taxSelection, taxName, orderTaxRate])

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

  const lineDiscountTotal = useMemo(() => lines.reduce((sum, line) => sum + Math.max(0, line.discount), 0), [lines])
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscountTotal)
  // A Discounts-table selection overrides the manual type/amount inputs and is
  // evaluated with the shared rules engine (min spend, cap, window, limits).
  const lineItemIds = lines.map((l) => l.itemId)
  const productNameById = (id: string) => inventory.find((item) => item.id === id)?.name
  const codeDiscountValue = selectedDiscount ? computeDiscount(selectedDiscount, netSubtotal, lineItemIds) : null
  const codeBlock = selectedDiscount ? discountBlockReason(selectedDiscount, netSubtotal, { itemIds: lineItemIds, productName: productNameById }) : null
  const codeShortfall = selectedDiscount && codeBlock && selectedDiscount.minSpend && netSubtotal < selectedDiscount.minSpend
    ? selectedDiscount.minSpend - netSubtotal
    : 0
  const rawOrderDiscount = codeDiscountValue ?? Math.min(netSubtotal, discountType === 'percentage' ? netSubtotal * Math.max(0, discountAmount) / 100 : Math.max(0, discountAmount))
  // Hidden mode means the feature is not calculated at all.
  const orderDiscount = policy.discount.visible ? rawOrderDiscount : 0
  // Assigned-coupon redemption (POS coupon flow): one coupon per transaction,
  // applied after the order discount and before tax.
  const selectedCouponAssignment = couponAssignments.find((a) => a.id === couponAssignmentId) || null
  const selectedCoupon = selectedCouponAssignment ? coupons.find((c) => c.id === selectedCouponAssignment.couponId) || null : null
  const couponBase = Math.max(0, netSubtotal - orderDiscount)
  const couponBlockNow = selectedCoupon ? couponBlockReason(selectedCoupon, couponBase) : null
  const couponDiscount = selectedCoupon && !couponBlockNow
    ? Math.min(couponBase, selectedCoupon.discountType === 'percentage' ? couponBase * Math.max(0, selectedCoupon.discountValue) / 100 : Math.max(0, selectedCoupon.discountValue))
    : 0
  const taxableSubtotal = Math.max(0, couponBase - couponDiscount)
  /** Per-line taxes in PRODUCT mode: computed on each line's discounted base. */
  const lineTaxes = useMemo(
    () =>
      lines.map((line) => {
        if (taxMode !== 'PRODUCT' || !policy.tax.visible) return []
        const base = Math.max(0, line.quantity * line.unitPrice - Math.max(0, line.discount))
        return computeLineTaxes(base, line.taxNames || [], taxOptions)
      }),
    [lines, taxMode, policy.tax.visible, taxOptions],
  )
  const productTaxTotal = lineTaxes.reduce((sum, list) => sum + lineTaxTotal(list), 0)
  const lineTaxSummary = taxSummary(lineTaxes)
  const orderTax = !policy.tax.visible
    ? 0
    : taxMode === 'PRODUCT'
      ? productTaxTotal
      : taxableSubtotal * Math.max(0, orderTaxRate) / 100
  const expenseTotal = expenses.reduce((sum, expense) => sum + Math.max(0, expense.amount), 0)
  const totalPayable = Math.max(0, taxableSubtotal + orderTax + Math.max(0, shippingCharges) + expenseTotal)
  const changeReturn = Math.max(0, paymentAmount - totalPayable)
  const balance = Math.max(0, totalPayable - paymentAmount)
  const itemCount = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0)

  const couponMemberUserId = members.find((m) => m.id === customerId)?.userId
  /** Coupons assigned to this customer that pass every validity rule right now. */
  const eligibleCoupons = useMemo(() => {
    if (!couponMemberUserId) return []
    const out: { assignment: CouponAssignment; coupon: Coupon }[] = []
    for (const a of couponAssignments) {
      if (a.status !== 'active' || a.targetType !== 'customer' || a.targetId !== couponMemberUserId) continue
      const coupon = coupons.find((c) => c.id === a.couponId)
      if (coupon && !couponBlockReason(coupon, couponBase)) out.push({ assignment: a, coupon })
    }
    return out
  }, [couponAssignments, coupons, couponMemberUserId, couponBase])

  const applyCoupon = (assignmentId: string) => {
    const assignment = couponAssignments.find((a) => a.id === assignmentId)
    const coupon = assignment ? coupons.find((c) => c.id === assignment.couponId) : undefined
    if (!assignment || !coupon) return
    if (assignment.targetType !== 'customer' || assignment.targetId !== couponMemberUserId) {
      toast.error('Coupon not assigned', 'Coupon is not assigned to the selected customer.')
      return
    }
    const reason = couponBlockReason(coupon, couponBase)
    if (reason) { toast.error('Coupon not valid', reason); return }
    setCouponAssignmentId(assignment.id)
    toast.success('Coupon applied', `${coupon.code} — ${couponValueLabel(coupon)}`)
  }

  const updateLine = (index: number, patch: Partial<SaleFormLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const addProduct = (itemId: string) => {
    const item = inventory.find((candidate) => candidate.id === itemId)
    if (!item) return
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.itemId === item.id)
      if (existingIndex >= 0) return current.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line)
      return [...current, { itemId: item.id, quantity: 1, unitPrice: item.sellPrice, discount: 0 }]
    })
    setProductSearch('')
    setShowProductResults(false)
  }

  const selectCustomer = (id: string) => {
    setCustomerId(id)
    setCouponAssignmentId('')
    if (id === 'walk-in') {
      setCustomerName('Walk-in Customer')
      return
    }
    const member = members.find((candidate) => candidate.id === id)
    setCustomerName(users.find((candidate) => candidate.id === member?.userId)?.name || 'Walk-in Customer')
  }

  const addExpense = () => {
    setExpenses((current) => [...current, { id: `expense-${Date.now()}`, name: '', amount: 0 }])
  }

  const updateExpense = (id: string, patch: Partial<ExpenseRow>) => {
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, ...patch } : expense))
  }

  const save = (printAfterSave = false) => {
    if (!hasRole('super_admin', 'gym_manager', 'company_admin', 'branch_admin', 'staff')) {
      toast.error('Permission denied', 'You do not have permission to record a sale.')
      return
    }
    if (!lines.length) {
      toast.error('Add a product', 'Choose at least one product before saving the sale.')
      return
    }
    const invalidQuantity = lines.find((line) => line.quantity <= 0)
    if (invalidQuantity) {
      toast.error('Check quantities', 'Every product line must have a quantity greater than zero.')
      return
    }
    const violation = taxDiscountViolation(policy, { taxName: taxName === 'none' ? '' : taxName, taxRate: orderTaxRate, discountValue: orderDiscount })
    if (violation) {
      setDiscountTaxOpen(true)
      toast.error('Company policy', violation)
      return
    }
    if (selectedCoupon) {
      const couponReason = couponBlockReason(selectedCoupon, couponBase)
      if (couponReason) {
        setDiscountTaxOpen(true)
        toast.error('Coupon not valid', couponReason)
        return
      }
    }
    setSaving(true)
    const selectedBranch = availableBranches.find((branch) => branch.name === businessLocation)
    const saleBranchId = sale?.branchId || selectedBranch?.id || user?.branchId || activeBranchId || undefined
    const saleCompanyId = branches.find((branch) => branch.id === saleBranchId)?.companyId || app.activeCompanyId || undefined
    const input: SaleInput = {
      companyId: saleCompanyId,
      branchId: saleBranchId,
      memberId: customerId === 'walk-in' ? undefined : customerId,
      customerName: customerName.trim() || 'Walk-in Customer',
      lines: lines.map((line, index) => {
        const list = taxMode === 'PRODUCT' ? lineTaxes[index] : undefined
        const { taxNames: _taxNames, ...rest } = line
        return {
          ...rest,
          discount: Math.max(0, line.discount),
          taxes: list?.length ? list : undefined,
          taxTotal: list?.length ? lineTaxTotal(list) : undefined,
        }
      }),
      method: paymentMethod,
      userId: user?.id || 'system',
      date: saleDate,
      total: totalPayable,
      details: {
        businessLocation,
        sellingPriceGroup,
        serviceType,
        subscribed,
        payTerm: payTerm ? numberValue(payTerm) : undefined,
        payTermUnit,
        table,
        serviceStaff,
        invoiceScheme,
        invoiceNumber: invoiceNumber || undefined,
        billingAddress,
        shippingAddress,
        discountType: selectedDiscount ? 'fixed' : discountType,
        discountAmount: selectedDiscount ? (codeDiscountValue ?? 0) : discountAmount,
        discountId: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.id : undefined,
        discountCode: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.code : undefined,
        discountName: selectedDiscount && (codeDiscountValue ?? 0) > 0 ? selectedDiscount.name : undefined,
        couponAssignmentId: selectedCouponAssignment && couponDiscount > 0 ? selectedCouponAssignment.id : undefined,
        couponId: selectedCoupon && couponDiscount > 0 ? selectedCoupon.id : undefined,
        couponCode: selectedCoupon && couponDiscount > 0 ? selectedCoupon.code : undefined,
        couponName: selectedCoupon && couponDiscount > 0 ? selectedCoupon.name : undefined,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        taxMode: taxMode === 'PRODUCT' ? ('PRODUCT' as const) : undefined,
        taxName: taxMode === 'PRODUCT'
          ? (() => {
              const names = distinctTaxNames(lineTaxes)
              return names.length ? names.join(' + ') : undefined
            })()
          : (taxName === 'none' ? undefined : taxName),
        taxes: taxMode === 'PRODUCT'
          ? (() => {
              const names = distinctTaxNames(lineTaxes)
              return names.length
                ? names.map((name) => ({ name, rate: taxOptions.find((t) => t.name === name)?.rate || 0 }))
                : undefined
            })()
          : taxSelection.length
            ? taxSelection.map((name) => ({ name, rate: taxOptions.find((t) => t.name === name)?.rate || 0 }))
            : undefined,
        orderTaxRate: taxMode === 'PRODUCT' ? 0 : orderTaxRate,
        sellNote,
        shippingDetails,
        shippingCharges,
        shippingStatus,
        deliveredTo,
        deliveryPerson,
        attachedDocumentName: attachedDocument || undefined,
        shippingDocumentName: shippingDocument || undefined,
        additionalExpenses: expenses.filter((expense) => expense.name.trim() || expense.amount > 0).map(({ id: _id, ...expense }) => expense),
        payment: {
          amount: Math.max(0, paymentAmount),
          paidOn,
          method: paymentMethod,
          account: paymentAccount,
          note: paymentNote,
        },
      },
    }
    const result = sale ? updateSale(sale.id, input) : recordSale(input)
    setSaving(false)
    if (result.ok && !sale && selectedDiscount && (codeDiscountValue ?? 0) > 0) recordDiscountUsage(selectedDiscount.id)
    if (result.ok && !sale && selectedCoupon && selectedCouponAssignment && couponDiscount > 0) {
      recordCouponRedemption(selectedCoupon.id, selectedCouponAssignment.id)
      log(user?.id || 'system', 'UPDATE', 'Coupons', `Redeemed coupon ${selectedCoupon.code} on sale ${result.sale?.number} — ${formatGhsExact(couponDiscount)} for ${customerName}`)
    }
    if (!result.ok) {
      toast.error(sale ? 'Sale not updated' : 'Sale not recorded', result.error || 'Please check the sale details and try again.')
      return
    }
    log(user?.id || 'system', sale ? 'SALE_EDIT' : 'SALE', 'Sales', `${sale ? 'Updated' : 'Recorded'} sale ${result.sale?.number} — ${formatGhsExact(result.sale?.total || 0)}`)
    toast.success(sale ? 'Sale updated' : 'Sale recorded', `${result.sale?.number || 'Sale'} has been saved.`)
    if (printAfterSave && result.sale) {
      window.setTimeout(() => window.print(), 80)
    }
    onClose()
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Back to sales">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="eyebrow">Sales & billing</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">{isEdit ? 'Edit Sale' : 'Add Sale'}</h1>
            <p className="mt-1 text-sm text-muted">Capture products, fulfilment, payment, and the final amount payable.</p>
          </div>
        </div>
        <div className="w-full sm:max-w-[290px]">
          <Field label={<HelpLabel>Business Location</HelpLabel>} required>
            <Select value={businessLocation} onChange={(event) => setBusinessLocation(event.target.value)}>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <Section title="Sale Details" icon={<ReceiptText className="size-4" />}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label={<HelpLabel>Selling Price Group</HelpLabel>}>
            <Select value={sellingPriceGroup} onChange={(event) => setSellingPriceGroup(event.target.value)}>
              <option value="Default Selling Price">Default Selling Price</option>
              <option value="Member Price">Member Price</option>
              <option value="Wholesale">Wholesale</option>
            </Select>
          </Field>
          <Field label={<HelpLabel>Types of service</HelpLabel>}>
            <Select value={serviceType} onChange={(event) => setServiceType(event.target.value)} placeholder="Please Select">
              <option value="">Please Select</option>
              <option value="Gym membership">Gym membership</option>
              <option value="Personal training">Personal training</option>
              <option value="Merchandise">Merchandise</option>
              <option value="Other service">Other service</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <input type="checkbox" checked={subscribed} onChange={(event) => setSubscribed(event.target.checked)} className="size-4 accent-lime" />
              Subscribe
            </label>
          </div>

          <Field label="Customer" required>
            <Select value={customerId} onChange={(event) => selectCustomer(event.target.value)}>
              <option value="walk-in">Walk-in Customer</option>
              {customerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Customer name">
            <div className="flex gap-2">
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Walk-in Customer" />
              <Button type="button" variant="soft" size="icon" aria-label="Add customer" onClick={() => toast.info('Customer shortcut', 'Choose a customer from the list or enter a name.') }>
                <CirclePlus className="size-4" />
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-[1fr_115px] gap-2">
            <Field label="Pay term">
              <Input value={payTerm} onChange={(event) => setPayTerm(event.target.value)} type="number" min="0" placeholder="Please Select" />
            </Field>
            <Field label="Unit">
              <Select value={payTermUnit} onChange={(event) => setPayTermUnit(event.target.value)}>
                <option value="days">Days</option>
                <option value="months">Months</option>
              </Select>
            </Field>
          </div>

          <Field label="Sale Date" required>
            <DatePicker value={saleDate} onChange={setSaleDate} aria-label="Sale date" />
          </Field>
          <Field label="Billing Address">
            <Input value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} placeholder="Billing address" />
          </Field>
          <Field label="Status">
            <Select value={saleStatus} onChange={(event) => setSaleStatus(event.target.value)} placeholder="Please Select">
              <option value="">Please Select</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>

          <Field label="Invoice Scheme">
            <Select value={invoiceScheme} onChange={(event) => setInvoiceScheme(event.target.value)}>
              <option value="Default">Default</option>
              <option value="Gym POS">Gym POS</option>
            </Select>
          </Field>
          <Field label="Invoice No.">
            <Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto generated" />
          </Field>
          <Field label="Shipping Address">
            <Input value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} placeholder="Shipping address" />
          </Field>

          <Field label="Select Table">
            <Select value={table} onChange={(event) => setTable(event.target.value)} placeholder="Please Select">
              <option value="">Please Select</option>
              <option value="Front desk">Front desk</option>
              <option value="Studio 1">Studio 1</option>
              <option value="Studio 2">Studio 2</option>
            </Select>
          </Field>
          <Field label="Service Staff">
            <Select value={serviceStaff} onChange={(event) => setServiceStaff(event.target.value)} placeholder="Please Select">
              <option value="">Please Select</option>
              {staffOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <UploadField label="Attach Document" icon={<Paperclip className="size-4" />} name={attachedDocument} onChange={setAttachedDocument} />
        </div>
      </Section>

      <Section
        title="Products"
        icon={<ShoppingCart className="size-4" />}
        aside={<span className="text-xs font-semibold text-muted">{itemCount} item{itemCount === 1 ? '' : 's'} · {formatGhsExact(grossSubtotal)}</span>}
      >
        <div className="relative mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <div className="sales-product-search-control">
              <span className="sales-product-search-icon" aria-hidden="true"><Search className="size-5" /></span>
              <Input
                value={productSearch}
                onChange={(event) => { setProductSearch(event.target.value); setShowProductResults(true) }}
                onFocus={() => setShowProductResults(true)}
                onKeyDown={(event) => { if (event.key === 'Enter' && productResults[0]) { event.preventDefault(); addProduct(productResults[0].id) } }}
                className="sales-product-search-input"
                placeholder="Enter product name / SKU / Scan bar code"
                aria-label="Search product by name or SKU"
              />
            </div>
            {showProductResults && productResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-2xl dark:bg-zinc-900">
                {productResults.map((item) => (
                  <button key={item.id} type="button" onClick={() => addProduct(item.id)} className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-lime/10">
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</span><span className="text-xs text-muted">{item.sku} · {item.quantity} {item.unit} in stock</span></span>
                    <span className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatGhsExact(item.sellPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="button" variant="soft" size="icon" onClick={() => productResults[0] && addProduct(productResults[0].id)} disabled={!productResults[0]} aria-label="Add matching product" title="Add matching product">
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-white/[0.035]">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-bold">#</th>
                <th className="min-w-[230px] px-3 py-3 font-bold">Product</th>
                <th className="w-28 px-3 py-3 font-bold">Quantity</th>
                <th className="w-36 px-3 py-3 font-bold">Unit price</th>
                <th className="w-32 px-3 py-3 font-bold">Discount</th>
                {policy.tax.visible && <th className="w-44 px-3 py-3 font-bold">Taxes</th>}
                {showCostCenter && <th className="w-52 px-3 py-3 font-bold">Cost center</th>}
                <th className="w-36 px-3 py-3 text-right font-bold">Subtotal</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.length === 0 && (
                <tr><td colSpan={(showCostCenter ? 8 : 7) + (policy.tax.visible ? 1 : 0)} className="px-4 py-12 text-center"><Package className="mx-auto size-8 text-muted" /><p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No products added</p><p className="mt-1 text-xs text-muted">Search for a product above to start this sale.</p></td></tr>
              )}
              {lines.map((line, index) => {
                const item = inventory.find((candidate) => candidate.id === line.itemId)
                const subtotal = Math.max(0, line.quantity * line.unitPrice - line.discount)
                return (
                  <tr key={`${line.itemId}-${index}`} className="align-middle">
                    <td className="px-3 py-3 text-muted">{index + 1}</td>
                    <td className="px-3 py-3">
                      <Select value={line.itemId} onChange={(event) => {
                        const next = inventory.find((candidate) => candidate.id === event.target.value)
                        updateLine(index, { itemId: event.target.value, unitPrice: next?.sellPrice || line.unitPrice })
                      }}>
                        {inventory.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.sku}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-3"><Input type="number" min="1" max={item?.quantity || undefined} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(0, numberValue(event.target.value)) })} /></td>
                    <td className="px-3 py-3"><Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Math.max(0, numberValue(event.target.value)) })} /></td>
                    <td className="px-3 py-3"><Input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(index, { discount: Math.max(0, numberValue(event.target.value)) })} /></td>
                    {policy.tax.visible && (
                      <td className="px-3 py-3">
                        <TaxLineCell
                          taxes={taxOptions}
                          selected={taxMode === 'PRODUCT' ? line.taxNames || [] : taxSelection}
                          onChange={(names) => {
                            if (taxMode === 'GLOBAL') {
                              // Inline edit in All-products mode switches to Per-product: seed every
                              // other line with the global selection, then apply this line's choice.
                              setTaxMode('PRODUCT')
                              setLines((cur) => cur.map((row, i2) => ({
                                ...row,
                                taxNames: i2 === index ? names : row.taxNames?.length ? row.taxNames : [...taxSelection],
                              })))
                            } else {
                              updateLine(index, { taxNames: names })
                            }
                          }}
                          lineTaxes={taxMode === 'PRODUCT' ? lineTaxes[index] : computeLineTaxes(subtotal, taxSelection, taxOptions)}
                          itemName={item?.name}
                        />
                      </td>
                    )}
                    {showCostCenter && <td className="px-3 py-3"><CostCenterSelect value={line.costCenterId} onChange={(id) => updateLine(index, { costCenterId: id || undefined })} /></td>}
                    <td className="px-3 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">{formatGhsExact(subtotal + lineTaxTotal(taxMode === 'PRODUCT' ? lineTaxes[index] : undefined))}</td>
                    <td className="px-3 py-3 text-right"><button type="button" className="rounded-lg p-2 text-muted transition hover:bg-ember/10 hover:text-ember" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove ${item?.name || 'product'}`}><Trash2 className="size-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-line bg-zinc-50 dark:bg-white/[0.025]">
              <tr><td colSpan={5 + (policy.tax.visible ? 1 : 0)} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted">Items total</td>{showCostCenter && <td />}<td className="px-3 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">{formatGhsExact(grossSubtotal + (taxMode === 'PRODUCT' && policy.tax.visible ? productTaxTotal : 0))}</td><td /></tr>
            </tfoot>
          </table>
        </div>

      </Section>

      {customerId !== 'walk-in' && (
        <div className="mb-4 rounded-lg border border-zinc-500/25 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Available Coupons</p>
          {eligibleCoupons.length ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {eligibleCoupons.map(({ assignment, coupon }) => {
                const active = couponAssignmentId === assignment.id
                return (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => applyCoupon(assignment.id)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left text-sm transition',
                      active ? 'border-lime bg-lime/10' : 'border-zinc-500/25 hover:border-zinc-400',
                    )}
                  >
                    <span className="font-mono font-bold">{coupon.code}</span>
                    <span className="text-muted">
                      {' | '}
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% Off` : `${formatGhsExact(coupon.discountValue)} Discount`}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Expires: {coupon.validTo ? formatDate(coupon.validTo) : 'no end date'}
                      {(coupon.minPurchase || 0) > 0 ? ` · Min spend ${formatGhsExact(coupon.minPurchase || 0)}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">No eligible coupons for this customer right now.</p>
          )}
          {selectedCoupon && couponDiscount > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-emerald-500">{selectedCoupon.code} applied — −{formatGhsExact(couponDiscount)}</span>
              <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setCouponAssignmentId('')}>Remove coupon</button>
            </div>
          )}
          {selectedCoupon && couponBlockNow && (
            <p className="mt-2 text-[11px] font-medium text-amber-500">{couponBlockNow}</p>
          )}
        </div>
      )}

      {(policy.discount.visible || policy.tax.visible) && (
      <Section
        title={policy.discount.visible && policy.tax.visible ? 'Discount & Tax' : policy.discount.visible ? 'Discount' : 'Tax'}
        icon={<Percent className="size-4" />}
        aside={(() => {
          // One chip when both features share a status; two only when they differ.
          const chips: { key: string; name: string; label: string; strong: boolean }[] = []
          if (policy.discount.visible) chips.push({ key: 'discount', name: 'Discount', label: policy.discount.label, strong: policy.discount.required })
          if (policy.tax.visible) chips.push({ key: 'tax', name: 'Tax', label: policy.tax.label, strong: policy.tax.required })
          const identical = chips.length === 2 && chips[0].label === chips[1].label
          const shown = identical ? [chips[0]] : chips
          return (
            <span className="flex items-center gap-1">
              {shown.map((chip) => (
                <span
                  key={chip.key}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    chip.strong ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-zinc-500/15 text-muted',
                  )}
                >
                  {!identical && chips.length === 2 ? `${chip.name}: ${chip.label}` : chip.label}
                </span>
              ))}
            </span>
          )
        })()}
        collapsible
        open={discountTaxOpen}
        onToggle={() => setDiscountTaxOpen((current) => !current)}
      >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="self-end pb-2 text-[11px] leading-snug sm:col-span-1">
                {codeBlock ? (
                  <span className="font-medium text-amber-500">
                    <span className="font-semibold">{selectedDiscount.name}</span> not applied — {codeBlock}.
                  </span>
                ) : (
                  <span className="font-medium text-emerald-500">
                    <span className="font-semibold">{selectedDiscount.name}</span> ({selectedDiscount.code}) applies −{formatGhsExact(codeDiscountValue ?? 0)}
                  </span>
                )}
              </div>
            ) : (
              <div className="self-end pb-2 text-[11px] text-muted sm:col-span-1">Pick a code from the Discounts table or set a manual amount.</div>
            )}
            <Field label="Discount type">
              <Select value={discountType} disabled={!!selectedDiscount || !policy.discount.editable} onChange={(event) => setDiscountType(event.target.value as SaleDiscountType)}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
              <Input type="number" min="0" step="0.01" disabled={!!selectedDiscount || !policy.discount.editable} value={discountAmount} onChange={(event) => setDiscountAmount(Math.max(0, numberValue(event.target.value)))} />
            </Field>
            </>
            )}
            {policy.tax.visible && (
            <>
            <div>
              <p className="mb-1 text-xs font-semibold text-mist">Tax application mode</p>
              <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Tax application mode">
                <button type="button" role="radio" aria-checked={taxMode === 'GLOBAL'} onClick={() => setTaxMode('GLOBAL')} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition', taxMode === 'GLOBAL' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-ink')}>
                  All products
                </button>
                <button type="button" role="radio" aria-checked={taxMode === 'PRODUCT'} onClick={() => setTaxMode('PRODUCT')} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition', taxMode === 'PRODUCT' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-ink')}>
                  Per product
                </button>
              </div>
            </div>
            {taxMode === 'GLOBAL' && (
            <>
            <Field label="Tax name">
              <TaxMultiSelect
                taxes={taxOptions}
                selected={taxSelection}
                onChange={setTaxSelection}
                disabled={!policy.tax.editable}
                allowNone={!policy.tax.required}
                ariaLabel="Tax name"
              />
            </Field>
            <Field label="Tax rate (%)">
              <Input value={`${orderTaxRate}%`} readOnly aria-label="Associated tax rate" />
            </Field>
            </>
            )}
            </>
            )}
            <div className="rounded-xl border border-line bg-zinc-50 p-3 dark:bg-white/[0.025]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted">Order summary</p>
                <span className="text-[11px] font-medium text-muted">Applied amounts</span>
              </div>
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 text-muted">Line discount</span><span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatGhsExact(lineDiscountTotal)}</span></div>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 text-muted">Order discount{selectedDiscount ? ` — ${selectedDiscount.name}` : ''}</span><span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatGhsExact(orderDiscount)}</span></div>
                {selectedCoupon && couponDiscount > 0 && (
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 text-muted">Coupon — {selectedCoupon.code}</span><span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">−{formatGhsExact(couponDiscount)}</span></div>
                )}
                {taxMode === 'PRODUCT' && policy.tax.visible && lineTaxSummary.rows.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-line bg-zinc-50 p-2 dark:bg-white/[0.025]">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Tax summary</p>
                    {lineTaxSummary.rows.map((row) => (
                      <div key={row.name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 text-muted">{row.name} {row.rate}%</span>
                        <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatGhsExact(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 text-muted">{taxMode === 'PRODUCT' && policy.tax.visible ? 'Total tax' : 'Order tax'}</span><span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatGhsExact(orderTax)}</span></div>
              </div>
            </div>
          </div>
          {selectedDiscount && codeBlock && (
            <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs leading-snug text-amber-700 dark:text-amber-300 sm:col-span-2 lg:col-span-4">
              <p className="font-bold">{selectedDiscount.name} ({selectedDiscount.code}) is not applied to this sale.</p>
              <p className="mt-0.5">
                {codeBlock.charAt(0).toUpperCase() + codeBlock.slice(1)}.
                {codeShortfall > 0 && <span> Add {formatGhsExact(codeShortfall)} more to the sale to use it.</span>}
                <span> Pick “Manual discount” to enter a custom amount instead.</span>
              </p>
            </div>
          )}
          <div className="mt-4">
            <Field label="Sell note"><textarea className="field min-h-[42px] resize py-2" value={sellNote} onChange={(event) => setSellNote(event.target.value)} placeholder="Internal note for this sale" /></Field>
          </div>
      </Section>
      )}

      {/* Tax and discount are both disabled company-wide — keep the sell note reachable. */}
      {!policy.discount.visible && !policy.tax.visible && (
        <Section title="Sell note" icon={<Percent className="size-4" />} collapsible open={discountTaxOpen} onToggle={() => setDiscountTaxOpen((current) => !current)}>
          <Field label="Sell note"><textarea className="field min-h-[42px] resize py-2" value={sellNote} onChange={(event) => setSellNote(event.target.value)} placeholder="Internal note for this sale" /></Field>
        </Section>
      )}

      <Section
        title="Shipping & Additional Expenses"
        icon={<Truck className="size-4" />}
        aside={<span className="text-xs font-semibold text-muted">Optional</span>}
        collapsible
        open={shippingExpensesOpen}
        onToggle={() => setShippingExpensesOpen((current) => !current)}
      >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Shipping details"><textarea className="field min-h-[42px] resize py-2" value={shippingDetails} onChange={(event) => setShippingDetails(event.target.value)} placeholder="Shipping Details" /></Field>
            <Field label="Shipping charges"><Input type="number" min="0" step="0.01" value={shippingCharges} onChange={(event) => setShippingCharges(Math.max(0, numberValue(event.target.value)))} /></Field>
            <Field label="Shipping status">
              <Select value={shippingStatus} onChange={(event) => setShippingStatus(event.target.value)} placeholder="Please Select">
                <option value="">Please Select</option><option value="pending">Pending</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
              </Select>
            </Field>
            <Field label="Delivered to"><Input value={deliveredTo} onChange={(event) => setDeliveredTo(event.target.value)} placeholder="Delivered To" /></Field>
            <Field label="Delivery person">
              <Select value={deliveryPerson} onChange={(event) => setDeliveryPerson(event.target.value)} placeholder="Please Select">
                <option value="">Please Select</option>
                {staffOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <UploadField label="Shipping document" icon={<FileUp className="size-4" />} name={shippingDocument} onChange={setShippingDocument} />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Additional expenses</p><p className="mt-0.5 text-xs text-muted">Add delivery, handling, or other sale-related costs.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={addExpense}><Plus className="size-3.5" /> Add expense</Button>
            </div>
            {expenses.length > 0 && <div className="mt-3 space-y-2">
              {expenses.map((expense) => <div key={expense.id} className="flex flex-col gap-2 sm:flex-row">
                <Input value={expense.name} onChange={(event) => updateExpense(expense.id, { name: event.target.value })} placeholder="Expense name" />
                <Input type="number" min="0" step="0.01" value={expense.amount} onChange={(event) => updateExpense(expense.id, { amount: Math.max(0, numberValue(event.target.value)) })} className="sm:max-w-[180px]" />
                <button type="button" className="self-center rounded-lg p-2 text-muted hover:bg-ember/10 hover:text-ember" onClick={() => setExpenses((current) => current.filter((item) => item.id !== expense.id))} aria-label="Remove expense"><X className="size-4" /></button>
              </div>)}
            </div>}
          </div>
      </Section>

      <Section title="Total Payable" icon={<WalletCards className="size-4" />}>
        <div className={`grid gap-3 sm:grid-cols-2 ${selectedCoupon && couponDiscount > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
          <SummaryCard label="Items" value={String(itemCount)} />
          <SummaryCard label="Subtotal" value={formatGhsExact(grossSubtotal)} />
          <SummaryCard label="Discounts" value={formatGhsExact(lineDiscountTotal + orderDiscount)} />
          {selectedCoupon && couponDiscount > 0 && (
            <SummaryCard label={`Coupon — ${selectedCoupon.code}`} value={`−${formatGhsExact(couponDiscount)}`} tone="green" />
          )}
          <SummaryCard label="Tax + shipping" value={formatGhsExact(orderTax + shippingCharges + expenseTotal)} />
          <SummaryCard label="Total payable" value={formatGhsExact(totalPayable)} emphasis />
        </div>
      </Section>

      <Section title="Payment Details" icon={<CreditCardIcon />}>
        <p className="mb-4 text-sm text-muted">Advance balance: <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatGhsExact(0)}</span></p>
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Amount"><Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(Math.max(0, numberValue(event.target.value)))} /></Field>
          <Field label="Paid on"><Input type="datetime-local" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} /></Field>
          <Field label="Payment method">
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </Select>
          </Field>
          <Field label="Payment account">
            <Select value={paymentAccount} onChange={(event) => setPaymentAccount(event.target.value)}>
              <option value="none">None</option>
              {accounts.slice(0, 10).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4"><Field label="Payment note"><textarea className="field min-h-[42px] resize py-2" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Payment reference or note" /></Field></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SummaryCard label="Change return" value={formatGhsExact(changeReturn)} tone="green" />
          <SummaryCard label="Balance" value={formatGhsExact(balance)} tone={balance > 0 ? 'amber' : 'green'} />
        </div>
      </Section>

      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="outline" onClick={() => save(true)} disabled={saving}>
          <PrinterIcon /> Save & print
        </Button>
        <Button type="button" onClick={() => save(false)} disabled={saving}>
          {saving ? <span className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : <Save className="size-4" />}
          {isEdit ? 'Update sale' : 'Save sale'}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, emphasis, tone }: { label: string; value: string; emphasis?: boolean; tone?: 'green' | 'amber' }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? 'border-lime/60 bg-lime/10' : 'border-line bg-zinc-50 dark:bg-white/[0.025]'}`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p>
    </div>
  )
}

function CreditCardIcon() {
  return <WalletCards className="size-4" />
}

function PrinterIcon() {
  return <span className="grid size-4 place-items-center rounded border border-current text-[9px] font-black">P</span>
}
