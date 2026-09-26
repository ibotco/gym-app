import type {
  GoodsReceipt, GrnStatus, ProcPOStatus, ProcPurchaseOrder,
  PurchaseRequisition, RequisitionStatus,
} from '../types'

/* ── Storage keys ───────────────────────────────────────────────────────── */
export const REQUISITIONS_KEY = 'fitpro_requisitions'
export const PROC_PURCHASE_ORDERS_KEY = 'fitpro_proc_purchase_orders'
export const GOODS_RECEIPTS_KEY = 'fitpro_goods_receipts'

/* ── Status metadata ────────────────────────────────────────────────────── */
export const REQUISITION_STATUSES: RequisitionStatus[] = [
  'draft', 'pending_approval', 'approved', 'rejected', 'converted', 'cancelled',
]

export const PROC_PO_STATUSES: ProcPOStatus[] = [
  'draft', 'pending_approval', 'approved', 'rejected',
  'sent', 'partially_received', 'fully_received', 'closed', 'cancelled',
]

export const GRN_STATUSES: GrnStatus[] = ['draft', 'posted', 'cancelled']

/** Human labels — statuses are stored snake_case but always displayed prettified. */
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  sent: 'Sent to supplier',
  partially_received: 'Partially received',
  fully_received: 'Fully received',
  closed: 'Closed',
  cancelled: 'Cancelled',
  converted: 'Converted',
  posted: 'Posted',
  submitted: 'Submitted',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  returned: 'Returned',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

export type Tone = 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange'

export function statusTone(status: string): Tone {
  switch (status) {
    case 'draft': return 'zinc'
    case 'pending_approval': case 'submitted': return 'amber'
    case 'approved': return 'sky'
    case 'sent': return 'violet'
    case 'partially_received': return 'orange'
    case 'fully_received': case 'posted': case 'converted': case 'paid': case 'returned': return 'lime'
    case 'partially_paid': return 'orange'
    case 'closed': return 'zinc'
    case 'rejected': case 'cancelled': return 'rose'
    default: return 'zinc'
  }
}

/** Ordered stages shown in the document progress tracker. */
export const PO_PROGRESS: ProcPOStatus[] = ['draft', 'approved', 'sent', 'partially_received', 'fully_received']

/* ── Business rules ─────────────────────────────────────────────────────── */

/** A GRN may only be raised against an approved order that is still open. */
export function canReceive(status: ProcPOStatus): boolean {
  return status === 'approved' || status === 'sent' || status === 'partially_received'
}

/** Orders may be amended while Draft, Pending approval, or Rejected (a rejected
    order can be fixed and resubmitted); once approved they are locked. */
export function isEditable(status: ProcPOStatus): boolean {
  return status === 'draft' || status === 'pending_approval' || status === 'rejected'
}

/** Only orders that never reached approval may be deleted. */
export function isDeletable(status: ProcPOStatus): boolean {
  return status === 'draft' || status === 'rejected'
}

/**
 * Total already received for an item on a PO, counting only POSTED receipts.
 * Draft receipts must never consume the remaining quantity.
 */
export function receivedQty(receipts: GoodsReceipt[], poId: string, itemId: string, excludeGrnId?: string): number {
  return receipts
    .filter((g) => g.purchaseOrderId === poId && g.status === 'posted' && g.id !== excludeGrnId)
    .reduce((sum, g) => sum + g.lines
      .filter((l) => l.itemId === itemId)
      .reduce((s, l) => s + (Number(l.quantityReceiving) || 0), 0), 0)
}

/** Remaining quantity still expected for an item on a PO. Never negative. */
export function remainingQty(po: ProcPurchaseOrder, receipts: GoodsReceipt[], itemId: string, excludeGrnId?: string): number {
  const ordered = po.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0)
  return Math.max(0, ordered - receivedQty(receipts, po.id, itemId, excludeGrnId))
}

/** Receipt progress across the whole order, used to derive the PO status. */
export function poReceiptState(po: ProcPurchaseOrder, receipts: GoodsReceipt[]): 'none' | 'partial' | 'full' {
  const totalOrdered = po.lines.reduce((s, l) => s + l.quantity, 0)
  if (totalOrdered <= 0) return 'none'
  const totalReceived = po.lines.reduce((s, l) => s + receivedQty(receipts, po.id, l.itemId), 0)
  if (totalReceived <= 0) return 'none'
  return totalReceived >= totalOrdered ? 'full' : 'partial'
}

