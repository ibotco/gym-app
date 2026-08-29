import { useState } from 'react'
import { Plus, Trash2, ShoppingCart , X} from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Field, Input, Select, Empty, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import type { PurchaseLine, PurchaseStatus } from '../../types'

export function Purchases() {
  const app = useApp()
  const { inventory, suppliers, purchases, activeCompanyId, activeBranchId, recordPurchase, updatePurchaseStatus, deletePurchase, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [purchaseModal, setPurchaseModal] = useState(false)
  const [poSupplier, setPoSupplier] = useState('')
  const [poStatus, setPoStatus] = useState<PurchaseStatus>('received')
  const [poNotes, setPoNotes] = useState('')
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [poLines, setPoLines] = useState<PurchaseLine[]>([{ itemId: '', quantity: 1, unitCost: 0 }])

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const poTotal = poLines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unitCost || 0), 0)

  const openNewPurchase = () => {
    setPoSupplier(suppliers[0]?.id || '')
    setPoStatus('received')
    setPoNotes('')
    setPoDate(new Date().toISOString().slice(0, 10))
    setPoLines([{ itemId: '', quantity: 1, unitCost: 0 }])
    setPurchaseModal(true)
  }

  const submitPurchase = () => {
    const r = recordPurchase({ companyId: activeCompanyId || undefined, branchId: activeBranchId || undefined, supplierId: poSupplier, lines: poLines, status: poStatus, notes: poNotes, userId: user?.id || 'system', date: poDate || undefined })
    if (!r.ok) { toast.error(r.error || 'Could not record purchase'); return }
    log(user?.id || 'system', 'PURCHASE', 'Purchases', `Purchase ${r.purchase?.number} — ${formatGhsExact(r.purchase?.total || 0)}`)
    toast.success('Purchase recorded', r.purchase?.number)
    setPurchaseModal(false)
  }

  return (
    <div>
      <PageHeader
        title="Purchases"
        desc="Order and receive stock from suppliers."
        actions={canManage ? <Button onClick={openNewPurchase}><Plus className="size-4" /> New purchase</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Number</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.number}</td>
                <td>{supplierName(p.supplierId)}</td>
                <td>
                  {p.lines.map((l) => (
                    <p key={l.itemId} className="text-xs text-mist">{itemName(l.itemId)} × {l.quantity}</p>
                  ))}
                </td>
                <td>{formatGhsExact(p.total)}</td>
                <td>
                  {canManage && p.status !== 'received' ? (
                    <Select value={p.status} onChange={(e) => { updatePurchaseStatus(p.id, e.target.value as PurchaseStatus); toast.success('Status updated') }}>
                      <option value="ordered">ordered</option>
                      <option value="received">received</option>
                      <option value="paid">paid</option>
                    </Select>
                  ) : (
                    <StatusBadge status={p.status === 'received' ? 'active' : p.status === 'paid' ? 'paid' : 'pending'} />
                  )}
                </td>
                <td className="whitespace-nowrap text-mist">{p.date || p.createdAt.slice(0, 10)}</td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete purchase" onClick={() => { deletePurchase(p.id); toast.success('Purchase deleted') }}><Trash2 className="size-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!purchases.length && <Empty title="No purchases yet" desc="Record your first purchase with the New purchase button." />}
      </div>

      {/* Purchase editor */}
      <Modal open={purchaseModal} onClose={() => setPurchaseModal(false)} title="New purchase" wide>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier" required>
              <Select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={poStatus} onChange={(e) => setPoStatus(e.target.value as PurchaseStatus)}>
                <option value="received">received (adds stock)</option>
                <option value="ordered">ordered</option>
                <option value="paid">paid</option>
              </Select>
            </Field>
            <Field label="Date">
              <DatePicker value={poDate} onChange={setPoDate} />
            </Field>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Items</p>
              <Button size="sm" variant="ghost" onClick={() => setPoLines((s) => [...s, { itemId: '', quantity: 1, unitCost: 0 }])}><Plus className="size-4" /> Add line</Button>
            </div>
            <div className="mb-1 grid grid-cols-[1fr_76px_96px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit cost</span>
              <span />
            </div>
            <div className="space-y-2">
              {poLines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_76px_96px_40px] items-center gap-2">
                  <Select className="min-w-0" value={l.itemId} onChange={(e) => setPoLines((s) => s.map((x, j) => j === i ? { ...x, itemId: e.target.value, unitCost: x.unitCost || inventory.find((it) => it.id === e.target.value)?.costPrice || 0 } : x))}>
                    <option value="">Select item…</option>
                    {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </Select>
                  <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setPoLines((s) => s.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} />
                  <Input aria-label="Unit cost" type="number" min={0} value={l.unitCost} onChange={(e) => setPoLines((s) => s.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) || 0 } : x))} />
                  <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setPoLines((s) => s.filter((_, j) => j !== i))}><X className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <Field label="Notes"><Input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Optional" /></Field>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <p className="text-sm text-mist">Total</p>
            <p className="font-display text-lg">{formatGhsExact(poTotal)}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPurchaseModal(false)}>Cancel</Button>
            <Button onClick={submitPurchase}><ShoppingCart className="size-4" /> Record purchase</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
