// Invoice numbering scheme (Settings → Company settings → Invoice scheme).
// Formats the next invoice number from the company's scheme, Perfex-style:
// prefix + zero-padded number + optional year + optional suffix.

import type { InvoiceScheme, InvoiceTheme } from '../types'

export const DEFAULT_INVOICE_SCHEME: InvoiceScheme = {
  prefix: 'INV-',
  nextNumber: 1,
  padding: 0,
  separator: '-',
  format: 'number',
  suffix: '',
  resetYearly: false,
  theme: 'classic',
}

/** Selectable invoice document themes (Settings → Invoice scheme → Invoice theme). */
export const INVOICE_THEMES: { id: InvoiceTheme; name: string; desc: string }[] = [
  { id: 'classic', name: 'Classic', desc: 'Clean white document with grey rules.' },
  { id: 'modern', name: 'Modern', desc: 'Brand-coloured header band and accents.' },
  { id: 'bold', name: 'Bold', desc: 'Dark header block, heavy contrast.' },
  { id: 'minimal', name: 'Minimal', desc: 'Borderless, airy, hairline rules only.' },
]

/** Merge a stored scheme over the defaults so new fields stay safe. */
export function resolveInvoiceScheme(scheme?: InvoiceScheme | null): InvoiceScheme {
  return { ...DEFAULT_INVOICE_SCHEME, ...(scheme || {}) }
}

/** The number/year the next invoice will actually use, honouring the yearly reset. */
export function effectiveSequence(scheme: InvoiceScheme, today = new Date()): { number: number; year: number } {
  const year = today.getFullYear()
  if (scheme.resetYearly && scheme.year && scheme.year !== year) return { number: 1, year }
  return { number: Math.max(1, scheme.nextNumber || 1), year: scheme.year || year }
}

/** Build the display number for `number` under `scheme` (year defaults to the effective one). */
export function formatInvoiceNumber(scheme: InvoiceScheme, number: number, year?: number): string {
  const padded = String(number).padStart(Math.max(0, Math.min(10, scheme.padding || 0)), '0')
  const sep = scheme.separator || ''
  const fullYear = String(year ?? effectiveSequence(scheme).year)
  const y = scheme.yearFormat === 'short' ? fullYear.slice(-2) : fullYear
  let body = padded
  if (scheme.format === 'number-year') body = `${padded}${sep}${y}`
  else if (scheme.format === 'year-number') body = `${y}${sep}${padded}`
  return `${scheme.prefix}${body}${scheme.suffix || ''}`
}

/** Convenience: the next number for a scheme, ready to display or assign. */
export function nextInvoiceNumber(scheme: InvoiceScheme, today = new Date()): string {
  const seq = effectiveSequence(scheme, today)
  return formatInvoiceNumber(scheme, seq.number, seq.year)
}

/** The next `count` numbers the scheme will generate, for previews. */
export function upcomingInvoiceNumbers(scheme: InvoiceScheme, count = 5, today = new Date()): string[] {
  const seq = effectiveSequence(scheme, today)
  return Array.from({ length: Math.max(1, count) }, (_, i) => formatInvoiceNumber(scheme, seq.number + i, seq.year))
}