/** Status a PO should move to after a receipt is posted. */
export function nextPoStatus(po: ProcPurchaseOrder, receipts: GoodsReceipt[]): ProcPOStatus {
  const state = poReceiptState(po, receipts)
  if (state === 'full') return 'fully_received'
  if (state === 'partial') return 'partially_received'
  return po.status
}

/* ── Totals ─────────────────────────────────────────────────────────────── */

/** Line net after its own discount, before tax. */
export function lineNet(quantity: number, unitCost: number, discountPercent = 0): number {
  const gross = (Number(quantity) || 0) * (Number(unitCost) || 0)
  const disc = gross * ((Number(discountPercent) || 0) / 100)
  return Math.max(0, gross - disc)
}

export function poTotals(lines: { quantity: number; unitCost: number; discountPercent?: number; taxRate?: number }[]) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0
  for (const l of lines) {
    const gross = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
    const disc = gross * ((Number(l.discountPercent) || 0) / 100)
    const net = Math.max(0, gross - disc)
    subtotal += gross
    discountTotal += disc
    taxTotal += net * ((Number(l.taxRate) || 0) / 100)
  }
  const total = subtotal - discountTotal + taxTotal
  return { subtotal, discountTotal, taxTotal, total }
}

/* ── Numbering ──────────────────────────────────────────────────────────── */
function nextNumber(prefix: string, count: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
}
export const nextRequisitionNumber = (l: PurchaseRequisition[]) => nextNumber('PR', l.length)
export const nextProcPoNumber = (l: ProcPurchaseOrder[]) => nextNumber('PO', l.length)
export const nextGrnNumber = (l: GoodsReceipt[]) => nextNumber('GRN', l.length)

/* ── Seeds ──────────────────────────────────────────────────────────────── */
export const REQUISITIONS: PurchaseRequisition[] = [
  {
    id: 'pr_1', number: 'PR-2026-001', department: 'Operations', requestedBy: 'Ama Mensah',
    date: '2026-08-05', requiredDate: '2026-08-25', status: 'approved',
    approvedBy: 'Kwame Owusu', approvedAt: '2026-08-06T09:00:00',
    lines: [{ itemId: 'inv_1', quantity: 20, estimatedCost: 520 }],
    notes: 'Monthly protein restock for the main branch.',
    createdAt: '2026-08-05T08:00:00',
  },
  {
    id: 'pr_2', number: 'PR-2026-002', department: 'Facilities', requestedBy: 'Yaw Boateng',
    date: '2026-08-18', requiredDate: '2026-09-05', status: 'pending_approval',
    lines: [{ itemId: 'inv_11', quantity: 12, estimatedCost: 110 }],
    notes: 'Replacement foam rollers for the studio.',
    createdAt: '2026-08-18T10:15:00',
  },
]

export const PROC_PURCHASE_ORDERS: ProcPurchaseOrder[] = [
  {
    id: 'ppo_1', number: 'PO-2026-001', supplierId: 'sup_1',
    date: '2026-08-08', requiredDate: '2026-08-28',
    department: 'Operations', currency: 'GHS', paymentTerms: 'Net 30',
    requestedBy: 'Ama Mensah', approvedBy: 'Kwame Owusu', approvedAt: '2026-08-09T11:00:00',
    sentAt: '2026-08-09T14:00:00', status: 'partially_received',
    lines: [{ itemId: 'inv_1', quantity: 20, unitCost: 520, taxRate: 0 }],
    subtotal: 10400, discountTotal: 0, taxTotal: 0, total: 10400,
    notes: 'Raised from PR-2026-001.', requisitionId: 'pr_1',
    createdAt: '2026-08-08T09:30:00',
  },
  {
    id: 'ppo_2', number: 'PO-2026-002', supplierId: 'sup_4',
    date: '2026-08-20', requiredDate: '2026-09-10',
    department: 'Facilities', currency: 'GHS', paymentTerms: 'Net 15',
    requestedBy: 'Yaw Boateng', status: 'pending_approval',
    lines: [{ itemId: 'inv_11', quantity: 12, unitCost: 110, taxRate: 0 }],
    subtotal: 1320, discountTotal: 0, taxTotal: 0, total: 1320,
    createdAt: '2026-08-20T10:45:00',
  },
]

