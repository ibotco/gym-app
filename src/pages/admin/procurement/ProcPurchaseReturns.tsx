import { useMemo, useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Printer, Check, Undo2 } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Empty, DatePicker, SearchInput } from '../../../components/ui'
import { AttachmentField } from '../accounting/AttachmentField'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextReturnNumber, statusLabel, returnedQty, PROC_RETURN_STATUSES } from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import type { AttachmentFile, GoodsReceipt, ProcPurchaseReturn, ProcReturnLine } from '../../../types'

type LineDraft = { itemId: string; received: number; alreadyReturned: number; qty: string; unitCost: string; batchNumber: string }

const REASONS = ['Damaged in transit', 'Wrong item supplied', 'Quality below specification', 'Expired or near expiry', 'Over-supplied', 'Other']

export function ProcPurchaseReturns() {
  const {
    procReturns, goodsReceipts, procPurchaseOrders, inventory, suppliers, company,
    upsertProcReturn, deleteProcReturn, postProcReturn, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')
  const canApprove = hasRole('super_admin', 'gym_manager', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProcPurchaseReturn | null>(null)
  const [posting, setPosting] = useState<ProcPurchaseReturn | null>(null)
  const [editing, setEditing] = useState<
    | { id?: string; number: string; goodsReceiptId: string; supplierId: string; returnDate: string
        reason: string; notes: string; attachments: AttachmentFile[]; lines: LineDraft[] }
    | null
  >(null)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const grnOf = (id: string) => goodsReceipts.find((g) => g.id === id)
  const poNumberFor = (grnId: string) => {
    const g = grnOf(grnId)
    return g ? procPurchaseOrders.find((o) => o.id === g.purchaseOrderId)?.number : undefined
  }

  /** Only posted receipts can be returned against. */
  const postedGrns = useMemo(() => goodsReceipts.filter((g) => g.status === 'posted'), [goodsReceipts])

  const linesForGrn = (g: GoodsReceipt, excludeId?: string): LineDraft[] =>
    g.lines.filter((l) => l.quantityReceiving > 0).map((l) => {
      const alreadyReturned = returnedQty(procReturns, g.id, l.itemId, excludeId)
      return {
        itemId: l.itemId,
        received: l.quantityReceiving,
        alreadyReturned,
        qty: '0',
        unitCost: String(l.unitCost),
        batchNumber: l.batchNumber || '',
      }
    })

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...procReturns]
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => !ql || r.number.toLowerCase().includes(ql)
        || supplierName(r.supplierId).toLowerCase().includes(ql)
        || (grnOf(r.goodsReceiptId)?.number || '').toLowerCase().includes(ql))
      .sort((a, b) => b.returnDate.localeCompare(a.returnDate))
  }, [procReturns, q, statusFilter, suppliers, goodsReceipts])

  const open = procReturns.find((r) => r.id === openId) || null

  const startFor = (g: GoodsReceipt) => setEditing({
    number: nextReturnNumber(procReturns),
    goodsReceiptId: g.id, supplierId: g.supplierId,
    returnDate: new Date().toISOString().slice(0, 10),
    reason: REASONS[0], notes: '', attachments: [],
    lines: linesForGrn(g),
  })

  const openNew = () => {
    if (!postedGrns.length) { toast.error('Nothing to return', 'Post a goods receipt first.'); return }
    startFor(postedGrns[0])
  }

  const openEdit = (r: ProcPurchaseReturn) => {
    const g = grnOf(r.goodsReceiptId)
    setEditing({
      id: r.id, number: r.number, goodsReceiptId: r.goodsReceiptId, supplierId: r.supplierId,
      returnDate: r.returnDate, reason: r.reason, notes: r.notes || '', attachments: r.attachments || [],
      lines: g
        ? linesForGrn(g, r.id).map((base) => {
            const saved = r.lines.find((l) => l.itemId === base.itemId)
            return saved ? { ...base, qty: String(saved.quantityReturned), unitCost: String(saved.unitCost) } : base
          })
        : [],
    })
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : e)

  /** Ceiling per line: what was accepted, less what has already gone back. */
  const lineError = (l: LineDraft): string => {
    const qty = Number(l.qty) || 0
    if (qty < 0) return 'Negative'
    const available = Math.max(0, l.received - l.alreadyReturned)
    if (qty > available) return `Max ${available}`
    const onHand = inventory.find((i) => i.id === l.itemId)?.quantity ?? 0
    if (qty > onHand) return `Only ${onHand} in stock`
    return ''
  }

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0)
  }, [editing])

  const buildRecord = (): ProcPurchaseReturn | null => {
    if (!editing) return null
    if (!editing.goodsReceiptId) { toast.error('Select a goods receipt.'); return null }
    if (!editing.reason.trim()) { toast.error('A return reason is required.'); return null }

    for (const l of editing.lines) {
      const err = lineError(l)
      if (err) { toast.error('Invalid return quantity', `${itemName(l.itemId)} — ${err}.`); return null }
    }
    const lines: ProcReturnLine[] = editing.lines
      .filter((l) => (Number(l.qty) || 0) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantityReceived: l.received,
        quantityReturned: Number(l.qty) || 0,
        unitCost: Number(l.unitCost) || 0,
        batchNumber: l.batchNumber.trim() || undefined,
      }))
    if (!lines.length) { toast.error('Enter a quantity to return on at least one line.'); return null }

    const existing = procReturns.find((r) => r.id === editing.id)
    return {
      ...(existing || {} as ProcPurchaseReturn),
      id: editing.id || uid('pret'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      goodsReceiptId: editing.goodsReceiptId,
      returnDate: editing.returnDate,
      reason: editing.reason.trim(),
      notes: editing.notes.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      lines,
      total: lines.reduce((s, l) => s + l.quantityReturned * l.unitCost, 0),
      status: existing && existing.status !== 'draft' ? existing.status : 'draft',
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
  }

  const save = (approve: boolean) => {
    const rec = buildRecord()
    if (!rec) return
    const final = approve ? { ...rec, status: 'approved' as const } : rec
    upsertProcReturn(final)
    log(user?.id || 'system', approve ? 'APPROVE' : 'CREATE', 'Purchase Return',
      `${approve ? 'Approved' : 'Saved'} ${final.number} — ${formatGhsExact(final.total)}`)
    toast.success(approve ? 'Return approved' : 'Return saved', final.number)
    setEditing(null)
  }

  const doPost = () => {
    if (!posting) return
    const res = postProcReturn(posting.id, user?.name)
    if (!res.ok) { toast.error('Could not post return', res.error); setPosting(null); return }
    log(user?.id || 'system', 'POST', 'Purchase Return',
      `Posted ${posting.number} — stock reduced by ${posting.lines.reduce((s, l) => s + l.quantityReturned, 0)} unit(s)`)
    toast.success('Return posted', `${posting.number} — inventory reduced`)
    setPosting(null)
  }

  const closeReturn = (r: ProcPurchaseReturn) => {
    upsertProcReturn({ ...r, status: 'closed' })
    log(user?.id || 'system', 'UPDATE', 'Purchase Return', `Closed ${r.number}`)
    toast.success('Return closed', r.number)
  }

  const doDelete = () => {
    if (!deleting) return
    if (deleting.status === 'returned' || deleting.status === 'closed') {
      toast.error('Cannot delete', 'Posted returns are part of the audit trail.')
      setDeleting(null); return
    }
    deleteProcReturn(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Return', `Deleted ${deleting.number}`)
    toast.success('Return deleted', deleting.number)
    setDeleting(null)
  }

  const editingGrn = editing ? grnOf(editing.goodsReceiptId) : undefined

  return (
    <div>
      <PageHeader
        title="Purchase returns"
        desc="Send goods back to a supplier. Returns are raised against a posted goods receipt and reduce stock when posted."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New return</Button> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search return, GRN or supplier…" className="max-w-xs" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[12rem]">
          <option value="all">All statuses</option>
          {PROC_RETURN_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Return</th><th>Date</th><th>Supplier</th><th>GRN ref</th><th>Reason</th><th>Qty</th><th>Value</th><th>Status</th><th>ACTIONS</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-sm font-semibold">{r.number}</td>
                <td className="text-mist">{formatDate(r.returnDate)}</td>
                <td>{supplierName(r.supplierId)}</td>
                <td className="font-mono text-xs">{grnOf(r.goodsReceiptId)?.number || '—'}</td>
                <td className="max-w-[14rem] truncate text-mist">{r.reason}</td>
                <td>{r.lines.reduce((s, l) => s + l.quantityReturned, 0)}</td>
                <td>{formatGhsExact(r.total)}</td>
                <td><ProcStatus status={r.status} /></td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="View" onClick={() => setOpenId(r.id)}><FileText className="size-4" /></button>
                  {canManage && (r.status === 'draft' || r.status === 'approved') && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                  )}
                  {canApprove && r.status === 'approved' && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" title="Post return (reduces stock)" onClick={() => setPosting(r)}><Undo2 className="size-4" /></button>
                  )}
                  {canManage && r.status === 'returned' && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" title="Close return" onClick={() => closeReturn(r)}><Check className="size-4" /></button>
                  )}
                  {canManage && (r.status === 'draft' || r.status === 'approved') && (
                    <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No purchase returns" desc="Raise a return against a posted goods receipt." />}
      </div>

      {/* ── View ───────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase return'} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ProcStatus status={open.status} />
              {(open.status === 'draft' || open.status === 'approved') && <span className="text-xs text-mist">Stock has not been reduced yet.</span>}
              {(open.status === 'returned' || open.status === 'closed') && <span className="text-xs text-mist">Stock was reduced when this return was posted.</span>}
            </div>

            <div id="pret-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Purchase Return</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.returnDate)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                <p><span className="font-semibold">GRN reference:</span> {grnOf(open.goodsReceiptId)?.number || '—'}</p>
                <p><span className="font-semibold">PO reference:</span> {poNumberFor(open.goodsReceiptId) || '—'}</p>
                <p><span className="font-semibold">Reason:</span> {open.reason}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Returned</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2 text-right">Unit cost</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemName(l.itemId)}</td>
                        <td className="px-3 py-2 text-right">{l.quantityReceived}</td>
                        <td className="px-3 py-2 text-right font-semibold">{l.quantityReturned}</td>
                        <td className="px-3 py-2">{l.batchNumber || '—'}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.quantityReturned * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <div className="flex w-56 justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                  <span>Credit due</span><span>{formatGhsExact(open.total)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Return raised', at: open.createdAt, tone: 'zinc' },
                  { label: 'Posted — stock reduced', at: open.postedAt, by: open.postedBy },
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  <DocChip label={grnOf(open.goodsReceiptId)?.number || 'GRN'} />
                  {poNumberFor(open.goodsReceiptId) && <DocChip label={poNumberFor(open.goodsReceiptId)!} />}
                </RelatedDocs>
                {open.attachments?.length ? (
                  <p className="mt-3 text-xs text-mist">{open.attachments.length} attachment(s): {open.attachments.map((a) => a.name).join(', ')}</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              {canApprove && open.status === 'approved' && (
                <Button onClick={() => { setPosting(open); setOpenId(null) }}><Undo2 className="size-4" /> Post return</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit purchase return' : 'New purchase return'} xl>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Return number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Goods receipt" required>
                <Select value={editing.goodsReceiptId} onChange={(e) => {
                  const g = grnOf(e.target.value)
                  if (!g) return
                  setEditing({ ...editing, goodsReceiptId: g.id, supplierId: g.supplierId, lines: linesForGrn(g, editing.id) })
                }}>
                  <option value="">Please Select…</option>
                  {postedGrns.map((g) => <option key={g.id} value={g.id}>{g.number} — {supplierName(g.supplierId)}</option>)}
                </Select>
              </Field>
              <Field label="Return date"><DatePicker value={editing.returnDate} onChange={(v) => setEditing({ ...editing, returnDate: v })} /></Field>
              <Field label="Supplier"><Input value={supplierName(editing.supplierId)} readOnly className="opacity-70" /></Field>
              <Field label="Return reason" required>
                <Select value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
            </div>

            {editingGrn && (
              <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-3 text-xs text-mist">
                Returning against <span className="font-mono font-semibold text-inherit">{editingGrn.number}</span>
                {poNumberFor(editingGrn.id) && <> · order {poNumberFor(editingGrn.id)}</>}
                {' '}· you cannot return more than was accepted, or more than is currently in stock.
              </div>
            )}

            <div>
              <SubHead>Items to return</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="w-24 text-right">Received</th>
                      <th className="w-28 text-right">Already returned</th>
                      <th className="w-24 text-right">In stock</th>
                      <th className="w-28">Returning</th>
                      <th className="w-28">Unit cost</th>
                      <th className="w-28">Batch</th>
                      <th className="w-28 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.lines.map((l, i) => {
                      const err = lineError(l)
                      const onHand = inventory.find((x) => x.id === l.itemId)?.quantity ?? 0
                      return (
                        <tr key={i}>
                          <td className="text-sm font-medium">{itemName(l.itemId)}</td>
                          <td className="text-right">{l.received}</td>
                          <td className="text-right text-mist">{l.alreadyReturned}</td>
                          <td className="text-right text-mist">{onHand}</td>
                          <td>
                            <Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" aria-invalid={!!err} />
                            {err && <p className="mt-1 text-[11px] font-semibold text-rose-500">{err}</p>}
                          </td>
                          <td><Input value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.batchNumber} onChange={(e) => setLine(i, { batchNumber: e.target.value })} /></td>
                          <td className="text-right text-sm">{formatGhsExact((Number(l.qty) || 0) * (Number(l.unitCost) || 0))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[18rem] flex-1 space-y-3">
                <Field label="Notes"><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
                <div>
                  <SubHead>Supporting documents</SubHead>
                  <AttachmentField files={editing.attachments} onChange={(next) => setEditing({ ...editing, attachments: next })} />
                </div>
              </div>
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold">
                  <span>Credit due</span><span>{formatGhsExact(draftTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="ghost" onClick={() => save(false)}>Save draft</Button>
              {canApprove && <Button onClick={() => save(true)}><Check className="size-4" /> Save &amp; approve</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Post confirm ───────────────────────────────────────────────── */}
      <Modal open={!!posting} onClose={() => setPosting(null)} title="Post purchase return">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Posting <span className="font-mono font-semibold">{posting?.number}</span> will reduce inventory by{' '}
            <span className="font-semibold">{posting?.lines.reduce((s, l) => s + l.quantityReturned, 0)}</span> unit(s)
            and raise a supplier credit of <span className="font-semibold">{formatGhsExact(posting?.total || 0)}</span>. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPosting(null)}>Cancel</Button>
            <Button onClick={doPost}><Undo2 className="size-4" /> Post return</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete return">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? Only unposted returns can be deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
