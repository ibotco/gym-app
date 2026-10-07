import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { userCompanyId } from '../lib/accessScope'

const SHEET_CSS = `
  #report-print-sheet { display: none; }
  @media print {
    #root { display: none !important; }
    #report-print-sheet { display: block; }
    /* Wide ledgers (multi-bank cash books, combined books) print on A4
       landscape via a named page — same pattern as the timetable sheet. */
    #report-print-sheet.rp-landscape { page: rp-landscape; }
    @page rp-landscape { size: A4 landscape; margin: 10mm; }
    /* Narrow margins: analysis cash books carry many analysis columns, so they
       print A4 landscape edge-to-edge with the paper margin cut to 6mm and the
       on-sheet padding trimmed to match. */
    #report-print-sheet.rp-landscape.rp-narrow { page: rp-landscape-narrow; }
    @page rp-landscape-narrow { size: A4 landscape; margin: 6mm; }
    #report-print-sheet.rp-narrow { padding: 10px 12px; }
    #report-print-sheet.rp-narrow .rp-head { padding-bottom: 14px; }
    #report-print-sheet.rp-narrow .rp-foot { margin-top: 14px; padding-top: 8px; }

    /* Fit-to-one-sheet ruled tables. The analysis cash books must never break
       into a second sheet or a "part 2": the table is fixed-layout at 100% of
       the printable width and the type steps down as columns are added, the
       way a hand-ruled book is written smaller to reach the last column. */
    #report-print-sheet .cb-fit {
      table-layout: fixed;
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    /* Ruling copied from the hand-ruled cash book: the COLUMN lines run the
       full height of the ledger, while horizontally only four rules are drawn
       (under the headings, above the totals, above and below Balance c/d).
       Data rows are left unruled, exactly as in the original book. */
    #report-print-sheet .cb-fit th,
    #report-print-sheet .cb-fit td {
      border-left: 1.6px solid #111 !important;
      border-right: 1.6px solid #111 !important;
      border-top: none !important;
      border-bottom: none !important;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
      padding: 2px 4px !important;
      line-height: 1.25;
    }
    /* Date / Particulars / Voucher No. keep a usable share; the value columns
       divide what is left evenly (fixed layout spreads them automatically). */
    #report-print-sheet .cb-fit th:nth-child(1) { width: 7%; }
    #report-print-sheet .cb-fit th:nth-child(2) { width: 16%; }
    #report-print-sheet .cb-fit th:nth-child(3) { width: 8%; }
    /* Readable ruled type. A4 landscape at 6mm margins leaves ~285mm of
       printable width, so even a 16-column book has room for ~10px text —
       the steps below stay legible instead of shrinking to fine print. */
    #report-print-sheet .cb-fit-lg { font-size: 12px; }
    #report-print-sheet .cb-fit-md { font-size: 11px; }
    #report-print-sheet .cb-fit-sm { font-size: 10px; }
    #report-print-sheet .cb-fit-xs { font-size: 9px; }
    #report-print-sheet .cb-fit-xs th,
    #report-print-sheet .cb-fit-xs td { padding: 1px 2px !important; }
    /* Headings carry the account names — keep them a touch stronger. */
    #report-print-sheet .cb-fit thead th {
      font-weight: 700;
      border-top: 1.2px solid #111 !important;
      border-bottom: 1.2px solid #111 !important;
    }
    /* The only horizontal rules in the body: above the totals block, and
       around the closing Balance c/d line. */
    #report-print-sheet .cb-fit tbody tr.cb-rule-top > * { border-top: 1.2px solid #111 !important; }
    #report-print-sheet .cb-fit tbody tr.cb-rule-bottom > * { border-bottom: 1.2px solid #111 !important; }
    /* Closing rules start AFTER the Date column (they skip the first cell)... */
    #report-print-sheet .cb-fit tbody tr.cb-rule-top-inset > *:not(:first-child) { border-top: 1.2px solid #111 !important; }
    #report-print-sheet .cb-fit tbody tr.cb-rule-bottom-inset > *:not(:first-child) { border-bottom: 1.2px solid #111 !important; }
    /* ...and the ledger's left edge closes at the end of the data rows, so the
       Date cell of every totals/closing row is left open. */
    #report-print-sheet .cb-fit tbody tr.cb-open-left > *:first-child { border-left: none !important; }
    /* Repeat the column headings if the ROWS (not the columns) run long. */
    #report-print-sheet .cb-fit thead { display: table-header-group; }
    #report-print-sheet .cb-fit tr { page-break-inside: avoid; }
  }
  #report-print-sheet { background: #fff; color: #16181d; padding: 40px 48px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
  #report-print-sheet .rp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 32px; }
  #report-print-sheet .rp-co { font-size: 24px; font-weight: 800; }
  #report-print-sheet .rp-line { margin-top: 6px; font-size: 12px; color: #333; }
  #report-print-sheet .rp-title { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-align: right; text-transform: uppercase; }
  #report-print-sheet .rp-sub { margin-top: 6px; font-size: 12px; color: #444; text-align: right; }
  /* No rule above the footer — the generated-on line sits on its own. */
  #report-print-sheet .rp-foot { margin-top: 32px; border-top: none; padding-top: 14px; text-align: center; color: #6b7280; font-size: 12px; }
`