export const GOODS_RECEIPTS: GoodsReceipt[] = [
  {
    id: 'grn_1', number: 'GRN-2026-001', date: '2026-08-19',
    supplierId: 'sup_1', purchaseOrderId: 'ppo_1',
    deliveryNoteNumber: 'DN-88421', receivedBy: 'Kofi Asare',
    status: 'posted', postedAt: '2026-08-19T13:20:00',
    lines: [{
      itemId: 'inv_1', quantityOrdered: 20, quantityReceiving: 12, quantityRejected: 0,
      unitCost: 520, binLocation: 'A-01-03', batchNumber: 'BATCH-2608',
    }],
    total: 6240,
    remarks: 'Part delivery — balance to follow.',
    createdAt: '2026-08-19T13:00:00',
  },
]

/* ── Load / save ────────────────────────────────────────────────────────── */
function load<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch { /* ignore */ }
  return fallback
}
function save<T>(key: string, list: T[]) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ }
}

export const loadRequisitions = () => load<PurchaseRequisition>(REQUISITIONS_KEY, REQUISITIONS)
export const saveRequisitions = (l: PurchaseRequisition[]) => save(REQUISITIONS_KEY, l)
export const loadProcPurchaseOrders = () => load<ProcPurchaseOrder>(PROC_PURCHASE_ORDERS_KEY, PROC_PURCHASE_ORDERS)
export const saveProcPurchaseOrders = (l: ProcPurchaseOrder[]) => save(PROC_PURCHASE_ORDERS_KEY, l)
export const loadGoodsReceipts = () => load<GoodsReceipt>(GOODS_RECEIPTS_KEY, GOODS_RECEIPTS)
export const saveGoodsReceipts = (l: GoodsReceipt[]) => save(GOODS_RECEIPTS_KEY, l)

/* ═══════════════ Phase 2: invoices, payments, returns ═══════════════════ */

import type {
  ProcPurchaseReturn, ProcReturnStatus, SupplierInvoice, SupplierInvoiceStatus,
  SupplierPayment, SupplierPaymentStatus,
} from '../types'

export const SUPPLIER_INVOICES_KEY = 'fitpro_supplier_invoices'
export const SUPPLIER_PAYMENTS_KEY = 'fitpro_supplier_payments'
export const PROC_RETURNS_KEY = 'fitpro_proc_returns'

export const SUPPLIER_INVOICE_STATUSES: SupplierInvoiceStatus[] = ['draft', 'posted', 'partially_paid', 'paid', 'cancelled']
export const SUPPLIER_PAYMENT_STATUSES: SupplierPaymentStatus[] = ['draft', 'posted', 'cancelled']
export const PROC_RETURN_STATUSES: ProcReturnStatus[] = ['draft', 'approved', 'returned', 'closed', 'cancelled']

export const nextInvoiceNumber = (l: SupplierInvoice[]) => nextNumber('SINV', l.length)
export const nextPaymentNumber = (l: SupplierPayment[]) => nextNumber('SPAY', l.length)
export const nextReturnNumber = (l: ProcPurchaseReturn[]) => nextNumber('PRET', l.length)

/** Rounding tolerance for money comparisons (half a pesewa). */
export const CENT = 0.005

/** Total posted against an invoice. Draft payments never count. */
/**
 * How much of `payment` was applied to `invoiceId`.
 * Multi-invoice payments carry an allocations array; legacy single-invoice
 * records fall back to the whole amount against supplierInvoiceId.
 */
export function allocatedTo(payment: SupplierPayment, invoiceId: string): number {
  if (payment.allocations && payment.allocations.length) {
    return payment.allocations
      .filter((a) => a.supplierInvoiceId === invoiceId)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0)
  }
  return payment.supplierInvoiceId === invoiceId ? Number(payment.amount) || 0 : 0
}

/** Invoice ids this payment settles, in order. */
export function paymentInvoiceIds(payment: SupplierPayment): string[] {
  if (payment.allocations && payment.allocations.length) {
    return payment.allocations.map((a) => a.supplierInvoiceId)
  }
  return payment.supplierInvoiceId ? [payment.supplierInvoiceId] : []
}

/** Sum of a payment's allocations — falls back to the flat amount. */
export function allocationTotal(payment: Pick<SupplierPayment, 'allocations' | 'amount'>): number {
  if (payment.allocations && payment.allocations.length) {
    return payment.allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  }
  return Number(payment.amount) || 0
}

