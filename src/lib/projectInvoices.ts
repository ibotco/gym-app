// Project Management — Project Invoice data layer.
// Modelled on lib/procurement.ts (supplier invoices) but scoped to projects:
// bills raised TO clients against a project (sales side).

import type { ProjectInvoice, ProjectInvoiceLine, ProjectInvoiceStatus } from '../types'

export const PROJECT_INVOICES_KEY = 'fitpro_project_invoices_v1'

export const PROJECT_INVOICE_STATUSES: ProjectInvoiceStatus[] = ['draft', 'sent', 'paid', 'cancelled']

/** Prettified labels — statuses are stored snake_case but always displayed prettified. */
export const PROJECT_INVOICE_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export function projectInvoiceLabel(status: string): string {
  return PROJECT_INVOICE_LABELS[status] || status
}

/* ── Totals ─────────────────────────────────────────────────────────────── */

/**
 * Invoice totals: subtotal across the lines, then a single order-level tax.
 * Line amounts are qty × rate; the tax is applied on the subtotal.
 */
/** Net + tax for one line — the discount reduces the base, tax applies after (purchase-invoice math). */
export function projectInvoiceLineTotal(l: Pick<ProjectInvoiceLine, 'qty' | 'rate' | 'discount' | 'tax'>): number {
  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0)
  const net = gross - gross * ((Number(l.discount) || 0) / 100)
  return net + net * ((Number(l.tax) || 0) / 100)
}

export function projectInvoiceTotals(
  lines: Pick<ProjectInvoiceLine, 'qty' | 'rate' | 'discount' | 'tax'>[],
  taxRate = 0,
  orderDiscount = 0,
): { subtotal: number; tax: number; total: number } {
  const lineSubtotal = lines.reduce((s, l) => {
    const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0)
    return s + (gross - gross * ((Number(l.discount) || 0) / 100))
  }, 0)
  const lineTax = lines.reduce((s, l) => {
    const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0)
    const net = gross - gross * ((Number(l.discount) || 0) / 100)
    return s + net * ((Number(l.tax) || 0) / 100)
  }, 0)
  const subtotal = Math.max(0, lineSubtotal - (Number(orderDiscount) || 0))
  const tax = lineTax + subtotal * ((Number(taxRate) || 0) / 100)
  return { subtotal, tax, total: subtotal + tax }
}

/** Amount still outstanding — cancelled invoices never carry a balance. */
export function projectInvoiceBalance(inv: ProjectInvoice): number {
  return inv.status === 'paid' || inv.status === 'cancelled' ? 0 : inv.total
}

/** A sent invoice past its due date with money outstanding is overdue. */
export function isProjectInvoiceOverdue(inv: ProjectInvoice, today = new Date().toISOString().slice(0, 10)): boolean {
  return inv.status === 'sent' && !!inv.dueDate && inv.dueDate < today && projectInvoiceBalance(inv) > 0
}

/** Draft and sent invoices may still be edited; paid/cancelled are locked. */
export function projectInvoiceEditable(status: ProjectInvoiceStatus): boolean {
  return status === 'draft' || status === 'sent'
}

/** Only invoices that never left Draft may be deleted. */
export function projectInvoiceDeletable(status: ProjectInvoiceStatus): boolean {
  return status === 'draft'
}

/* ── Numbering ──────────────────────────────────────────────────────────── */

export function nextProjectInvoiceNumber(list: ProjectInvoice[]): string {
  return `PINV-${new Date().getFullYear()}-${String(list.length + 1).padStart(3, '0')}`
}

/* ── Seeds ──────────────────────────────────────────────────────────────── */

const year = new Date().getFullYear()

export const SEED_PROJECT_INVOICES: ProjectInvoice[] = [
  {
    id: 'pinv_1', companyId: 'co_fitpro', number: `PINV-${year}-001`,
    projectId: 'pr_1', projectName: 'Spinning Studio Build-Out', clientName: 'Ama Mensah',
    invoiceDate: `${year}-08-12`, dueDate: `${year}-08-26`,
    lines: [
      { id: 'pil_1', description: 'Studio design & build supervision', qty: 1, rate: 4500 },
      { id: 'pil_2', description: 'Equipment installation (spinners ×12)', qty: 12, rate: 85 },
    ],
    taxRate: 5, notes: 'Milestone 1 of 3 — completion of build-out.',
    status: 'paid', subtotal: 5520, tax: 276, total: 5796,
  },
  {
    id: 'pinv_2', companyId: 'co_fitpro', number: `PINV-${year}-002`,
    projectId: 'pr_2', projectName: 'Osu Sauna & Steam Install', clientName: 'Kojo Mensah',
    invoiceDate: `${year}-08-28`, dueDate: `${year}-09-04`,
    lines: [
      { id: 'pil_3', description: 'Sauna cabin supply & install', qty: 1, rate: 7800 },
      { id: 'pil_4', description: 'Steam generator commissioning', qty: 2, rate: 260 },
    ],
    taxRate: 5, notes: 'Balance due on handover.',
    status: 'sent', subtotal: 8320, tax: 416, total: 8736,
  },
  {
    id: 'pinv_3', companyId: 'co_fitpro', number: `PINV-${year}-003`,
    projectId: 'pr_4', projectName: 'Legon Free-Weights Refit', clientName: 'Amara Cole',
    invoiceDate: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    lines: [
      { id: 'pil_5', description: 'Rubber flooring — supply & lay (m²)', qty: 120, rate: 38 },
    ],
    taxRate: 5, notes: 'Draft — pending client sign-off on measurements.',
    status: 'draft', subtotal: 4560, tax: 228, total: 4788,
  },
]

/* ── Load / save ────────────────────────────────────────────────────────── */

export function loadProjectInvoices(): ProjectInvoice[] {
  try {
    const raw = localStorage.getItem(PROJECT_INVOICES_KEY)
    if (raw) return JSON.parse(raw) as ProjectInvoice[]
  } catch { /* ignore */ }
  return SEED_PROJECT_INVOICES.map((i) => ({ ...i }))
}

export function saveProjectInvoices(list: ProjectInvoice[]) {
  try { localStorage.setItem(PROJECT_INVOICES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