/** Id of the style element that forces the paper orientation at print time. */
export const PAGE_ORIENTATION_STYLE_ID = 'rp-page-orientation'

/**
 * Force the browser's print dialog onto A4 landscape.
 *
 * The named `@page rp-landscape` rule is only honoured by browsers that
 * support named pages, and the app's global stylesheet also declares bare
 * `@page { size: A4 }` rules that win the cascade — so the preview opened in
 * portrait. Injecting an UNNAMED `@page` rule at the end of <head> right
 * before printing beats those rules, and browsers pick up the change from a
 * `beforeprint` handler, so Print (and Ctrl+P) open already rotated.
 */
function usePrintOrientation(active: boolean, margin: string) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const apply = () => {
      let el = document.getElementById(PAGE_ORIENTATION_STYLE_ID) as HTMLStyleElement | null
      if (!el) {
        el = document.createElement('style')
        el.id = PAGE_ORIENTATION_STYLE_ID
        document.head.appendChild(el) // last in <head> — highest precedence
      }
      el.textContent = `@page { size: A4 landscape; margin: ${margin}; }`
    }
    const clear = () => document.getElementById(PAGE_ORIENTATION_STYLE_ID)?.remove()
    // Applied up-front too: Chrome's preview can render before beforeprint
    // handlers settle when print() is called straight from a click.
    apply()
    window.addEventListener('beforeprint', apply)
    window.addEventListener('afterprint', clear)
    return () => {
      window.removeEventListener('beforeprint', apply)
      window.removeEventListener('afterprint', clear)
      clear()
    }
  }, [active, margin])
}

/**
 * Print-only document for accounting reports: company letterhead on the left,
 * report title on the right, the live report body between, and a generated-on
 * footer. On screen it is hidden; printing shows only this sheet.
 */
export function ReportPrintSheet({
  title,
  subtitle,
  landscape = false,
  narrowMargins = false,
  contactDetails = true,
  children,
}: {
  title: string
  subtitle?: string
  /** Print the sheet on A4 landscape (for wide multi-column ledgers). */
  landscape?: boolean
  /** Trim the paper margin to 6mm (analysis cash books need the extra width). */
  narrowMargins?: boolean
  /** Print the region/country/phone/email lines under the company name. */
  contactDetails?: boolean
  children: ReactNode
}) {
  usePrintOrientation(landscape, narrowMargins ? '6mm' : '10mm')
  const app = useApp()
  const { user } = useAuth()
  const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches))
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return createPortal(
    <>
      <style>{SHEET_CSS}</style>
      <div id="report-print-sheet" className={[landscape ? 'rp-landscape' : '', narrowMargins ? 'rp-narrow' : ''].filter(Boolean).join(' ') || undefined}>
        <div className="rp-head">
          <div>
            <div className="rp-co">{company?.name ?? 'Company'}</div>
            {company?.address && <div className="rp-line">{company.address}</div>}
            {contactDetails && company?.stateRegion && <div className="rp-line">{company.stateRegion}</div>}
            {contactDetails && company?.country && <div className="rp-line">{company.country}</div>}
            {contactDetails && company?.phone && <div className="rp-line">Phone: {company.phone}</div>}
            {contactDetails && company?.email && <div className="rp-line">Email: {company.email}</div>}
          </div>
          <div>
            <div className="rp-title">{title}</div>
            {subtitle && <div className="rp-sub">{subtitle}</div>}
          </div>
        </div>
        <div className="rp-body">{children}</div>
        <div className="rp-foot">Generated on {today}</div>
      </div>
    </>,
    document.body,
  )
}