export function paidAgainst(payments: SupplierPayment[], invoiceId: string, excludeId?: string): number {
  return payments
    .filter((p) => p.status === 'posted' && p.id !== excludeId)
    .reduce((s, p) => s + allocatedTo(p, invoiceId), 0)
}

export function balanceOf(inv: SupplierInvoice, payments: SupplierPayment[]): number {
  return Math.max(0, inv.total - paidAgainst(payments, inv.id))
}

/**
 * Payment status derived from posted payments — mirrors the Purchases rule so
 * both modules agree on what "partially paid" means.
 */
export function invoicePayStatus(inv: SupplierInvoice, payments: SupplierPayment[]): SupplierInvoiceStatus {
  if (inv.status === 'draft' || inv.status === 'cancelled') return inv.status
  const paid = paidAgainst(payments, inv.id)
  if (inv.total > 0 && paid >= inv.total - CENT) return 'paid'
  if (paid > CENT) return 'partially_paid'
  return 'posted'
}

/** Only posted, not-yet-settled invoices can take a payment. */
export function canPay(inv: SupplierInvoice, payments: SupplierPayment[]): boolean {
  if (inv.status === 'draft' || inv.status === 'cancelled') return false
  return balanceOf(inv, payments) > CENT
}

/** Quantity of an item already returned against a receipt (posted returns only). */
export function returnedQty(returns: ProcPurchaseReturn[], grnId: string, itemId: string, excludeId?: string): number {
  return returns
    .filter((r) => r.goodsReceiptId === grnId && (r.status === 'returned' || r.status === 'closed') && r.id !== excludeId)
    .reduce((sum, r) => sum + r.lines
      .filter((l) => l.itemId === itemId)
      .reduce((s, l) => s + (Number(l.quantityReturned) || 0), 0), 0)
}

/** A return may only reverse quantities that were actually accepted. */
export function returnableQty(receivedOnGrn: number, returns: ProcPurchaseReturn[], grnId: string, itemId: string, excludeId?: string): number {
  return Math.max(0, receivedOnGrn - returnedQty(returns, grnId, itemId, excludeId))
}

export function invoiceTotals(lines: { quantity: number; unitCost: number; discountPercent?: number; taxRate?: number }[]) {
  return poTotals(lines)
}

/* ── Seeds ──────────────────────────────────────────────────────────────── */
export const SUPPLIER_INVOICES: SupplierInvoice[] = [
  {
    id: 'sinv_1', number: 'SINV-2026-001', supplierId: 'sup_1',
    purchaseOrderId: 'ppo_1', goodsReceiptId: 'grn_1',
    invoiceDate: '2026-08-20', dueDate: '2026-09-19', status: 'partially_paid',
    lines: [{ itemId: 'inv_1', quantity: 12, unitCost: 520, taxRate: 0 }],
    subtotal: 6240, discountTotal: 0, taxTotal: 0, total: 6240,
    notes: 'Covers the first part delivery on PO-2026-001.',
    postedAt: '2026-08-20T10:00:00', postedBy: 'Kwame Owusu',
    createdAt: '2026-08-20T09:40:00',
  },
]

export const SUPPLIER_PAYMENTS: SupplierPayment[] = [
  {
    id: 'spay_1', number: 'SPAY-2026-001', supplierId: 'sup_1',
    supplierInvoiceId: 'sinv_1', paymentDate: '2026-08-25',
    method: 'cash', accountId: 'ac_88', amount: 3000,
    reference: 'TRF-556677', status: 'posted',
    postedAt: '2026-08-25T11:15:00', postedBy: 'Kwame Owusu',
    createdAt: '2026-08-25T11:10:00',
  },
]

export const PROC_RETURNS: ProcPurchaseReturn[] = []

export const loadSupplierInvoices = () => load<SupplierInvoice>(SUPPLIER_INVOICES_KEY, SUPPLIER_INVOICES)
export const saveSupplierInvoices = (l: SupplierInvoice[]) => save(SUPPLIER_INVOICES_KEY, l)
export const loadSupplierPayments = () => load<SupplierPayment>(SUPPLIER_PAYMENTS_KEY, SUPPLIER_PAYMENTS)
export const saveSupplierPayments = (l: SupplierPayment[]) => save(SUPPLIER_PAYMENTS_KEY, l)
export const loadProcReturns = () => load<ProcPurchaseReturn>(PROC_RETURNS_KEY, PROC_RETURNS)
export const saveProcReturns = (l: ProcPurchaseReturn[]) => save(PROC_RETURNS_KEY, l)

