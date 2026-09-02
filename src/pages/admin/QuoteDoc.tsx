import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer } from 'lucide-react'
import { PageHeader, Button, Modal, Empty, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { nextDocNumber } from '../../lib/quotes'
import { QuoteEditor, secondDateOf, type QuoteDoc, type QuoteKind } from './QuoteEditor'

/** Covers both the quotation statuses and the sales-order statuses. */
function docTone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' | 'violet' {
  if (status === 'draft') return 'zinc'
  if (status === 'sent' || status === 'confirmed') return 'sky'
  if (status === 'accepted' || status === 'fulfilled' || status === 'invoiced') return 'lime'
  if (status === 'declined' || status === 'cancelled') return 'rose'
  return 'violet'
}

const KIND_COPY: Record<QuoteKind, {
  label: string
  lower: string
  prefix: 'EST' | 'PRO' | 'SO'
  desc: string
  secondDateLabel: string
}> = {
  estimate: {
    label: 'Estimate', lower: 'estimate', prefix: 'EST', secondDateLabel: 'Valid until',
    desc: 'Estimates and quotations for prospective sales.',
  },
  proposal: {
    label: 'Proposal', lower: 'proposal', prefix: 'PRO', secondDateLabel: 'Valid until',
    desc: 'Formal proposals sent to prospective members and clients.',
  },
  salesorder: {
    label: 'Sales order', lower: 'sales order', prefix: 'SO', secondDateLabel: 'Expected',
    desc: 'Confirmed customer orders awaiting fulfilment and invoicing.',
  },
}

/** Shared list + editor page for the two quotation documents. */
export function QuoteDocPage({ kind }: { kind: QuoteKind }) {
  const app = useApp()
  const { deleteEstimate, deleteProposal, deleteSalesOrder, members, users, company, log } = app
  const { user } = useAuth()
  const toast = useToast()
  const copy = KIND_COPY[kind]
  const docs: QuoteDoc[] = kind === 'proposal' ? app.proposals : kind === 'salesorder' ? app.salesOrders : app.estimates
  const del = kind === 'proposal' ? deleteProposal : kind === 'salesorder' ? deleteSalesOrder : deleteEstimate

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ doc?: QuoteDoc } | null>(null)
  const [deleting, setDeleting] = useState<QuoteDoc | null>(null)

  const rows = [...docs].sort((a, b) => b.date.localeCompare(a.date))
  const open = docs.find((d) => d.id === openId)

  const billTo = (d: QuoteDoc) => {
    if (d.customerName) return d.customerName
    const m = members.find((x) => x.id === d.memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || d.memberId : 'Walk-in customer'
  }

  const doDelete = () => {
    if (!deleting) return
    del(deleting.id)
    log(user?.id || 'system', 'DELETE', copy.label, `Deleted ${deleting.number}`)
    toast.success(`${copy.label} deleted`, deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title={`${copy.label}s`}
        desc={copy.desc}
        actions={<Button onClick={() => setEditing({})}><Plus className="size-4" /> Add {copy.label}</Button>}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Number</th><th>Customer</th><th>Date</th><th>{copy.secondDateLabel}</th><th>Total</th><th>Status</th><th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-sm font-semibold">{d.number}</td>
                <td>{billTo(d)}</td>
                <td className="text-mist">{formatDate(d.date)}</td>
                <td className="text-mist">{secondDateOf(d) ? formatDate(secondDateOf(d)) : '—'}</td>
                <td>{formatGhsExact(d.total)}</td>
                <td><Badge tone={docTone(d.status)}>{d.status}</Badge></td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title={`View ${copy.lower}`} onClick={() => setOpenId(d.id)}><FileText className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title={`Edit ${copy.lower}`} onClick={() => setEditing({ doc: d })}><Pencil className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title={`Delete ${copy.lower}`} onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title={`No ${copy.lower}s yet`} desc={`Create your first ${copy.lower} with the Add ${copy.label} button.`} />}
      </div>

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || copy.label} wide>
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
                  <p className="font-bold uppercase tracking-wide">{copy.label}</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {secondDateOf(open) && <p className="text-xs text-zinc-500">{copy.secondDateLabel} {formatDate(secondDateOf(open))}</p>}
                  {open.businessLocation && <p className="text-xs text-zinc-500">{open.businessLocation}</p>}
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
                        <td className="px-3 py-2">
                          {it.desc}
                          {(it.discount || 0) > 0 && <span className="ml-1 text-[11px] text-zinc-500">(less {formatGhsExact(it.discount!)})</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{it.qty != null ? `${it.qty}${it.unitPrice != null ? ` × ${formatGhsExact(it.unitPrice)}` : ''}` : ''}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between gap-6">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <dl className="w-56 space-y-1 text-xs">
                  {open.subtotal != null && (
                    <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{formatGhsExact(open.subtotal)}</dd></div>
                  )}
                  {(open.discountValue || 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Discount{open.discountCode ? ` (${open.discountCode})` : ''}</dt>
                      <dd>− {formatGhsExact(open.discountValue!)}</dd>
                    </div>
                  )}
                  {(open.taxAmount || 0) > 0 && (
                    <div className="flex justify-between"><dt className="text-zinc-500">{open.taxName} ({open.taxRate}%)</dt><dd>+ {formatGhsExact(open.taxAmount!)}</dd></div>
                  )}
                  <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                    <dt>Total</dt><dd>{formatGhsExact(open.total)}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit — Sale-style sectioned editor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.doc ? `Edit ${copy.label} — ${editing.doc.number}` : `Add ${copy.label}`}
        xl
      >
        {editing && (
          <QuoteEditor
            kind={kind}
            doc={editing.doc}
            suggestedNumber={nextDocNumber(copy.prefix, docs.length)}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${copy.lower}?`}>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete {copy.lower} <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
