import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Send, Truck , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { SHIPMENT_STATUSES, nextShipmentNumber } from '../../lib/shipments'
import type { InvoiceItem, Shipment } from '../../types'

type LineDraft = { desc: string; qty: string; unitPrice: string }

function tone(status: string): 'zinc' | 'sky' | 'violet' | 'lime' | 'rose' {
  if (status === 'preparing') return 'zinc'
  if (status === 'shipped') return 'sky'
  if (status === 'in_transit') return 'violet'
  if (status === 'delivered') return 'lime'
  return 'rose'
}

const statusLabel = (s: string) => s.replace(/_/g, ' ')

export function Shipments() {
  const app = useApp()
  const { shipments, salesOrders, members, users, company, upsertShipment, deleteShipment, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    id?: string; number: string; salesOrderId: string; customerType: 'member' | 'walkin'; memberId: string; customerName: string
    carrier: string; trackingNumber: string; status: string; date: string; deliveryDate: string; notes: string; lines: LineDraft[]
  } | null>(null)
  const [deleting, setDeleting] = useState<Shipment | null>(null)

  const rows = [...shipments].sort((a, b) => b.date.localeCompare(a.date))
  const open = shipments.find((s) => s.id === openId)

  const billTo = (s: Shipment) => {
    if (s.customerName) return s.customerName
    const m = members.find((x) => x.id === s.memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || s.memberId : 'Walk-in customer'
  }

  const openNew = () => setEditing({
    number: nextShipmentNumber(shipments),
    salesOrderId: '', customerType: 'walkin', memberId: '', customerName: '',
    carrier: '', trackingNumber: '', status: 'preparing',
    date: new Date().toISOString().slice(0, 10), deliveryDate: '', notes: '',
    lines: [{ desc: '', qty: '1', unitPrice: '' }],
  })

  const openEdit = (s: Shipment) => setEditing({
    id: s.id, number: s.number, salesOrderId: s.salesOrderId || '',
    customerType: s.memberId ? 'member' : 'walkin', memberId: s.memberId || '', customerName: s.customerName || '',
    carrier: s.carrier || '', trackingNumber: s.trackingNumber || '', status: s.status,
    date: s.date, deliveryDate: s.deliveryDate || '', notes: s.notes || '',
    lines: s.items.map((it) => ({ desc: it.desc, qty: it.qty != null ? String(it.qty) : '1', unitPrice: it.unitPrice != null ? String(it.unitPrice) : String(it.amount) })),
  })

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Shipment number is required.'); return }
    const items: InvoiceItem[] = editing.lines
      .map((l) => {
        const qty = Number(l.qty) || 1
        const unit = Number(l.unitPrice)
        if (!l.desc.trim() || !Number.isFinite(unit)) return null
        return { desc: l.desc.trim(), qty, unitPrice: unit, amount: qty * unit } as InvoiceItem
      })
      .filter((l): l is InvoiceItem => l != null)
    if (!items.length) { toast.error('Add at least one line with a description and amount.'); return }

    const total = items.reduce((s, l) => s + l.amount, 0)
    const isNew = !editing.id
    const rec: Shipment = {
      id: editing.id || uid('sh'),
      number: editing.number.trim(),
      salesOrderId: editing.salesOrderId || undefined,
      memberId: editing.customerType === 'member' ? editing.memberId || undefined : undefined,
      customerName: editing.customerType === 'walkin' ? editing.customerName.trim() || 'Walk-in customer' : undefined,
      carrier: editing.carrier.trim() || undefined,
      trackingNumber: editing.trackingNumber.trim() || undefined,
      items,
      total,
      status: editing.status as Shipment['status'],
      notes: editing.notes.trim() || undefined,
      date: editing.date,
      deliveryDate: editing.deliveryDate || undefined,
      createdAt: isNew ? new Date().toISOString() : (shipments.find((s) => s.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertShipment(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Shipment', `${isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? 'Shipment created' : 'Shipment updated', rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteShipment(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Shipment', `Deleted ${deleting.number}`)
    toast.success('Shipment deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Shipments"
        desc="Track delivery of sales orders and goods to customers."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New shipment</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Customer</th><th>Carrier</th><th>Tracking</th><th>Date</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-sm font-semibold">{s.number}</td>
                <td>{billTo(s)}</td>
                <td className="text-mist">{s.carrier || '—'}</td>
                <td className="text-mist">{s.trackingNumber || '—'}</td>
                <td className="text-mist">{formatDate(s.date)}</td>
                <td>{formatGhsExact(s.total)}</td>
                <td><Badge tone={tone(s.status)}>{statusLabel(s.status)}</Badge></td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="View shipment" onClick={() => setOpenId(s.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit shipment" onClick={() => openEdit(s)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete shipment" onClick={() => setDeleting(s)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No shipments yet" desc="Create your first shipment with the New button." />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Shipment'} wide>
        {open && (
          <div className="space-y-3">
            <div id="ship-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Shipment</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {open.deliveryDate && <p className="text-xs text-zinc-500">Delivery {formatDate(open.deliveryDate)}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Ship to:</span> {billTo(open)}</p>
                {open.carrier && <p><span className="font-semibold">Carrier:</span> {open.carrier}</p>}
                {open.trackingNumber && <p><span className="font-semibold">Tracking:</span> {open.trackingNumber}</p>}
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{it.desc}</td>
                        <td className="px-3 py-2 text-right">{it.qty != null ? `${it.qty}${it.unitPrice != null ? ` × ${formatGhsExact(it.unitPrice)}` : ''}` : ''}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(it.amount)}</td>
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit shipment' : 'New shipment'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shipment number" required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </Select>
              </Field>
              <Field label="Sales order (optional)">
                <Select value={editing.salesOrderId} onChange={(e) => setEditing({ ...editing, salesOrderId: e.target.value })}>
                  <option value="">None</option>
                  {salesOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
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
              <Field label="Carrier"><Input value={editing.carrier} onChange={(e) => setEditing({ ...editing, carrier: e.target.value })} placeholder="e.g. DHL Express" /></Field>
              <Field label="Tracking number"><Input value={editing.trackingNumber} onChange={(e) => setEditing({ ...editing, trackingNumber: e.target.value })} placeholder="Optional" /></Field>
              <Field label="Ship date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Delivery date (optional)"><DatePicker value={editing.deliveryDate} onChange={(v) => setEditing({ ...editing, deliveryDate: v })} /></Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Line items</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { desc: '', qty: '1', unitPrice: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_64px_110px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Description</span><span>Qty</span><span>Unit price</span><span />
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

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Total</p>
              <p className="font-display text-lg">{formatGhsExact(editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Send className="size-4" /> {editing.id ? 'Save shipment' : 'Create shipment'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete shipment?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete shipment <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