/* ═════════ Supplier invoice: items + expenses ═════════════════════════ */

import type { Account, PayTermUnit, SupplierInvoiceExpenseLine, SupplierInvoiceLine } from '../types'

/**
 * Full invoice totals across both tabs.
 *
 *   Grand total = item net + expense net + all tax
 *
 * Tax is computed per line on the post-discount net, so a discount always
 * reduces the taxable base.
 */
export function fullInvoiceTotals(
  items: Pick<SupplierInvoiceLine, 'quantity' | 'unitCost' | 'discountPercent' | 'taxRate'>[],
  expenses: Pick<SupplierInvoiceExpenseLine, 'amount' | 'taxRate'>[],
  /** Optional order-level adjustments (applied after the line math). */
  order?: { discountAmount?: number; taxRate?: number },
) {
  let itemGross = 0, discountTotal = 0, itemTax = 0
  for (const l of items) {
    const gross = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
    const disc = gross * ((Number(l.discountPercent) || 0) / 100)
    const net = Math.max(0, gross - disc)
    itemGross += gross
    discountTotal += disc
    itemTax += net * ((Number(l.taxRate) || 0) / 100)
  }
  const itemSubtotal = itemGross - discountTotal

  let expenseSubtotal = 0, expenseTax = 0
  for (const e of expenses) {
    const amt = Number(e.amount) || 0
    expenseSubtotal += amt
    expenseTax += amt * ((Number(e.taxRate) || 0) / 100)
  }

  const taxTotal = itemTax + expenseTax
  const base = itemSubtotal + expenseSubtotal
  const orderDiscount = Math.min(Math.max(0, Number(order?.discountAmount) || 0), base)
  const orderTax = Math.max(0, base - orderDiscount) * ((Number(order?.taxRate) || 0) / 100)
  return {
    itemGross,
    discountTotal,
    itemSubtotal,
    expenseSubtotal,
    itemTax,
    expenseTax,
    orderDiscount,
    orderTax,
    taxTotal,
    total: base - orderDiscount + taxTotal + orderTax,
  }
}

/** Accounts that may legitimately receive an expense charge. */
export function isPostableExpenseAccount(a: Account): boolean {
  if (a.status && a.status !== 'active') return false
  // Expenses normally hit expense/COGS accounts, but capitalisable charges
  // (e.g. duty added to an asset) may target an asset account too.
  return a.type === 'expense' || a.type === 'asset'
}

export type InvoiceValidation = { ok: boolean; errors: string[] }

/**
 * Validate an invoice before save. Enforces the documented business rules:
 * at least one line overall, and every expense line carrying a real account.
 */
export function validateInvoice(
  items: { itemId: string; quantity: number; unitCost: number }[],
  expenses: { accountId: string; amount: number }[],
  accounts: Account[],
): InvoiceValidation {
  const errors: string[] = []
  const goodItems = items.filter((l) => l.itemId && (Number(l.quantity) || 0) > 0)
  const goodExpenses = expenses.filter((e) => e.accountId && (Number(e.amount) || 0) !== 0)

  if (!goodItems.length && !goodExpenses.length) {
    errors.push('Add at least one item or expense line before saving.')
  }
  for (const l of items) {
    if (l.itemId && (Number(l.quantity) || 0) <= 0) errors.push('Item quantities must be greater than zero.')
    if (l.itemId && !Number.isFinite(Number(l.unitCost))) errors.push('Every item line needs a unit cost.')
  }
  for (const e of expenses) {
    const filled = e.accountId || (Number(e.amount) || 0) !== 0
    if (!filled) continue
    if (!e.accountId) { errors.push('Every expense line must have an expense account selected.'); continue }
    const acct = accounts.find((a) => a.id === e.accountId)
    if (!acct) errors.push('An expense line references an account that no longer exists.')
    else if (!isPostableExpenseAccount(acct)) errors.push(`"${acct.name}" is not a valid expense account.`)
    if ((Number(e.amount) || 0) <= 0) errors.push('Expense amounts must be greater than zero.')
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) }
}

/** Invoices may be edited through the workflow, including once posted (the
    ledger rows are re-synced on save); settled (partially paid / paid) and
    cancelled invoices are locked. */
