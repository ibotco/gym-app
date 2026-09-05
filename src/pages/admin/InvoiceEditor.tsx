import { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  Info,
  Package,
  Percent,
  Plus,
  Receipt,
  Repeat,
  Search,
  ShoppingCart,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button, DatePicker, Field, Input, Modal, Select, Switch, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cn, formatDate, formatGhsExact, uid } from '../../lib/utils'
import { RECUR_FREQUENCIES, addFrequency } from '../../lib/recurringInvoices'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { visibleBranches } from '../../lib/accessScope'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel } from '../../lib/discounts'
import { resolveTaxDiscountPolicy, taxDiscountViolation } from '../../lib/taxDiscountPolicy'
import { nextInvoiceNumber, resolveInvoiceScheme, effectiveSequence } from '../../lib/invoiceScheme'
import { costCenterOnLineItems } from '../../lib/costCenters'
import { CostCenterSelect } from '../../components/CostCenterSelect'
import { Section, numberValue, type QuoteLine } from './QuoteEditor'
import type { Invoice, InvoiceItem, InvoiceRecurrence, InvoiceStatus, InvoiceTemplate, RecurrenceFrequency, SaleDiscountType, SalesOrder } from '../../types'

/** Add calendar days to an ISO date. */
const addDaysToIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Add / Edit Invoice — a duplicate of the Sales orders modal (QuoteEditor),
 * sectioned the same way: document details, customer, products, discount &
 * tax, notes & total. Invoice-specific fields: the status set is the invoice
 * status set (Unpaid / Partially paid / Paid / Overdue / Cancelled), and the
 * two dates are the issue date and the due date. Like supplier invoices being
 * raised from a purchase order, an invoice can be linked to (and built from)
 * a source sales order.
 */

const LABEL = 'Invoice'
const LOWER = 'invoice'
const ID_PREFIX = 'inv'

/** The status options offered on an invoice. */
const INVOICE_STATUSES: InvoiceStatus[] = ['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled']
const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

/** A working line in the invoice editor (quote line + optional cost center). */
type InvoiceLine = QuoteLine & { costCenterId?: string }

export interface InvoiceEditorProps {
  /** The invoice being edited, or undefined when creating a new one. */
  invoice?: Invoice
  /** Suggested number for a new invoice (from the company's invoice scheme). */
  suggestedNumber: string
  /** When set (new invoice only), prefill lines/terms from this template. */
  initialTemplate?: InvoiceTemplate
  /** Called after a successful save with the stored record's id. */
  onSaved: (savedId: string) => void
  onCancel: () => void
}

