import { bcp47Of } from './registry'

/**
 * Locale-aware Intl formatting. All helpers take the app locale id
 * ('en', 'pt-br', 'ar', …) and format according to its BCP-47 tag.
 */
export interface Formatters {
  date: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string
  time: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string
  dateTime: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string
  number: (n: number, opts?: Intl.NumberFormatOptions) => string
  currency: (n: number, currency?: string, opts?: Intl.NumberFormatOptions) => string
  weekday: (d: Date | string, style?: 'long' | 'short' | 'narrow') => string
  month: (d: Date | string, style?: 'long' | 'short' | 'narrow') => string
  plural: (n: number) => string
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d))

export function makeFormatters(localeId: string): Formatters {
  const bcp = bcp47Of(localeId)
  const safe = <T,>(fn: () => T, fallback: () => T) => { try { return fn() } catch { return fallback() } }
  return {
    date: (d, opts) => safe(
      () => new Intl.DateTimeFormat(bcp, opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(d)),
      () => toDate(d).toISOString().slice(0, 10),
    ),
    time: (d, opts) => safe(
      () => new Intl.DateTimeFormat(bcp, opts || { hour: '2-digit', minute: '2-digit' }).format(toDate(d)),
      () => toDate(d).toTimeString().slice(0, 5),
    ),
    dateTime: (d, opts) => safe(
      () => new Intl.DateTimeFormat(bcp, opts || { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(toDate(d)),
      () => toDate(d).toLocaleString(),
    ),
    number: (n, opts) => safe(
      () => new Intl.NumberFormat(bcp, opts).format(n),
      () => String(n),
    ),
    currency: (n, currency = 'GHS', opts) => safe(
      () => new Intl.NumberFormat(bcp, { style: 'currency', currency, ...opts }).format(n),
      () => `${currency} ${n.toFixed(2)}`,
    ),
    weekday: (d, style = 'short') => safe(
      () => new Intl.DateTimeFormat(bcp, { weekday: style }).format(toDate(d)),
      () => toDate(d).toDateString().slice(0, 3),
    ),
    month: (d, style = 'short') => safe(
      () => new Intl.DateTimeFormat(bcp, { month: style }).format(toDate(d)),
      () => toDate(d).toDateString().slice(4, 7),
    ),
    plural: (n) => safe(() => new Intl.PluralRules(bcp).select(n), () => (n === 1 ? 'one' : 'other')),
  }
}
