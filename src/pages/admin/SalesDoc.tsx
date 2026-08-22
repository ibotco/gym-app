import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Send , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import { DOC_STATUSES, ORDER_STATUSES, nextDocNumber } from '../../lib/quotes'
import type { InvoiceItem, Proposal, Estimate, SalesOrder } from '../../types'

type LineDraft = { desc: string; qty: string; unitPrice: string }

export type DocKind = 'proposal' | 'estimate' | 'salesorder'

type Doc = Proposal | Estimate | SalesOrder

function docTone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' | 'violet' {
  if (status === 'draft') return 'zinc'
  if (status === 'sent' || status === 'confirmed') return 'sky'
  if (status === 'accepted' || status === 'fulfilled' || status === 'invoiced') return 'lime'
  if (status === 'cancelled') return 'rose'
  return 'violet'
}

export function SalesDocPage({ kind }: { kind: DocKind }) {
  const isProposal = kind === 'proposal'
  const isEstimate = kind === 'estimate'
  const isOrder = kind === 'salesorder'
  const label = isProposal ? 'Proposal' : isEstimate ? 'Estimate' : 'Sales order'
  const prefix = isProposal ? 'PRO' : isEstimate ? 'EST' : 'SO'
  const statusOptions = isOrder ? (ORDER_STATUSES as string[]) : (DOC_STATUSES as string[])

  const app = useApp()
  const docs: Doc[] = isProposal ? app.proposals : isEstimate ? app.estimates : app.salesOrders
  const upsert = isProposal ? app.upsertProposal : isEstimate ? app.upsertEstimate : app.upsertSalesOrder
  const del = isProposal ? app.deleteProposal : isEstimate ? app.deleteEstimate : app.deleteSalesOrder
  const { members, users, company, log } = app
  const { user } = useAuth()
  const toast = useToast()

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    id?: string; number: string; customerType: 'member' | 'walkin'; memberId: string; customerName: string
    status: string; date: string; secondDate: string; notes: string; lines: LineDraft[]
  } | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)

  const rows = [...docs].sort((a, b) => b.date.localeCompare(a.date))
  const open = docs.find((d) => d.id === openId)

  const billTo = (d: Doc) => {
    if (d.customerName) return d.customerName
    const m = members.find((x) => x.id === d.memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || d.memberId : 'Walk-in customer'
  }

  const secondDateOf = (d: Doc) => (isOrder ? (d as SalesOrder).expectedDate : (d as Proposal | Estimate).validUntil)

  const openNew = () => setEditing({
    number: nextDocNumber(prefix, docs.length),
    customerType: 'walkin', memberId: '', customerName: '',
    status: 'draft', date: new Date().toISOString().slice(0, 10), secondDate: '', notes: '',
    lines: [{ desc: '', qty: '1', unitPrice: '' }],
  })

  const openEdit = (d: Doc) => setEditing({
    id: d.id, number: d.number,
    customerType: d.memberId ? 'member' : 'walkin', memberId: d.memberId || '', customerName: d.customerName || '',
    status: d.status, date: d.date, secondDate: secondDateOf(d) || '', notes: d.notes || '',
    lines: d.items.map((it) => ({ desc: it.desc, qty: it.qty != null ? String(it.qty) : '1', unitPrice: it.unitPrice != null ? String(it.unitPrice) : String(it.amount) })),
  })

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error(`${label} number is required.`); return }
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
    const rec = {
      id: editing.id || uid(isProposal ? 'pp' : isEstimate ? 'es' : 'so'),
      number: editing.number.trim(),
      memberId: editing.customerType === 'member' ? editing.memberId || undefined : undefined,
      customerName: editing.customerType === 'walkin' ? editing.customerName.trim() || 'Walk-in customer' : undefined,
      items,
      total,
      status: editing.status,
      notes: editing.notes.trim() || undefined,
      date: editing.date,
      ...(isOrder ? { expectedDate: editing.secondDate || undefined } : { validUntil: editing.secondDate || undefined }),
      createdAt: isNew ? new Date().toISOString() : (docs.find((d) => d.id === editing.id)?.createdAt || new Date().toISOString()),
    } as Doc
    upsert(rec as never)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', label, `${isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(total)}`)
    toast.success(isNew ? `${label} created` : `${label} updated`, rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    del(deleting.id)
    log(user?.id || 'system', 'DELETE', label, `Deleted ${deleting.number}`)
    toast.success(`${label} deleted`, deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title={`${label}s`}
        desc={isProposal ? 'Formal proposals sent to prospective members and clients.' : isEstimate ? 'Estimates and quotations for prospective sales.' : 'Confirmed customer orders awaiting fulfilment and invoicing.'}
        actions={<Button onClick={openNew}><Plus className="size-4" /> New {label.toLowerCase()}</Button>}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>{isOrder ? 'Expected' : 'Valid until'}</th><th>Total</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-sm font-semibold">{d.number}</td>
                <td>{billTo(d)}</td>
                <td className="text-mist">{formatDate(d.date)}</td>
                <td className="text-mist">{secondDateOf(d) ? formatDate(secondDateOf(d)!) : '—'}</td>
                <td>{formatGhsExact(d.total)}</td>
                <td><Badge tone={docTone(d.status)}>{d.status}</Badge></td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title={`View ${label.toLowerCase()}`} onClick={() => setOpenId(d.id)}><FileText className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title={`Edit ${label.toLowerCase()}`} onClick={() => openEdit(d)}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title={`Delete ${label.toLowerCase()}`} onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title={`No ${label.toLowerCase()}s yet`} desc={`Create your first ${label.toLowerCase()} with the New button.`} />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || label} wide>
        {open && (
          <div className="space-y-3">
            <div id="doc-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">{label}</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {secondDateOf(open) && <p className="text-xs text-zinc-500">{isOrder ? 'Expected' : 'Valid until'} {formatDate(secondDateOf(open)!)}</p>}
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Prepared for:</span> {billTo(open)}</p>
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`${label} number`} required>
                <Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
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
              <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label={isOrder ? 'Expected date (optional)' : 'Valid until (optional)'}><DatePicker value={editing.secondDate} onChange={(v) => setEditing({ ...editing, secondDate: v })} /></Field>
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
              <Button onClick={save}><Send className="size-4" /> {editing.id ? `Save ${label.toLowerCase()}` : `Create ${label.toLowerCase()}`}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${label.toLowerCase()}?`}>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete {label.toLowerCase()} <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
