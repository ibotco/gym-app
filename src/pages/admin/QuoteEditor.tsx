import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  FileText,
  Info,
  Package,
  Percent,
  Plus,
  Search,
  ShoppingCart,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button, DatePicker, Field, Input, Select, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cn, formatGhsExact } from '../../lib/utils'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { visibleBranches } from '../../lib/accessScope'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel } from '../../lib/discounts'
import { resolveTaxDiscountPolicy, taxDiscountViolation } from '../../lib/taxDiscountPolicy'
import { DOC_STATUSES, ORDER_STATUSES } from '../../lib/quotes'
import type { Estimate, InvoiceItem, Proposal, SaleDiscountType, SalesOrder } from '../../types'

/** Which document the editor is working on. All three share the same shape. */
export type QuoteKind = 'estimate' | 'proposal' | 'salesorder'

/** Estimate, Proposal and SalesOrder are structurally alike, so one editor serves all. */
export type QuoteDoc = Estimate | Proposal | SalesOrder

/**
 * Per-document copy and behaviour. Sales orders differ only in their status
 * set and in naming their second date 'expectedDate' rather than 'validUntil'.
 */
const KIND_COPY: Record<QuoteKind, {
  label: string
  lower: string
  idPrefix: string
  statuses: string[]
  secondDateLabel: string
  secondDateKey: 'validUntil' | 'expectedDate'
}> = {
  estimate: {
    label: 'Estimate', lower: 'estimate', idPrefix: 'es',
    statuses: DOC_STATUSES as string[], secondDateLabel: 'Valid until', secondDateKey: 'validUntil',
  },
  proposal: {
    label: 'Proposal', lower: 'proposal', idPrefix: 'pp',
    statuses: DOC_STATUSES as string[], secondDateLabel: 'Valid until', secondDateKey: 'validUntil',
  },
  salesorder: {
    label: 'Sales order', lower: 'sales order', idPrefix: 'so',
    statuses: ORDER_STATUSES as string[], secondDateLabel: 'Expected date', secondDateKey: 'expectedDate',
  },
}

/** The second date is stored under a different key per document type. */
export const secondDateOf = (doc?: QuoteDoc) =>
  (doc && ('expectedDate' in doc ? doc.expectedDate : (doc as Estimate | Proposal).validUntil)) || ''

/**
 * A working line in the quote editor. `itemId` is empty for free-text lines so
 * estimates and proposals can still quote services that are not stocked.
 */
export type QuoteLine = {
  itemId: string
  desc: string
  quantity: number
  unitPrice: number
  discount: number
}