export function InvoiceEditor({ invoice, suggestedNumber, initialTemplate, onSaved, onCancel }: InvoiceEditorProps) {
  const app = useApp()
  const { inventory, members, users, branches, branchSettings, company, setCompany, upsertInvoice, upsertSalesOrder, salesOrders, invoices, invoiceTemplates, upsertInvoiceTemplate, log } = app
  const { user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(invoice)
  const showCostCenter = costCenterOnLineItems(company)

  const availableBranches = useMemo(
    () => visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive'),
    [app.activeCompanyId, branches, user],
  )

  const initialIssued = invoice?.issuedAt || new Date().toISOString().slice(0, 10)
  const [number, setNumber] = useState(invoice?.number || suggestedNumber)
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || 'unpaid')
  const [salesOrderId, setSalesOrderId] = useState(invoice?.salesOrderId || '')
  const [businessLocation, setBusinessLocation] = useState(
    invoice?.businessLocation
      || availableBranches.find((b) => b.id === app.activeBranchId)?.name
      || availableBranches[0]?.name
      || '',
  )
  const [customerType, setCustomerType] = useState<'member' | 'walkin'>(invoice?.memberId ? 'member' : 'walkin')
  const [memberId, setMemberId] = useState(invoice?.memberId || '')
  const [customerName, setCustomerName] = useState(invoice?.customerName || '')
  const [issuedAt, setIssuedAt] = useState(initialIssued)
  const [dueAt, setDueAt] = useState(invoice?.dueAt || (initialTemplate && initialTemplate.dueInDays != null ? addDaysToIso(initialIssued, initialTemplate.dueInDays) : ''))
  const [notes, setNotes] = useState(invoice?.notes || initialTemplate?.notes || '')
  const [templateId, setTemplateId] = useState(invoice ? '' : (initialTemplate?.id || ''))

  // Recurring billing — the schedule that will re-raise this invoice.
  const [recurOn, setRecurOn] = useState(Boolean(invoice?.recurrence))
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>(invoice?.recurrence?.frequency || 'monthly')
  const [recEvery, setRecEvery] = useState(invoice?.recurrence?.every && invoice.recurrence.every > 1 ? String(invoice.recurrence.every) : '1')
  const [recCount, setRecCount] = useState(invoice?.recurrence?.count ? String(invoice.recurrence.count) : '')
  const [recEndsAt, setRecEndsAt] = useState(invoice?.recurrence?.endsAt || '')

  /** Up to three occurrences the current schedule will raise, for the live preview. */
  const previewDates = useMemo(() => {
    if (!recurOn || !issuedAt) return []
    const every = Math.max(1, Number(recEvery) || 1)
    const limit = recCount ? Math.max(0, Number(recCount) - 1) : 3
    const out: string[] = []
    let d = issuedAt
    for (let i = 0; i < Math.min(3, limit); i++) {
      d = addFrequency(d, recFreq, every)
      if (recEndsAt && d > recEndsAt) break
      out.push(d)
    }
    return out
  }, [recurOn, issuedAt, recFreq, recEvery, recCount, recEndsAt])

  /** Prefill this form from a saved invoice template (select in Invoice details). */
  const applyTemplate = (id: string) => {
    const t = invoiceTemplates.find((x) => x.id === id)
    if (!t || id === templateId) return
    setTemplateId(id)
    setLines(t.items.map((item) => ({
      itemId: item.itemId || '',
      desc: item.desc,
      quantity: item.qty ?? 1,
      unitPrice: item.unitPrice ?? item.amount,
      discount: item.discount || 0,
      costCenterId: item.costCenterId,
    })))
    if (t.discountAmount) { setDiscountType(t.discountType || 'percentage'); setDiscountAmount(t.discountAmount) }
    if (t.taxName) setTaxName(t.taxName)
    if (t.dueInDays != null) setDueAt(addDaysToIso(issuedAt, t.dueInDays))
    if (t.notes && !notes) setNotes(t.notes)
    if (t.discountAmount || t.taxName) setDiscountTaxOpen(true)
    toast.success('Template applied', `"${t.name}" — ${t.items.length} line(s) prefilled. Adjust amounts as needed.`)
  }

  const [tplName, setTplName] = useState('')
  const [tplModal, setTplModal] = useState(false)

  const openSaveTemplate = () => {
    if (!lines.some((l) => l.desc.trim() && Number(l.unitPrice) > 0)) {
      toast.error('Add at least one priced line first.', 'A template needs lines to be useful.')
      return
    }
    setTplName(lines[0].desc.trim() || `Invoice template — ${number}`)
    setTplModal(true)
  }

  const doSaveTemplate = () => {
    const name = tplName.trim()
    if (!name) { toast.error('Name the template.'); return }
    if (invoiceTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) { toast.error('A template with this name already exists.', 'Use a different name to keep the list readable.'); return }
    const items: InvoiceItem[] = lines
      .map((l) => {
        const amount = Math.max(0, Number(l.quantity) || 0) * Math.max(0, Number(l.unitPrice) || 0) - (Number(l.discount) || 0)
        return {
          itemId: l.itemId || undefined,
          desc: l.desc.trim(),
          qty: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          amount: Math.max(0, amount),
          discount: l.discount ? Number(l.discount) : undefined,
          costCenterId: l.costCenterId,
        }
      })
      .filter((it) => it.desc && it.amount > 0)
    if (!items.length) { toast.error('Add at least one priced line first.'); return }
    const dueDiff = dueAt ? Math.round((new Date(dueAt).getTime() - new Date(issuedAt).getTime()) / 86400000) : undefined
    upsertInvoiceTemplate({
      id: uid('itpl'),
      name,
      items,
      discountType: discountAmount ? discountType : undefined,
      discountAmount: discountAmount || undefined,
      taxName: taxName !== 'none' ? taxName : undefined,
      taxRate: taxName !== 'none' ? taxRate : undefined,
      dueInDays: dueDiff != null && dueDiff >= 0 ? dueDiff : undefined,
      notes: notes.trim() || undefined,
      createdBy: user?.id,
      createdAt: new Date().toISOString(),
    })
    log(user?.id || 'system', 'CREATE', 'InvoiceTemplate', `Saved template "${name}"`)
    toast.success('Template saved', `"${name}" is now available in the Template select.`)
    setTplModal(false)
    setTplName('')
  }

  const [productSearch, setProductSearch] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [lines, setLines] = useState<InvoiceLine[]>(() =>
    (invoice?.items || initialTemplate?.items || []).map((item) => ({
      itemId: item.itemId || '',
      desc: item.desc,
      quantity: item.qty ?? 1,
      unitPrice: item.unitPrice ?? item.amount,
      discount: item.discount || 0,
      costCenterId: item.costCenterId,
    })),
  )

  const [discountType, setDiscountType] = useState<SaleDiscountType>(invoice?.discountType || initialTemplate?.discountType || 'percentage')
  const [discountAmount, setDiscountAmount] = useState(invoice?.discountAmount || initialTemplate?.discountAmount || 0)
  const [discountId, setDiscountId] = useState(invoice?.discountId || '')
  const [tableDiscounts, setTableDiscounts] = useState(() => activeDiscounts())
  const [taxName, setTaxName] = useState(invoice?.taxName || initialTemplate?.taxName || 'none')
  const [taxRate, setTaxRate] = useState(invoice?.taxRate || initialTemplate?.taxRate || 0)
  const [saving, setSaving] = useState(false)

  // Open the drawer when the record (or applied template) carries values, so nothing is hidden.
  const [discountTaxOpen, setDiscountTaxOpen] = useState(() => Boolean(
    invoice?.discountAmount || invoice?.discountId || invoice?.taxName || invoice?.taxRate
    || initialTemplate?.discountAmount || initialTemplate?.taxName
    || invoice?.items?.some((item) => (item.discount || 0) > 0),
  ))

  useEffect(() => {
    if (discountTaxOpen) setTableDiscounts(activeDiscounts())
  }, [discountTaxOpen])

  const policy = useMemo(() => resolveTaxDiscountPolicy(company), [company])
  const selectedDiscount = tableDiscounts.find((d) => d.id === discountId) || null

  const locationBranchId = availableBranches.find((b) => b.name === businessLocation)?.id
    || invoice?.branchId || user?.branchId || app.activeBranchId

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
    if (invoice?.taxName && !active.some((tax) => tax.name === invoice.taxName)) {
      return [...active, { name: invoice.taxName, rate: invoice.taxRate || 0, status: 'active' as const }]
    }
    return active
  }, [branchSettings, invoice, locationBranchId])

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

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addProduct = (itemId: string) => {
    const item = inventory.find((candidate) => candidate.id === itemId)
    if (!item) return
    setLines((current) => {
      const existing = current.findIndex((line) => line.itemId === item.id)
      if (existing >= 0) return current.map((line, i) => (i === existing ? { ...line, quantity: line.quantity + 1 } : line))
      return [...current, { itemId: item.id, desc: item.name, quantity: 1, unitPrice: item.sellPrice, discount: 0, costCenterId: undefined }]
    })
    setProductSearch('')
    setShowProductResults(false)
  }

  const addCustomLine = () => {
    setLines((current) => [...current, { itemId: '', desc: '', quantity: 1, unitPrice: 0, discount: 0, costCenterId: undefined }])
  }

  /** Sales orders already raised to an invoice — hidden from the create flow. */
  const usedOrderIds = useMemo(
    () => new Set(invoices.map((i) => i.salesOrderId).filter((id): id is string => !!id)),
    [invoices],
  )

  /** Reference-picker options. Create flow: only orders NOT already linked to an
      invoice (plus the currently selected one, so a pre-filled link stays
      visible). Edit flow: the full list, so an existing link can be reviewed
      or changed — the same rules the Purchase Invoices PO picker follows. */
  const orderOptions = useMemo(() => {
    if (isEdit) return salesOrders
    const fresh = salesOrders.filter((o) => !usedOrderIds.has(o.id))
    const sel = salesOrderId ? salesOrders.find((o) => o.id === salesOrderId) : undefined
    return sel && !fresh.some((o) => o.id === sel.id) ? [sel, ...fresh] : fresh
  }, [salesOrders, usedOrderIds, salesOrderId, isEdit])

  const orderCustomer = (o: SalesOrder) =>
    o.customerName
    || (o.memberId ? users.find((u) => u.id === members.find((m) => m.id === o.memberId)?.userId)?.name || 'Member' : 'Walk-in customer')

  /** Build the invoice from a sales order — pre-fills customer, lines,
      discount/tax and notes, mirroring supplier invoices raised from a PO. */
  const fromOrder = (orderId: string) => {
    const o = salesOrders.find((x) => x.id === orderId)
    if (!o) return
    setSalesOrderId(o.id)
    setCustomerType(o.memberId ? 'member' : 'walkin')
    setMemberId(o.memberId || '')
    setCustomerName(o.customerName || '')
    setLines((o.items || []).map((item) => ({
      itemId: item.itemId || '',
      desc: item.desc,
      quantity: item.qty ?? 1,
      unitPrice: item.unitPrice ?? item.amount,
      discount: item.discount || 0,
      costCenterId: item.costCenterId,
    })))
    if (o.discountType) setDiscountType(o.discountType)
    if (o.discountAmount) setDiscountAmount(o.discountAmount)
    if (o.discountId) setDiscountId(o.discountId)
    if (o.taxName) setTaxName(o.taxName)
    if (o.taxRate) setTaxRate(o.taxRate)
    setNotes(o.notes || '')
    if (o.businessLocation) setBusinessLocation(o.businessLocation)
    setIssuedAt(new Date().toISOString().slice(0, 10))
    setDueAt('')
  }

  const save = () => {
    if (!number.trim()) { toast.error(`${LABEL} number is required.`); return }
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
          ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
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

    let recurrence: InvoiceRecurrence | undefined
    if (recurOn) {
      const every = Math.max(1, Number(recEvery) || 1)
      const count = recCount ? Math.max(1, Number(recCount)) : undefined
      const endsAt = recEndsAt || undefined
      if (invoice?.recurrence) {
        const prev = invoice.recurrence
        const unchanged = prev.frequency === recFreq && (prev.every || 1) === every && invoice.issuedAt === issuedAt
        recurrence = {
          frequency: recFreq, every, count, endsAt,
          issued: prev.issued || 1,
          nextAt: unchanged && prev.nextAt ? prev.nextAt : addFrequency(issuedAt, recFreq, every),
          stopped: false,
        }
      } else {
        recurrence = { frequency: recFreq, every, count, endsAt, issued: 1, nextAt: addFrequency(issuedAt, recFreq, every) }
      }
    }

    setSaving(true)
    const branchId = locationBranchId || undefined
    const rec: Invoice = {
      id: invoice?.id || `${ID_PREFIX}_${Math.random().toString(36).slice(2, 10)}`,
      number: number.trim(),
      memberId: customerType === 'member' ? memberId || undefined : undefined,
      customerName: customerType === 'walkin' ? customerName.trim() || 'Walk-in customer' : undefined,
      ...(invoice?.saleId ? { saleId: invoice.saleId } : {}),
      ...(salesOrderId ? { salesOrderId } : {}),
      items,
      total,
      status,
      issuedAt,
      dueAt: dueAt || issuedAt,
      branchId,
      businessLocation: businessLocation || undefined,
      notes: notes.trim() || undefined,
      ...(recurrence ? { recurrence } : {}),
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
    upsertInvoice(rec)

    // Mark the source sales order as invoiced, the way supplier invoices
    // reference the purchase order they were raised from.
    if (salesOrderId) {
      const src = salesOrders.find((x) => x.id === salesOrderId)
      if (src && src.status !== 'invoiced') upsertSalesOrder({ ...src, status: 'invoiced' })
    }

    // Consume the scheme's next number when this new invoice used it.
    if (!isEdit) {
      const scheme = resolveInvoiceScheme(company?.invoiceScheme)
      if (rec.number === nextInvoiceNumber(scheme)) {
        const seq = effectiveSequence(scheme)
        setCompany({ ...company, invoiceScheme: { ...scheme, nextNumber: seq.number + 1, year: seq.year } })
      }
    }

    log(user?.id || 'system', isEdit ? 'UPDATE' : 'CREATE', LABEL, `${isEdit ? 'Updated' : 'Created'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isEdit ? `${LABEL} updated` : `${LABEL} created`, rec.number)
    setSaving(false)
    onSaved(rec.id)
  }

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: users.find((u) => u.id === m.userId)?.name || m.id })),
    [members, users],
  )

  const headerColCount = 4 + (policy.discount.visible ? 1 : 0) + (showCostCenter ? 1 : 0) + 2
  const tfootColSpan = 4 + (policy.discount.visible ? 1 : 0) + (showCostCenter ? 1 : 0)
  const tableMinW = showCostCenter ? 'min-w-[980px]' : 'min-w-[820px]'

  return (
    <div className="space-y-4">
      {/* ── Invoice details ── */}
      <Section title="Invoice details" icon={<FileText className="size-4" />}>
        {invoiceTemplates.length > 0 && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Field label="Template">
              <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">— Start from a template (optional) —</option>
                {invoiceTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.items.length} line(s)</option>)}
              </Select>
            </Field>
            <p className="self-end pb-2 text-xs text-mist">Pick a template to prefill the lines and terms — then set the customer and adjust amounts. Save your own with <span className="font-semibold">Save as template</span> below.</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Invoice number" required>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}
            </Select>
          </Field>
          <Field label="Business location">
            <Select value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)}>
              {!locations.length && <option value="">No branch available</option>}
              {locations.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Issue date">
            <DatePicker value={issuedAt} onChange={setIssuedAt} />
          </Field>
          <Field label="Due date (optional)">
            <DatePicker value={dueAt} onChange={setDueAt} />
          </Field>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <div className="min-w-[16rem] flex-1">
              <Field label="Source sales order (optional)">
                <Select value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)}>
                  <option value="">No source order</option>
                  {orderOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.number} — {orderCustomer(o)}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="outline" disabled={!salesOrderId} onClick={() => fromOrder(salesOrderId)} title="Copy customer, lines, discount, tax and notes from the selected order">
              <Receipt className="size-4" /> Use order
            </Button>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><Repeat className="size-4" /> Recurring invoice</p>
                  <p className="mt-0.5 text-xs text-mist">Automatically raises the same invoice on a schedule. Each new cycle starts unpaid.</p>
                </div>
                <Switch checked={recurOn} onChange={setRecurOn} aria-label="Recurring invoice" />
              </div>
              {recurOn && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Repeat">
                      <Select value={recFreq} onChange={(e) => setRecFreq(e.target.value as RecurrenceFrequency)}>
                        {RECUR_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Every (intervals)">
                      <Input type="number" min={1} step={1} value={recEvery} onChange={(e) => setRecEvery(e.target.value)} />
                    </Field>
                    <Field label="Stop after (occurrences)">
                      <Input type="number" min={2} step={1} value={recCount} onChange={(e) => setRecCount(e.target.value)} placeholder="No limit" />
                    </Field>
                    <Field label="Or end on">
                      <DatePicker value={recEndsAt} onChange={setRecEndsAt} placeholder="No end date" />
                    </Field>
                  </div>
                  {previewDates.length > 0 && (
                    <p className="text-xs text-mist">
                      Next occurrences: <span className="font-semibold text-inherit">{previewDates.map(formatDate).join(' · ')}</span>
                      {recCount ? ` — the cycle ends after ${recCount} occurrences.` : recEndsAt ? ` — the cycle ends on ${formatDate(recEndsAt)}.` : ' — the cycle repeats until you stop it.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
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
          <table className={`w-full ${tableMinW} text-sm`}>
            <thead className="bg-zinc-50 text-left dark:bg-white/[0.035]">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-bold">#</th>
                <th className="min-w-[240px] px-3 py-3 font-bold">Item</th>
                <th className="w-28 px-3 py-3 font-bold">Quantity</th>
                <th className="w-36 px-3 py-3 font-bold">Unit price</th>
                {policy.discount.visible && <th className="w-32 px-3 py-3 font-bold">Discount</th>}
                {showCostCenter && <th className="w-44 px-3 py-3 font-bold">Cost center</th>}
                <th className="w-36 px-3 py-3 text-right font-bold">Subtotal</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={headerColCount} className="px-4 py-12 text-center">
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
                    {showCostCenter && (
                      <td className="px-3 py-3">
                        <CostCenterSelect value={line.costCenterId} onChange={(id) => updateLine(index, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${index + 1}`} />
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
                <td colSpan={tfootColSpan} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted">Items total</td>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={openSaveTemplate}>
          <Save className="size-4" /> Save as template
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4" /> {isEdit ? `Save ${LOWER}` : `Add ${LABEL}`}
          </Button>
        </div>
      </div>

      {/* Save current entry as a reusable invoice template */}
      <Modal open={tplModal} onClose={() => setTplModal(false)} title="Save as template">
        <div className="space-y-3">
          <p className="text-sm text-mist">Save the current lines, discount, tax and due-date terms as a reusable template. New invoices can pick it from the <span className="font-semibold">Template</span> select.</p>
          <Field label="Template name" required>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Gym membership — monthly" autoFocus />
          </Field>
          <div className="rounded-xl border border-line p-3 text-xs text-mist">
            <p className="font-semibold text-ink">{lines.filter((l) => l.desc.trim() && Number(l.unitPrice) > 0).length} line(s) · {formatGhsExact(total)}{discountAmount ? ` · ${discountType === 'percentage' ? `${discountAmount}%` : formatGhsExact(discountAmount)} discount` : ''}{taxName !== 'none' ? ` · ${taxName} tax` : ''}{dueAt ? ` · due ${formatDate(dueAt)}` : ''}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTplModal(false)}>Cancel</Button>
            <Button onClick={doSaveTemplate}><Save className="size-4" /> Save template</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