export function invoiceEditable(status: string): boolean {
  return status === 'draft' || status === 'submitted' || status === 'approved' || status === 'posted'
}

/** Only invoices that never reached posting may be deleted. */
export function invoiceDeletable(status: string): boolean {
  return status === 'draft' || status === 'submitted' || status === 'approved'
}

export interface JournalLinePreview { accountId: string; accountName: string; debit: number; credit: number }

/**
 * Double-entry preview for an invoice:
 *   Dr Inventory (item net)  ·  Dr each expense account  ·  Dr input tax
 *   Cr Accounts Payable (grand total)
 * Mirrors the Procurement mapping defaults; nothing is written to the ledger.
 */
export function invoiceJournalPreview(
  items: Pick<SupplierInvoiceLine, 'quantity' | 'unitCost' | 'discountPercent' | 'taxRate'>[],
  expenses: SupplierInvoiceExpenseLine[],
  accounts: Account[],
  opts: { inventoryAccountId?: string; payableAccountId?: string; taxAccountId?: string; orderDiscount?: number; orderTax?: number } = {},
): JournalLinePreview[] {
  const inventoryId = opts.inventoryAccountId || 'ac_36'
  const payableId = opts.payableAccountId || 'ac_87'
  const taxId = opts.taxAccountId || 'ac_29'
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name || id
  const t = fullInvoiceTotals(items, expenses, { discountAmount: opts.orderDiscount })
  const out: JournalLinePreview[] = []

  // Scale the item/expense debits so the order-level discount is shared across
  // them — the entry still credits the payable with exactly the invoice total.
  const base = t.itemSubtotal + t.expenseSubtotal
  const disc = Math.min(Math.max(0, Number(opts.orderDiscount) || 0), base)
  const factor = base > 0 ? (base - disc) / base : 0

  if (t.itemSubtotal * factor > 0) {
    out.push({ accountId: inventoryId, accountName: nameOf(inventoryId), debit: t.itemSubtotal * factor, credit: 0 })
  }
  // Group expense lines by account so the entry stays readable.
  const byAccount = new Map<string, number>()
  for (const e of expenses) {
    const amt = Number(e.amount) || 0
    if (!e.accountId || amt === 0) continue
    byAccount.set(e.accountId, (byAccount.get(e.accountId) || 0) + amt * factor)
  }
  for (const [accountId, amount] of byAccount) {
    out.push({ accountId, accountName: nameOf(accountId), debit: amount, credit: 0 })
  }
  if (t.taxTotal > 0) {
    out.push({ accountId: taxId, accountName: nameOf(taxId), debit: t.taxTotal, credit: 0 })
  }
  if ((Number(opts.orderTax) || 0) > 0) {
    out.push({ accountId: taxId, accountName: nameOf(taxId), debit: Number(opts.orderTax), credit: 0 })
  }
  if (t.total + (Number(opts.orderTax) || 0) > 0) {
    out.push({ accountId: payableId, accountName: nameOf(payableId), debit: 0, credit: t.total + (Number(opts.orderTax) || 0) })
  }
  return out
}

/** Options for the pay-term Unit picker. Day is the default. */
export const PAY_TERM_UNITS: { id: PayTermUnit; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'month', label: 'Month' },
]

export const DEFAULT_PAY_TERM_UNIT: PayTermUnit = 'day'

/**
 * Validate the pay-term value. Empty is allowed (the term is optional), but a
 * supplied value must be a positive number.
 */
export function validatePayTerm(raw: string): string | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return 'Pay Term must be a number.'
  if (n <= 0) return 'Pay Term must be greater than zero.'
  if (!Number.isInteger(n)) return 'Pay Term must be a whole number.'
  return null
}

/**
 * Due date implied by a credit period. Returns '' when the term is incomplete
 * so the caller can leave the due date under manual control.
 * Month arithmetic clamps to the end of a short month (31 Jan + 1 month -> 28/29 Feb).
 */
export function dueDateFromTerm(invoiceDate: string, value?: number | null, unit?: PayTermUnit | null): string {
  if (!invoiceDate || !unit || value == null || !Number.isFinite(value) || value <= 0) return ''
  const base = new Date(invoiceDate)
  if (Number.isNaN(base.getTime())) return ''
  const d = new Date(base.getTime())
  if (unit === 'day') {
    d.setDate(d.getDate() + Math.trunc(value))
  } else {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + Math.trunc(value))
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, last))
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
