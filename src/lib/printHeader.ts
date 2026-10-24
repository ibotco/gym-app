import type { CompanySettings, PrintHeaderSettings } from '../types'
import { DEFAULT_PRINT_HEADER } from '../data/seed'

/**
 * The effective print header for a company: the text header fields are ALWAYS
 * synced from the company global settings (single source of truth), while the
 * header type, image and footer are the saved print-header configuration.
 */
export function effectivePrintHeader(company: CompanySettings): PrintHeaderSettings {
  const s = company.printHeader
  return {
    headerType: s?.headerType || 'text',
    headerImage: s?.headerImage,
    companyName: company.name,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyWebsite: company.webAddress || '',
    taxId: company.taxId || '',
    footerContent: s?.footerContent || DEFAULT_PRINT_HEADER.footerContent,
    paperSize: s?.paperSize || 'a4',
    customWidthMm: s?.customWidthMm ?? 210,
    customHeightMm: s?.customHeightMm ?? 297,
  }
}

/** Physical sheet size in mm for the printed sale receipt. */
export function receiptPageMm(ph: PrintHeaderSettings): { w: number; h: number; thermal: boolean } {
  switch (ph.paperSize) {
    case 'a5':
      return { w: 148, h: 210, thermal: false }
    case '80mm':
      return { w: 80, h: 297, thermal: true }
    case '58mm':
      return { w: 58, h: 297, thermal: true }
    case 'custom': {
      const w = Math.max(20, Math.round(Number(ph.customWidthMm) || 210))
      const h = Math.max(20, Math.round(Number(ph.customHeightMm) || 297))
      return { w, h, thermal: w < 120 }
    }
    default:
      return { w: 210, h: 297, thermal: false }
  }
}
