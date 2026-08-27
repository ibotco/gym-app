import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Send , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { SALES_RETURN_STATUSES, nextSalesReturnNumber } from '../../lib/salesReturns'
import type { SalesReturn, SaleLine } from '../../types'

type LineDraft = { itemId: string; qty: string; unitPrice: string }

function tone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' {
  if (status === 'draft') return 'zinc'
  if (status === 'returned') return 'sky'
  if (status === 'refunded') return 'lime'
  return 'rose'
}

export function SalesReturns() {
  const app = useApp()
  const { salesReturns, sales, inventory, members, users, company, upsertSalesReturn, deleteSalesReturn, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    id?: string; number: string; saleId: string; customerType: 'member' | 'walkin'; memberId: string; customerName: string
    status: string; date: string; reason: string; lines: LineDraft[]
  } | null>(null)
  const [deleting, setDeleting] = useState<SalesReturn | null>(null)

  const rows = [...salesReturns].sort((a, b) => b.date.localeCompare(a.date))
  const open = salesReturns.find((r) => r.id === openId)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const billTo = (r: SalesReturn) => {
    if (r.customerName) return r.customerName
    const m = members.find((x) => x.id === r.memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || r.memberId : 'Walk-in customer'
  }

  const openNew = () => setEditing({
    number: nextSalesReturnNumber(salesReturns),
    saleId: '', customerType: 'walkin', memberId: '', customerName: '',
    status: 'draft', date: new Date().toISOString().slice(0, 10), reason: '',
    lines: [{ itemId: '', qty: '1', unitPrice: '' }],
  })

  const openEdit = (r: SalesReturn) => setEditing({
    id: r.id, number: r.number, saleId: r.saleId || '',
    customerType: r.memberId ? 'member' : 'walkin', memberId: r.memberId || '', customerName: r.customerName || '',
    status: r.status, date: r.date, reason: r.reason || '',
    lines: r.lines.map((l) => ({ itemId: l.itemId, qty: String(l.quantity), unitPrice: String(l.unitPrice) })),
  })

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Return number is required.'); return }
    const lines: SaleLine[] = editing.lines
      .map((l) => {
        const qty = Number(l.qty) || 1
        const price = Number(l.unitPrice)
        if (!l.itemId || !Number.isFinite(price)) return null
        return { itemId: l.itemId, quantity: qty, unitPrice: price }
      })
      .filter((l): l is SaleLine => l != null)
    if (!lines.length) { toast.error('Add at least one line with an item and price.'); return }

    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const isNew = !editing.id
    const rec: SalesReturn = {
      id: editing.id || uid('sr'),
      number: editing.number.trim(),
      saleId: editing.saleId || undefined,
      memberId: editing.customerType === 'member' ? editing.memberId || undefined : undefined,
      customerName: editing.customerType === 'walkin' ? editing.customerName.trim() || 'Walk-in customer' : undefined,
      lines,
      total,
      status: editing.status as SalesReturn['status'],
      reason: editing.reason.trim() || undefined,
      date: editing.date,
      createdAt: isNew ? new Date().toISOString() : (salesReturns.find((r) => r.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertSalesReturn(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Sales Return', `${isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? 'Sales return created' : 'Sales return updated', rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteSalesReturn(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Sales Return', `Deleted ${deleting.number}`)
    toast.success('Sales return deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Sales returns"
        desc="Goods returned by customers for refund or replacement."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New sales return</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Customer</th><th>Sale</th><th>Date</th><th>Reason</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-sm font-semibold">{r.number}</td>
                <td>{billTo(r)}</td>
                <td className="text-mist">{r.saleId ? sales.find((s) => s.id === r.saleId)?.number || r.saleId : '—'}</td>
                <td className="text-mist">{formatDate(r.date)}</td>
                <td className="text-mist">{r.reason || '—'}</td>
                <td>{formatGhsExact(r.total)}</td>
                <td><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="View sales return" onClick={() => setOpenId(r.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit sales return" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete sales return" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No sales returns yet" desc="Create your first sales return with the New button." />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Sales return'} wide>
        {open && (
          <div className="space-y-3">
            <div id="sr-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Sales Return</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Customer:</span> {billTo(open)}</p>
                {open.saleId && <p className="mt-1"><span className="font-semibold">Original sale:</span> {sales.find((s) => s.id === open.saleId)?.number || open.saleId}</p>}
                {open.reason && <p className="mt-1"><span className="font-semibold">Reason:</span> {open.reason}</p>}
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit price</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemName(l.itemId)}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.quantity * l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <div className="flex w-48 justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                  <span>Total</span><span>{formatGhsExact(open.total)}</span>
                </div>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit sales return' : 'New sales return'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Return number" required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {SALES_RETURN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Original sale (optional)">
                <Select value={editing.saleId} onChange={(e) => setEditing({ ...editing, saleId: e.target.value })}>
                  <option value="">None</option>
                  {sales.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}
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
                <Field label="Customer name"><Input value={editing.customerName} onChange={(e) => setEditing({ ...editing, customerName: e.target.value })} placeholder="Customer name" /></Field>
              )}
              <Field label="Return date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Line items</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { itemId: '', qty: '1', unitPrice: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_64px_110px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Item</span><span>Qty</span><span>Unit price</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_110px_40px] items-center gap-2">
                    <Select className="min-w-0" value={l.itemId} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, itemId: e.target.value, unitPrice: x.unitPrice || String(inventory.find((it) => it.id === e.target.value)?.sellPrice || '') } : x) })}>
                      <option value="">Select item…</option>
                      {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </Select>
                    <Input aria-label="Quantity" type="number" min={1} value={l.qty} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} />
                    <Input aria-label="Unit price" type="number" min={0} value={l.unitPrice} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x) })} />
                    <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, j) => j !== i) })}><X className="size-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Reason"><Textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} rows={2} placeholder="e.g. Wrong item, damaged goods" /></Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Total</p>
              <p className="font-display text-lg">{formatGhsExact(editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Send className="size-4" /> {editing.id ? 'Save sales return' : 'Create sales return'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete sales return?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete sales return <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
