import type { Invoice, InvoiceItem } from '../types'
/** Match the invoice editor's defaults for legacy lines without saved quantity or price. */
export function invoicePrintItems(invoice:Invoice):InvoiceItem[] {
 return invoice.items.map(item=>({...item,qty:item.qty??1,unitPrice:item.unitPrice??item.amount}))
}
export function invoicePrintUsesDefaults(invoice:Invoice):boolean {
 return invoice.items.some(item=>item.qty==null||item.unitPrice==null)
}
