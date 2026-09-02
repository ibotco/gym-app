import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Send , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { PURCHASE_RETURN_STATUSES, nextPurchaseReturnNumber } from '../../lib/inventory'
import type { PurchaseLine, PurchaseReturn } from '../../types'

type LineDraft = { itemId: string; qty: string; unitCost: string }

function tone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' {
  if (status === 'draft') return 'zinc'
  if (status === 'returned') return 'sky'
  if (status === 'refunded') return 'lime'
  return 'rose'
}

export function PurchaseReturns() {
  const app = useApp()
  const { purchaseReturns, inventory, suppliers, company, upsertPurchaseReturn, deletePurchaseReturn, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    id?: string; number: string; supplierId: string; status: string; date: string; reason: string; lines: LineDraft[]
  } | null>(null)
  const [deleting, setDeleting] = useState<PurchaseReturn | null>(null)

  const rows = [...purchaseReturns].sort((a, b) => b.date.localeCompare(a.date))
  const open = purchaseReturns.find((r) => r.id === openId)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id

  const openNew = () => setEditing({
    number: nextPurchaseReturnNumber(purchaseReturns),
    supplierId: suppliers[0]?.id || '',
    status: 'draft', date: new Date().toISOString().slice(0, 10), reason: '',
    lines: [{ itemId: '', qty: '1', unitCost: '' }],
  })

  const openEdit = (r: PurchaseReturn) => setEditing({
    id: r.id, number: r.number, supplierId: r.supplierId,
    status: r.status, date: r.date, reason: r.reason || '',
    lines: r.lines.map((l) => ({ itemId: l.itemId, qty: String(l.quantity), unitCost: String(l.unitCost) })),
  })

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Return number is required.'); return }
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
    const rec: PurchaseReturn = {
      id: editing.id || uid('pr'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      lines,
      total,
      status: editing.status as PurchaseReturn['status'],
      reason: editing.reason.trim() || undefined,
      date: editing.date,
      createdAt: isNew ? new Date().toISOString() : (purchaseReturns.find((r) => r.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertPurchaseReturn(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Purchase Return', `${isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? 'Purchase return created' : 'Purchase return updated', rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deletePurchaseReturn(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Return', `Deleted ${deleting.number}`)
    toast.success('Purchase return deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Purchase returns"
        desc="Goods returned to suppliers for credit or refund."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New purchase return</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Supplier</th><th>Date</th><th>Reason</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-sm font-semibold">{r.number}</td>
                <td>{supplierName(r.supplierId)}</td>
                <td className="text-mist">{formatDate(r.date)}</td>
                <td className="text-mist">{r.reason || '—'}</td>
                <td>{formatGhsExact(r.total)}</td>
                <td><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="View purchase return" onClick={() => setOpenId(r.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit purchase return" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete purchase return" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No purchase returns yet" desc="Create your first purchase return with the New button." />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase return'} wide>
        {open && (
          <div className="space-y-3">
            <div id="pr-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Purchase Return</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                {open.reason && <p className="mt-1"><span className="font-semibold">Reason:</span> {open.reason}</p>}
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit purchase return' : 'New purchase return'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Return number" required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {PURCHASE_RETURN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Supplier" required>
                <Select value={editing.supplierId} onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })}>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Return date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
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

            <Field label="Reason"><Textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} rows={2} placeholder="e.g. Expired batch, damaged goods" /></Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm text-mist">Total</p>
              <p className="font-display text-lg">{formatGhsExact(editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0))}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Send className="size-4" /> {editing.id ? 'Save purchase return' : 'Create purchase return'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete purchase return?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete purchase return <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