export const numberValue = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Collapsible titled panel, mirroring the Add/Edit Sale editor's sections. */
export function Section({
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

export interface QuoteEditorProps {
  /** Which document type this editor is producing. */
  kind: QuoteKind
  /** The document being edited, or undefined when creating a new one. */
  doc?: QuoteDoc
  /** Suggested number for a new document. */
  suggestedNumber: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * Add / Edit Estimate or Proposal, built on the same sectioned layout as
 * Add/Edit Sale: inventory-backed product search, per-line discounts and order
 * tax/discount. There is deliberately no payment section — both are quotations.
 */
export function QuoteEditor({ kind, doc, suggestedNumber, onSaved, onCancel }: QuoteEditorProps) {
  const app = useApp()
  const { inventory, members, users, branches, branchSettings, upsertEstimate, upsertProposal, upsertSalesOrder, log } = app
  const copy = KIND_COPY[kind]
  const upsert = kind === 'proposal' ? upsertProposal : kind === 'salesorder' ? upsertSalesOrder : upsertEstimate
  const { user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(doc)

  const availableBranches = useMemo(
    () => visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive'),
    [app.activeCompanyId, branches, user],
  )

  const [number, setNumber] = useState(doc?.number || suggestedNumber)
  const [status, setStatus] = useState<string>(doc?.status || 'draft')
  const [businessLocation, setBusinessLocation] = useState(
    doc?.businessLocation
      || availableBranches.find((b) => b.id === app.activeBranchId)?.name
      || availableBranches[0]?.name
      || '',
  )
  const [customerType, setCustomerType] = useState<'member' | 'walkin'>(doc?.memberId ? 'member' : 'walkin')
  const [memberId, setMemberId] = useState(doc?.memberId || '')
  const [customerName, setCustomerName] = useState(doc?.customerName || '')
  const [date, setDate] = useState(doc?.date || new Date().toISOString().slice(0, 10))
  const [secondDate, setSecondDate] = useState(() => secondDateOf(doc))
  const [notes, setNotes] = useState(doc?.notes || '')

  const [productSearch, setProductSearch] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [lines, setLines] = useState<QuoteLine[]>(() =>
    (doc?.items || []).map((item) => ({
      itemId: item.itemId || '',
      desc: item.desc,
      quantity: item.qty ?? 1,
      unitPrice: item.unitPrice ?? item.amount,
      discount: item.discount || 0,
    })),
  )

  const [discountType, setDiscountType] = useState<SaleDiscountType>(doc?.discountType || 'percentage')
  const [discountAmount, setDiscountAmount] = useState(doc?.discountAmount || 0)
  const [discountId, setDiscountId] = useState(doc?.discountId || '')
  const [tableDiscounts, setTableDiscounts] = useState(() => activeDiscounts())
  const [taxName, setTaxName] = useState(doc?.taxName || 'none')
  const [taxRate, setTaxRate] = useState(doc?.taxRate || 0)
  const [saving, setSaving] = useState(false)

  // Open the drawer when the record already carries values, so nothing is hidden.
  const [discountTaxOpen, setDiscountTaxOpen] = useState(() => Boolean(
    doc?.discountAmount || doc?.discountId || doc?.taxName || doc?.taxRate
    || doc?.items?.some((item) => (item.discount || 0) > 0),
  ))

  useEffect(() => {
    if (discountTaxOpen) setTableDiscounts(activeDiscounts())
  }, [discountTaxOpen])

  const policy = useMemo(() => resolveTaxDiscountPolicy(app.company), [app.company])
  const selectedDiscount = tableDiscounts.find((d) => d.id === discountId) || null

  const locationBranchId = availableBranches.find((b) => b.name === businessLocation)?.id
    || doc?.branchId || user?.branchId || app.activeBranchId

  const locations = useMemo(() => {
    const names = availableBranches.map((b) => b.name.trim()).filter(Boolean)
    // Keep a saved location visible while editing even if its branch was removed.
    if (businessLocation && !names.includes(businessLocation)) return [businessLocation, ...names]
    return names
  }, [availableBranches, businessLocation])

  const taxOptions = useMemo(() => {
    const settings = branchSettingsFor(branchSettings, locationBranchId)
    const configured = settings?.taxRates?.length ? settings.taxRates : DEFAULT_BRANCH_TAXES
    const active = configured.filter((tax) => tax.status === 'active')
    // Keep a previously saved tax visible if it was later disabled.
    if (doc?.taxName && !active.some((tax) => tax.name === doc.taxName)) {
      return [...active, { name: doc.taxName, rate: doc.taxRate || 0, status: 'active' as const }]
    }
    return active
  }, [branchSettings, doc, locationBranchId])

  // Keep the rate in step with the chosen tax name.
  useEffect(() => {
    if (taxName === 'none') {
      if (taxRate !== 0) setTaxRate(0)
      return
    }
    const selected = taxOptions.find((tax) => tax.name === taxName)
    if (!selected) {
      setTaxName('none')
      setTaxRate(0)
      return
    }
    if (selected.rate !== taxRate) setTaxRate(selected.rate)
  }, [taxName, taxOptions, taxRate])

  /** Hidden modes clear the fields; mandatory modes seed the company defaults. */
  useEffect(() => {
    if (!policy.tax.visible) {
      if (taxName !== 'none') setTaxName('none')
      if (taxRate !== 0) setTaxRate(0)
      return
    }
    if (policy.tax.required && taxName === 'none') {
      const preferred = policy.tax.defaultName && taxOptions.find((t) => t.name === policy.tax.defaultName)
      if (preferred) {
        setTaxName(preferred.name)
        setTaxRate(preferred.rate)
      } else if (policy.tax.defaultRate > 0) {
        setTaxRate(policy.tax.defaultRate)
      }
    }
  }, [policy, taxOptions, taxName, taxRate])

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

  const productResults = useMemo(() => {
    const tokens = productSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return []
    return inventory
      .filter((item) => !item.branchId || !locationBranchId || item.branchId === locationBranchId)
      .filter((item) => tokens.every((token) => `${item.name} ${item.sku}`.toLowerCase().includes(token)))
      .slice(0, 7)
  }, [inventory, locationBranchId, productSearch])

  // ── Totals: line discounts, then order discount, then tax on the net. ──
  const grossSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Math.max(0, line.quantity) * Math.max(0, line.unitPrice), 0),
    [lines],
  )
  const lineDiscountTotal = useMemo(() => lines.reduce((sum, line) => sum + Math.max(0, line.discount), 0), [lines])
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscountTotal)

  const lineItemIds = lines.map((l) => l.itemId).filter(Boolean)
  const productNameById = (id: string) => inventory.find((item) => item.id === id)?.name
  const codeDiscountValue = selectedDiscount ? computeDiscount(selectedDiscount, netSubtotal, lineItemIds) : null
  const codeBlock = selectedDiscount
    ? discountBlockReason(selectedDiscount, netSubtotal, { itemIds: lineItemIds, productName: productNameById })
    : null
  const codeShortfall = selectedDiscount && codeBlock && selectedDiscount.minSpend && netSubtotal < selectedDiscount.minSpend
    ? selectedDiscount.minSpend - netSubtotal
    : 0

  const rawOrderDiscount = codeDiscountValue ?? Math.min(
    netSubtotal,
    discountType === 'percentage' ? netSubtotal * Math.max(0, discountAmount) / 100 : Math.max(0, discountAmount),
  )
  const orderDiscount = policy.discount.visible ? rawOrderDiscount : 0
  const taxableSubtotal = Math.max(0, netSubtotal - orderDiscount)
  const taxAmount = policy.tax.visible ? taxableSubtotal * Math.max(0, taxRate) / 100 : 0
  const total = Math.max(0, taxableSubtotal + taxAmount)
  const itemCount = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0)

  const updateLine = (index: number, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addProduct = (itemId: string) => {
    const item = inventory.find((candidate) => candidate.id === itemId)
    if (!item) return
    setLines((current) => {
      const existing = current.findIndex((line) => line.itemId === item.id)
      if (existing >= 0) return current.map((line, i) => (i === existing ? { ...line, quantity: line.quantity + 1 } : line))
      return [...current, { itemId: item.id, desc: item.name, quantity: 1, unitPrice: item.sellPrice, discount: 0 }]
    })
    setProductSearch('')
    setShowProductResults(false)
  }

  /** Estimates often quote unstocked services, so free-text lines stay supported. */
  const addCustomLine = () => {
    setLines((current) => [...current, { itemId: '', desc: '', quantity: 1, unitPrice: 0, discount: 0 }])
  }

  const save = () => {
    if (!number.trim()) { toast.error(`${copy.label} number is required.`); return }
    const items: InvoiceItem[] = lines
      .map((line) => {
        const desc = line.desc.trim() || (line.itemId ? productNameById(line.itemId) || '' : '')
        if (!desc) return null
        const qty = Math.max(0, line.quantity)
        const unit = Math.max(0, line.unitPrice)
        const discount = Math.max(0, line.discount)
        return {
          desc,
          qty,
          unitPrice: unit,
          amount: Math.max(0, qty * unit - discount),
          ...(line.itemId ? { itemId: line.itemId } : {}),
          ...(discount ? { discount } : {}),
        } as InvoiceItem
      })
      .filter((l): l is InvoiceItem => l != null)

    if (!items.length) { toast.error('Add at least one line with a description.'); return }
    if (lines.some((line) => line.quantity <= 0)) { toast.error('Check quantities', 'Every line needs a quantity greater than zero.'); return }

    const violation = taxDiscountViolation(policy, {
      taxName: taxName === 'none' ? '' : taxName,
      taxRate,
      discountValue: orderDiscount,
    })
    if (violation) {
      setDiscountTaxOpen(true)
      toast.error('Company policy', violation)
      return
    }

    setSaving(true)
    const branchId = locationBranchId || undefined
    const rec: QuoteDoc = {
      id: doc?.id || `${copy.idPrefix}_${Math.random().toString(36).slice(2, 10)}`,
      number: number.trim(),
      memberId: customerType === 'member' ? memberId || undefined : undefined,
      customerName: customerType === 'walkin' ? customerName.trim() || 'Walk-in customer' : undefined,
      items,
      total,
      status: status as QuoteDoc['status'],
      notes: notes.trim() || undefined,
      date,
      ...(copy.secondDateKey === 'expectedDate'
        ? { expectedDate: secondDate || undefined }
        : { validUntil: secondDate || undefined }),
      createdAt: doc?.createdAt || new Date().toISOString(),
      branchId,
      businessLocation: businessLocation || undefined,
      subtotal: netSubtotal,
      discountType: orderDiscount ? discountType : undefined,
      discountAmount: orderDiscount ? discountAmount : undefined,
      discountId: selectedDiscount?.id,
      discountCode: selectedDiscount?.code,
      discountName: selectedDiscount?.name,
      discountValue: orderDiscount || undefined,
      taxName: taxName === 'none' ? undefined : taxName,
      taxRate: taxRate || undefined,
      taxAmount: taxAmount || undefined,
    }
    upsert(rec as never)
    log(user?.id || 'system', isEdit ? 'UPDATE' : 'CREATE', copy.label, `${isEdit ? 'Updated' : 'Created'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isEdit ? `${copy.label} updated` : `${copy.label} created`, rec.number)
    setSaving(false)
    onSaved()
  }

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: users.find((u) => u.id === m.userId)?.name || m.id })),
    [members, users],
  )

  return (
    <div className="space-y-4">
      {/* ── Document details ── */}
      <Section title={`${copy.label} details`} icon={<FileText className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={`${copy.label} number`} required>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {copy.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Business location">
            <Select value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)}>
              {!locations.length && <option value="">No branch available</option>}
              {locations.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <DatePicker value={date} onChange={setDate} />
          </Field>
          <Field label={`${copy.secondDateLabel} (optional)`}>
            <DatePicker value={secondDate} onChange={setSecondDate} />
          </Field>
        </div>
      </Section>

      {/* ── Customer ── */}
      <Section title="Customer" icon={<UserRound className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer type">
            <Select value={customerType} onChange={(e) => setCustomerType(e.target.value as 'member' | 'walkin')}>
              <option value="walkin">Walk-in customer</option>
              <option value="member">Member</option>
            </Select>
          </Field>
          {customerType === 'member' ? (
            <Field label="Member">
              <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Select member…</option>
                {memberOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Customer name">
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
            </Field>
          )}
        </div>
      </Section>

      {/* ── Products ── */}
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
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                      <span className="text-xs text-muted">{item.sku} · {item.quantity} {item.unit} in stock</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatGhsExact(item.sellPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="button" variant="soft" size="icon" onClick={() => productResults[0] && addProduct(productResults[0].id)} disabled={!productResults[0]} aria-label="Add matching product" title="Add matching product">
            <Plus className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={addCustomLine} title="Add a line that is not stocked inventory">
            <Plus className="size-4" /> Custom line
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-white/[0.035]">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-bold">#</th>
                <th className="min-w-[240px] px-3 py-3 font-bold">Item</th>
                <th className="w-28 px-3 py-3 font-bold">Quantity</th>
                <th className="w-36 px-3 py-3 font-bold">Unit price</th>
                {policy.discount.visible && <th className="w-32 px-3 py-3 font-bold">Discount</th>}
                <th className="w-36 px-3 py-3 text-right font-bold">Subtotal</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={policy.discount.visible ? 7 : 6} className="px-4 py-12 text-center">
                    <Package className="mx-auto size-8 text-muted" />
                    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No items added</p>
                    <p className="mt-1 text-xs text-muted">Search for a product above, or add a custom line for a service.</p>
                  </td>
                </tr>
              )}
              {lines.map((line, index) => {
                const item = line.itemId ? inventory.find((c) => c.id === line.itemId) : undefined
                const subtotal = Math.max(0, line.quantity * line.unitPrice - line.discount)
                return (
                  <tr key={`${line.itemId || 'custom'}-${index}`} className="align-middle">
                    <td className="px-3 py-3 text-muted">{index + 1}</td>
                    <td className="px-3 py-3">
                      {line.itemId ? (
                        <div>
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item?.name || line.desc}</p>
                          {item && <p className="text-xs text-muted">{item.sku}</p>}
                        </div>
                      ) : (
                        <Input
                          value={line.desc}
                          placeholder="Item or service description"
                          aria-label="Line description"
                          onChange={(e) => updateLine(index, { desc: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Input type="number" min="1" aria-label="Quantity" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Math.max(0, numberValue(e.target.value)) })} />
                    </td>
                    <td className="px-3 py-3">
                      <Input type="number" min="0" step="0.01" aria-label="Unit price" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: Math.max(0, numberValue(e.target.value)) })} />
                    </td>
                    {policy.discount.visible && (
                      <td className="px-3 py-3">
                        <Input type="number" min="0" step="0.01" aria-label="Line discount" value={line.discount} onChange={(e) => updateLine(index, { discount: Math.max(0, numberValue(e.target.value)) })} />
                      </td>
                    )}
                    <td className="px-3 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">{formatGhsExact(subtotal)}</td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" className="rounded-lg p-2 text-muted transition hover:bg-ember/10 hover:text-ember" onClick={() => setLines((c) => c.filter((_, i) => i !== index))} aria-label={`Remove ${item?.name || line.desc || 'line'}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-line bg-zinc-50 dark:bg-white/[0.025]">
              <tr>
                <td colSpan={policy.discount.visible ? 5 : 4} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted">Items total</td>
                <td className="px-3 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">{formatGhsExact(grossSubtotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      {/* ── Discount & Tax (respects company policy) ── */}
      {(policy.discount.visible || policy.tax.visible) && (
        <Section
          title={policy.discount.visible && policy.tax.visible ? 'Discount & Tax' : policy.discount.visible ? 'Discount' : 'Tax'}
          icon={<Percent className="size-4" />}
          collapsible
          open={discountTaxOpen}
          onToggle={() => setDiscountTaxOpen((v) => !v)}
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
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {policy.discount.visible && (
              <>
                <Field label="Discount code (optional)">
                  <Select value={discountId} onChange={(e) => setDiscountId(e.target.value)} disabled={!policy.discount.editable}>
                    <option value="">No code — enter manually</option>
                    {tableDiscounts.map((d) => <option key={d.id} value={d.id}>{discountLabel(d)}</option>)}
                  </Select>
                </Field>
                <Field label="Discount type">
                  <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as SaleDiscountType)} disabled={Boolean(selectedDiscount) || !policy.discount.editable}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </Select>
                </Field>
                <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    disabled={Boolean(selectedDiscount) || !policy.discount.editable}
                    onChange={(e) => setDiscountAmount(Math.max(0, numberValue(e.target.value)))}
                  />
                </Field>
              </>
            )}
            {policy.tax.visible && (
              <Field label="Order tax">
                <Select value={taxName} onChange={(e) => setTaxName(e.target.value)} disabled={!policy.tax.editable}>
                  {!policy.tax.required && <option value="none">None</option>}
                  {taxOptions.map((tax) => <option key={tax.name} value={tax.name}>{tax.name} ({tax.rate}%)</option>)}
                </Select>
              </Field>
            )}
          </div>

          {selectedDiscount && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {codeBlock
                ? <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {selectedDiscount.code} was not applied because {codeBlock}
                    {codeShortfall > 0 ? ` (${formatGhsExact(codeShortfall)} short).` : '.'}
                  </span>
                : <span>{selectedDiscount.code} applied — {formatGhsExact(orderDiscount)} off. The code overrides the manual amount.</span>}
            </p>
          )}
        </Section>
      )}

      {/* ── Notes & totals ── */}
      <Section title="Notes & total" icon={<FileText className="size-4" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Terms, assumptions or anything the customer should know." />
          </Field>
          <div className="rounded-xl border border-line bg-zinc-50 p-4 text-sm dark:bg-white/[0.025]">
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-muted">Items subtotal</dt><dd className="font-semibold">{formatGhsExact(grossSubtotal)}</dd></div>
              {lineDiscountTotal > 0 && (
                <div className="flex justify-between"><dt className="text-muted">Line discounts</dt><dd className="font-semibold text-ember">− {formatGhsExact(lineDiscountTotal)}</dd></div>
              )}
              {orderDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Order discount{selectedDiscount ? ` (${selectedDiscount.code})` : ''}</dt>
                  <dd className="font-semibold text-ember">− {formatGhsExact(orderDiscount)}</dd>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between"><dt className="text-muted">{taxName} ({taxRate}%)</dt><dd className="font-semibold">+ {formatGhsExact(taxAmount)}</dd></div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-display font-black text-zinc-900 dark:text-zinc-100">{formatGhsExact(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" /> {isEdit ? `Save ${copy.lower}` : `Add ${copy.label}`}
        </Button>
      </div>
    </div>
  )
}
