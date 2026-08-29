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
  }
}
