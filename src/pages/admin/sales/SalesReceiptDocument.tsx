import { formatGhsExact } from '../../../lib/utils'
import type { CompanySettings, InventoryItem, Sale } from '../../../types'

function saleTotals(sale: Sale) {
  const grossSubtotal = sale.lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice), 0)
  const lineDiscountTotal = sale.lines.reduce((sum, line) => sum + Math.max(0, line.discount || 0), 0)
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscountTotal)
  const details = sale.details
  const discountAmount = Math.max(0, details?.discountAmount || 0)
  const orderDiscount = Math.min(
    netSubtotal,
    details?.discountType === 'percentage' ? netSubtotal * discountAmount / 100 : discountAmount,
  )
  // Coupons redeemed in Add Sale reduce the taxable base before tax applies.
  const couponBase = Math.max(0, netSubtotal - orderDiscount)
  const couponDiscount = Math.min(couponBase, Math.max(0, details?.couponDiscount || 0))
  const taxableSubtotal = Math.max(0, couponBase - couponDiscount)
  // PRODUCT mode: the tax total is the sum of every line's taxes; GLOBAL keeps the rate math.
  const orderTax = details?.taxMode === 'PRODUCT'
    ? sale.lines.reduce((sum, line) => sum + Math.max(0, line.taxTotal || 0), 0)
    : taxableSubtotal * Math.max(0, details?.orderTaxRate || 0) / 100
  const shippingCharges = Math.max(0, details?.shippingCharges || 0)
  const expenseTotal = (details?.additionalExpenses || []).reduce((sum, expense) => sum + Math.max(0, expense.amount), 0)
  return { grossSubtotal, lineDiscountTotal, orderDiscount, couponDiscount, orderTax, shippingCharges, expenseTotal, total: sale.total }
}


export function SalesReceiptDocument({receipt,company,itemOf,memberName,receiptTender}:{receipt:Sale;company:CompanySettings;itemOf:(id:string)=>InventoryItem | undefined;memberName:(id?:string)=>string | undefined;receiptTender?:{amount:number;change:number}|null}) {
  const receiptTotals = saleTotals(receipt)
  return receipt ? (
            <div className="bg-white text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Sales Receipt</p>
                  <p className="text-xs text-zinc-500">Sale No: {receipt.number}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-between text-xs text-zinc-600">
                <div>
                  <p className="font-semibold">Customer</p>
                  <p>{receipt.memberId ? memberName(receipt.memberId) : receipt.customerName || 'Walk-in customer'}</p>
                </div>
                <div className="text-right">
                  <p><span className="font-semibold">Date:</span> {receipt.date || receipt.createdAt.slice(0, 10)}</p>
                  <p><span className="font-semibold">Paid via:</span> {receipt.method}</p>
                  {receipt.status === 'refunded' && <p className="font-bold text-red-700">Sale status: Refunded</p>}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.map((l) => (
                      <tr key={l.itemId} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemOf(l.itemId)?.name || l.itemId}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(Math.max(0, l.quantity * l.unitPrice - (l.discount || 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <div className="w-56 space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span><span>{formatGhsExact(receiptTotals?.grossSubtotal || 0)}</span>
                  </div>
                  {(receiptTotals?.lineDiscountTotal || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Line discount</span><span>−{formatGhsExact(receiptTotals?.lineDiscountTotal || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.orderDiscount || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount{receipt.details?.discountName ? ` — ${receipt.details.discountName}` : ''}{receipt.details?.discountCode ? ` (${receipt.details.discountCode})` : ''}</span><span>−{formatGhsExact(receiptTotals?.orderDiscount || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.couponDiscount || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Coupon{receipt.details?.couponName ? ` — ${receipt.details.couponName}` : ''}{receipt.details?.couponCode ? ` (${receipt.details.couponCode})` : ''}</span><span>−{formatGhsExact(receiptTotals?.couponDiscount || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.orderTax || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>{receipt.details?.taxName || 'Tax'}</span><span>+{formatGhsExact(receiptTotals?.orderTax || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.shippingCharges || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Shipping</span><span>+{formatGhsExact(receiptTotals?.shippingCharges || 0)}</span>
                    </div>
                  )}
                  {(receiptTotals?.expenseTotal || 0) > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Additional expenses</span><span>+{formatGhsExact(receiptTotals?.expenseTotal || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-300 pt-1 text-base font-bold">
                    <span>Total</span><span>{formatGhsExact(receipt.total)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-700"><span>Recorded payment</span><span>{receipt.details?.payment && Number.isFinite(receipt.details.payment.amount) ? formatGhsExact(receipt.details.payment.amount) : 'Not recorded'}</span></div>
                  {receiptTender && <><div className="flex justify-between text-zinc-700"><span>Cash tendered</span><span>{formatGhsExact(receiptTender.amount)}</span></div><div className="flex justify-between text-zinc-700"><span>Change</span><span>{formatGhsExact(receiptTender.change)}</span></div></>}
                </div>
              </div>
            </div>
  ) : null

}
