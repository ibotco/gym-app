import { useState } from 'react'
import { Printer, FileText, Plus, Pencil, Trash2, Receipt , X} from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, Select, Empty, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { nextInvoiceNumber, resolveInvoiceScheme, effectiveSequence } from '../../lib/invoiceScheme'
import { normalizeHex, readableInk } from '../../lib/color'
import type { Invoice, InvoiceItem, InvoiceStatus } from '../../types'

type LineDraft = { desc: string; qty: string; unitPrice: string }
type FormState = {
  id?: string
  number: string
  customerType: 'member' | 'walkin'
  memberId: string
  customerName: string
  issuedAt: string
  dueAt: string
  status: InvoiceStatus
  lines: LineDraft[]
}

const blank = (number: string): FormState => ({
  number,
  customerType: 'walkin',
  memberId: '',
  customerName: '',
  issuedAt: new Date().toISOString().slice(0, 10),
  dueAt: new Date().toISOString().slice(0, 10),
  status: 'unpaid',
  lines: [{ desc: '', qty: '1', unitPrice: '' }],
})

export function Invoices() {
  const { invoices, members, users, company, setCompany, upsertInvoice, deleteInvoice, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Invoice | null>(null)

  const rows = [...invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  const invoice = invoices.find((i) => i.id === openId)

  const billTo = (memberId?: string, customerName?: string) => {
    if (customerName) return customerName
    const m = members.find((x) => x.id === memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || memberId : 'Walk-in customer'
  }

  const nextNumber = () => nextInvoiceNumber(resolveInvoiceScheme(company?.invoiceScheme))

  // Invoice document theme (Settings → Invoice scheme → Invoice theme)
  const invTheme = resolveInvoiceScheme(company?.invoiceScheme).theme || 'classic'
  const brand = normalizeHex(company?.brandPrimary || '#C8F542')
  const ink = readableInk(brand)

  const openNew = () => setEditing(blank(nextNumber()))

  const openEdit = (inv: Invoice) => {
    setEditing({
      id: inv.id,
      number: inv.number,
      customerType: inv.memberId ? 'member' : 'walkin',
      memberId: inv.memberId || '',
      customerName: inv.customerName || '',
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      status: inv.status,
      lines: inv.items.map((it) => ({
        desc: it.desc,
        qty: it.qty != null ? String(it.qty) : '1',
        unitPrice: it.unitPrice != null ? String(it.unitPrice) : String(it.amount),
      })),
    })
  }

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Invoice number is required.'); return }
    const lines: InvoiceItem[] = editing.lines
      .map((l) => {
        const qty = Number(l.qty) || 1
        const unit = Number(l.unitPrice)
        if (!l.desc.trim() || !Number.isFinite(unit)) return null
        return { desc: l.desc.trim(), qty, unitPrice: unit, amount: qty * unit } as InvoiceItem
      })
      .filter((l): l is InvoiceItem => l != null)
    if (!lines.length) { toast.error('Add at least one line with a description and amount.'); return }

    const total = lines.reduce((s, l) => s + l.amount, 0)
    const isNew = !editing.id
    const record: Invoice = {
      id: editing.id || uid('inv'),
      memberId: editing.customerType === 'member' ? editing.memberId || undefined : undefined,
      customerName: editing.customerType === 'walkin' ? editing.customerName.trim() || 'Walk-in customer' : undefined,
      number: editing.number.trim(),
      items: lines,
      total,
      status: editing.status,
      issuedAt: editing.issuedAt,
      dueAt: editing.dueAt || editing.issuedAt,
    }
    upsertInvoice(record)
    if (isNew) {
      // Consume the scheme's next number when this invoice used it.
      const scheme = resolveInvoiceScheme(company?.invoiceScheme)
      if (record.number === nextInvoiceNumber(scheme)) {
        const seq = effectiveSequence(scheme)
        setCompany({ ...company, invoiceScheme: { ...scheme, nextNumber: seq.number + 1, year: seq.year } })
      }
    }
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Invoice', `${isNew ? 'Created' : 'Updated'} ${record.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? 'Invoice created' : 'Invoice updated', record.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteInvoice(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Invoice', `Deleted ${deleting.number}`)
    toast.success('Invoice deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        desc="Every invoice issued — sales, renewals, and manual charges."
        actions={<Button onClick={openNew}><Plus className="size-4" /> New invoice</Button>}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Bill to</th><th>Issued</th><th>Items</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-sm font-semibold">{i.number}</td>
                <td>{billTo(i.memberId, i.customerName)}</td>
                <td className="text-mist">{formatDate(i.issuedAt)}</td>
                <td className="text-mist">{i.items.length}</td>
                <td>{formatGhsExact(i.total)}</td>
                <td><StatusBadge status={i.status} /></td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="View invoice" onClick={() => setOpenId(i.id)}><FileText className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit invoice" onClick={() => openEdit(i)}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete invoice" onClick={() => setDeleting(i)}><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No invoices yet" desc="Invoices are created when a sale or charge is recorded." />}
      </div>

      {/* View invoice */}
      <Modal open={!!invoice} onClose={() => setOpenId(null)} title={invoice?.number || 'Invoice'} wide>
        {invoice && (() => {
          const banded = invTheme === 'modern' || invTheme === 'bold'
          const wrapCls = invTheme === 'bold'
            ? 'rounded-xl bg-white p-5 text-sm text-zinc-900 ring-2 ring-zinc-900'
            : invTheme === 'modern'
              ? 'rounded-xl bg-white p-5 text-sm text-zinc-900 ring-1'
              : invTheme === 'minimal'
                ? 'bg-white px-6 py-7 text-sm text-zinc-900'
                : 'rounded-xl bg-white p-5 text-sm text-zinc-900'
          const headCls = banded
            ? '-m-5 mb-4 flex items-start justify-between gap-4 rounded-t-xl px-5 py-4'
            : invTheme === 'minimal'
              ? 'flex items-start justify-between gap-4 border-b border-zinc-200 pb-4'
              : 'flex items-start justify-between gap-4'
          const headStyle = invTheme === 'modern' ? { background: brand, color: ink } : invTheme === 'bold' ? { background: '#18181b', color: '#fafafa' } : undefined
          const tableWrapCls = invTheme === 'bold'
            ? 'mt-4 overflow-hidden rounded-lg border-2 border-zinc-900'
            : invTheme === 'modern'
              ? 'mt-4 overflow-hidden rounded-lg border'
              : invTheme === 'classic'
                ? 'mt-4 overflow-hidden rounded-lg border border-zinc-200'
                : 'mt-4 border-b border-zinc-200'
          const tableWrapStyle = invTheme === 'modern' ? { borderColor: `${brand}59` } : undefined
          const theadCls = invTheme === 'bold'
            ? 'bg-zinc-900 text-left uppercase tracking-wide text-white'
            : invTheme === 'minimal'
              ? 'text-left text-[10px] uppercase tracking-[0.16em] text-zinc-400'
              : 'bg-zinc-100 text-left uppercase tracking-wide text-zinc-500'
          const theadStyle = invTheme === 'modern' ? { background: `${brand}1f`, color: '#3f3f46' } : undefined
          const totalCls = invTheme === 'bold'
            ? 'flex w-48 justify-between border-t-2 border-zinc-900 pt-2 text-base font-bold'
            : invTheme === 'minimal'
              ? 'flex w-48 justify-between border-t border-zinc-200 pt-2 text-sm font-medium'
              : 'flex w-48 justify-between border-t border-zinc-300 pt-2 text-base font-bold'
          const totalStyle = invTheme === 'modern' ? { borderTop: `2px solid ${brand}` } : undefined
          return (
          <div className="space-y-3">
            <div id="invoice-print" className={wrapCls}>
              <div className={headCls} style={headStyle}>
                <div>
                  <p className={invTheme === 'minimal' ? 'font-display text-base font-semibold uppercase tracking-[0.18em]' : 'font-display text-lg font-bold'}>{company.name}</p>
                  {banded ? (
                    <p className="mt-1 text-xs opacity-80">{company.address} · TIN {company.taxId}</p>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">{company.address}</p>
                      <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className={invTheme === 'minimal' ? 'text-[10px] uppercase tracking-[0.2em] text-zinc-400' : 'font-bold uppercase tracking-wide'}>Invoice</p>
                  {invTheme === 'bold' ? (
                    <p className="mt-1 inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold" style={{ background: brand, color: ink }}>{invoice.number}</p>
                  ) : (
                    <p className="mt-0.5 font-mono text-xs">{invoice.number}</p>
                  )}
                  <p className={`mt-1 text-xs ${banded ? 'opacity-80' : 'text-zinc-500'}`}>{formatDate(invoice.issuedAt)}</p>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Bill to:</span> {billTo(invoice.memberId, invoice.customerName)}</p>
                <p className="mt-1"><span className="font-semibold">Due:</span> {formatDate(invoice.dueAt)}</p>
              </div>

              <div className={tableWrapCls} style={tableWrapStyle}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={theadCls} style={theadStyle}>
                      <th className="px-3 py-2">Item</th>
                      {invoice.items.some((it) => it.qty != null) && <th className="px-3 py-2 text-right">Qty</th>}
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{it.desc}</td>
                        {invoice.items.some((x) => x.qty != null) && (
                          <td className="px-3 py-2 text-right">{it.qty != null ? `${it.qty}${it.unitPrice != null ? ` × ${formatGhsExact(it.unitPrice)}` : ''}` : ''}</td>
                        )}
                        <td className="px-3 py-2 text-right">{formatGhsExact(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <div className={totalCls} style={totalStyle}>
                  <span>Total</span>
                  <span style={invTheme === 'modern' || invTheme === 'bold' ? { color: brand } : undefined}>{formatGhsExact(invoice.total)}</span>
                </div>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
            </div>
          </div>
          )
        })()}
      </Modal>

      {/* Add / edit invoice */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit invoice' : 'New invoice'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice number" required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as InvoiceStatus })}>
                  <option value="unpaid">unpaid</option>
                  <option value="paid">paid</option>
                  <option value="overdue">overdue</option>
                  <option value="cancelled">cancelled</option>
                </Select>
              </Field>
              <Field label="Customer">
                <Select value={editing.customerType} onChange={(e) => setEditing({ ...editing, customerType: e.target.value as 'member' | 'walkin' })}>
                  <option value="walkin">Walk-in customer</option>
                  <option value="member">Member</option>
                </Select>
              </Field>
              {editing.customerType === 'member' ? (
                <Field label="Member">
                  <Select value={editing.memberId} onChange={(e) => setEditing({ ...editing, memberId: e.target.value })}>
                    <option value="">Select member…</option>
                    {members.map((m) => {
                      const u = users.find((x) => x.id === m.userId)
                      return <option key={m.id} value={m.id}>{u?.name}</option>
                    })}
                  </Select>
                </Field>
              ) : (
                <Field label="Customer name"><Input value={editing.customerName} onChange={(e) => setEditing({ ...editing, customerName: e.target.value })} placeholder="Walk-in customer" /></Field>
              )}
              <Field label="Issue date"><DatePicker value={editing.issuedAt} onChange={(v) => setEditing({ ...editing, issuedAt: v })} /></Field>
              <Field label="Due date"><DatePicker value={editing.dueAt} onChange={(v) => setEditing({ ...editing, dueAt: v })} /></Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Line items</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { desc: '', qty: '1', unitPrice: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_64px_110px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_110px_40px] items-center gap-2">
                    <Input value={l.desc} placeholder="Item description" onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) })} />
                    <Input aria-label="Quantity" type="number" min={1} value={l.qty} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} />
                    <Input aria-label="Unit price" type="number" min={0} value={l.unitPrice} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x) })} />
                    <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, j) => j !== i) })}><X className="size-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Total</p>
              <p className="font-display text-lg">
                {formatGhsExact(editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Receipt className="size-4" /> {editing.id ? 'Save invoice' : 'Create invoice'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete invoice */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete invoice?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete invoice <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
