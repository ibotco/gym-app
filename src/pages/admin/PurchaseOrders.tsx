import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Send , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { PURCHASE_ORDER_STATUSES, nextPurchaseOrderNumber } from '../../lib/inventory'
import type { PurchaseLine, PurchaseOrder } from '../../types'

type LineDraft = { itemId: string; qty: string; unitCost: string }

function tone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' {
  if (status === 'draft') return 'zinc'
  if (status === 'ordered') return 'sky'
  if (status === 'received') return 'lime'
  return 'rose'
}

export function PurchaseOrders() {
  const app = useApp()
  const { purchaseOrders, inventory, suppliers, company, upsertPurchaseOrder, deletePurchaseOrder, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    id?: string; number: string; supplierId: string; status: string; date: string; expectedDate: string; notes: string; lines: LineDraft[]
  } | null>(null)
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null)

  const rows = [...purchaseOrders].sort((a, b) => b.date.localeCompare(a.date))
  const open = purchaseOrders.find((o) => o.id === openId)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id

  const openNew = () => setEditing({
    number: nextPurchaseOrderNumber(purchaseOrders),
    supplierId: suppliers[0]?.id || '',
    status: 'draft', date: new Date().toISOString().slice(0, 10), expectedDate: '', notes: '',
    lines: [{ itemId: '', qty: '1', unitCost: '' }],
  })

  const openEdit = (o: PurchaseOrder) => setEditing({
    id: o.id, number: o.number, supplierId: o.supplierId,
    status: o.status, date: o.date, expectedDate: o.expectedDate || '', notes: o.notes || '',
    lines: o.lines.map((l) => ({ itemId: l.itemId, qty: String(l.quantity), unitCost: String(l.unitCost) })),
  })

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Order number is required.'); return }
    if (!editing.supplierId) { toast.error('Select a supplier.'); return }
    const lines: PurchaseLine[] = editing.lines
      .map((l) => {
        const qty = Number(l.qty) || 1
        const cost = Number(l.unitCost)
        if (!l.itemId || !Number.isFinite(cost)) return null
        return { itemId: l.itemId, quantity: qty, unitCost: cost }
      })
      .filter((l): l is PurchaseLine => l != null)
    if (!lines.length) { toast.error('Add at least one line with an item and cost.'); return }

    const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)
    const isNew = !editing.id
    const rec: PurchaseOrder = {
      id: editing.id || uid('poo'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      lines,
      total,
      status: editing.status as PurchaseOrder['status'],
      notes: editing.notes.trim() || undefined,
      date: editing.date,
      expectedDate: editing.expectedDate || undefined,
      createdAt: isNew ? new Date().toISOString() : (purchaseOrders.find((o) => o.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertPurchaseOrder(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Purchase Order', `${isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? 'Purchase order created' : 'Purchase order updated', rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deletePurchaseOrder(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Order', `Deleted ${deleting.number}`)
    toast.success('Purchase order deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        desc="Orders placed with suppliers, before goods are received."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New purchase order</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Supplier</th><th>Date</th><th>Expected</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-sm font-semibold">{o.number}</td>
                <td>{supplierName(o.supplierId)}</td>
                <td className="text-mist">{formatDate(o.date)}</td>
                <td className="text-mist">{o.expectedDate ? formatDate(o.expectedDate) : '—'}</td>
                <td>{formatGhsExact(o.total)}</td>
                <td><Badge tone={tone(o.status)}>{o.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="View purchase order" onClick={() => setOpenId(o.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit purchase order" onClick={() => openEdit(o)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete purchase order" onClick={() => setDeleting(o)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No purchase orders yet" desc="Create your first purchase order with the New button." />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase order'} wide>
        {open && (
          <div className="space-y-3">
            <div id="po-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Purchase Order</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {open.expectedDate && <p className="text-xs text-zinc-500">Expected {formatDate(open.expectedDate)}</p>}
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit cost</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemName(l.itemId)}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.quantity * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit purchase order' : 'New purchase order'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Order number" required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {PURCHASE_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Supplier" required>
                <Select value={editing.supplierId} onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })}>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Order date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Expected date (optional)"><DatePicker value={editing.expectedDate} onChange={(v) => setEditing({ ...editing, expectedDate: v })} /></Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Line items</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { itemId: '', qty: '1', unitCost: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_64px_110px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Item</span><span>Qty</span><span>Unit cost</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_110px_40px] items-center gap-2">
                    <Select className="min-w-0" value={l.itemId} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, itemId: e.target.value, unitCost: x.unitCost || String(inventory.find((it) => it.id === e.target.value)?.costPrice || '') } : x) })}>
                      <option value="">Select item…</option>
                      {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </Select>
                    <Input aria-label="Quantity" type="number" min={1} value={l.qty} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} />
                    <Input aria-label="Unit cost" type="number" min={0} value={l.unitCost} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => j === i ? { ...x, unitCost: e.target.value } : x) })} />
                    <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, j) => j !== i) })}><X className="size-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Total</p>
              <p className="font-display text-lg">{formatGhsExact(editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0))}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Send className="size-4" /> {editing.id ? 'Save purchase order' : 'Create purchase order'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete purchase order?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete purchase order <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
