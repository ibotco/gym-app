import { useMemo, useState } from 'react'
import { Package, Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Truck } from 'lucide-react'
import { PageHeader, Button, Badge, StatusBadge, Modal, Field, Input, Select, SearchInput, Segmented, StatCard, Empty } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDateTime, uid } from '../../lib/utils'
import { INVENTORY_UNITS, stockStatus, nextSku } from '../../lib/inventory'
import { cn } from '../../lib/utils'
import type { InventoryCategory, InventoryItem, StockMovementType, Supplier } from '../../types'

type ItemForm = {
  id?: string
  name: string
  sku: string
  category: InventoryCategory
  quantity: string
  reorderPoint: string
  unit: string
  costPrice: string
  sellPrice: string
  supplierId: string
  branchId: string
}

const blankItem = (): ItemForm => ({
  name: '', sku: '', category: 'Supplements', quantity: '0', reorderPoint: '5',
  unit: 'pcs', costPrice: '', sellPrice: '', supplierId: '', branchId: 'br_airport',
})

export function Inventory() {
  const app = useApp()
  const { inventory, suppliers, supplierCategories, stockMovements, branches, users, inventoryCategories, upsertInventoryItem, deleteInventoryItem, adjustStock, upsertSupplier, deleteSupplier, addInventoryCategory, renameInventoryCategory, deleteInventoryCategory, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [tab, setTab] = useState('items')
  const [itemModal, setItemModal] = useState<ItemForm | null>(null)
  const [isNewItem, setIsNewItem] = useState(false)
  const [stockModal, setStockModal] = useState<{ item: InventoryItem; type: StockMovementType } | null>(null)
  const [stockQty, setStockQty] = useState('1')
  const [stockReason, setStockReason] = useState('')
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null)
  const [supplierModal, setSupplierModal] = useState<Supplier | null>(null)
  const [isNewSupplier, setIsNewSupplier] = useState(false)
  const [catModal, setCatModal] = useState<{ editing?: string; value: string } | null>(null)

  const rows = useMemo(() => {
    return inventory.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false
      const blob = `${i.name} ${i.sku} ${i.category}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    })
  }, [inventory, q, cat])

  const low = inventory.filter((i) => stockStatus(i) === 'low')
  const out = inventory.filter((i) => stockStatus(i) === 'out')
  const stockValue = inventory.reduce((sum, i) => sum + i.quantity * i.costPrice, 0)

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name || id
  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name || '—'

  const openNewItem = () => {
    setIsNewItem(true)
    setItemModal({ ...blankItem(), sku: nextSku(inventory) })
  }
  const openEditItem = (i: InventoryItem) => {
    setIsNewItem(false)
    setItemModal({
      id: i.id, name: i.name, sku: i.sku, category: i.category, quantity: String(i.quantity),
      reorderPoint: String(i.reorderPoint), unit: i.unit, costPrice: String(i.costPrice),
      sellPrice: String(i.sellPrice), supplierId: i.supplierId || '', branchId: i.branchId || 'br_airport',
    })
  }

  const saveItem = () => {
    if (!itemModal) return
    if (itemModal.name.trim().length < 2) { toast.error('Enter an item name.'); return }
    const cost = Number(itemModal.costPrice)
    const sell = Number(itemModal.sellPrice)
    if (!Number.isFinite(cost) || cost < 0) { toast.error('Enter a valid cost price.'); return }
    if (!Number.isFinite(sell) || sell < 0) { toast.error('Enter a valid sell price.'); return }
    const item: InventoryItem = {
      id: itemModal.id || uid('inv'),
      name: itemModal.name.trim(),
      sku: itemModal.sku.trim() || nextSku(inventory),
      category: itemModal.category,
      quantity: Math.max(0, Number(itemModal.quantity) || 0),
      reorderPoint: Math.max(0, Number(itemModal.reorderPoint) || 0),
      unit: itemModal.unit,
      costPrice: cost,
      sellPrice: sell,
      supplierId: itemModal.supplierId || undefined,
      branchId: itemModal.branchId || undefined,
      createdAt: itemModal.id ? (inventory.find((x) => x.id === itemModal.id)?.createdAt || today()) : today(),
      updatedAt: today(),
    }
    upsertInventoryItem(item)
    log(user?.id || 'system', isNewItem ? 'CREATE' : 'UPDATE', 'Inventory', `${isNewItem ? 'Added' : 'Updated'} ${item.name}`)
    toast.success(isNewItem ? 'Item added' : 'Item updated')
    setItemModal(null)
  }

  const doAdjust = () => {
    if (!stockModal) return
    const qty = Number(stockQty)
    if (!Number.isFinite(qty) || qty <= 0) { toast.error('Enter a valid quantity.'); return }
    const r = adjustStock(stockModal.item.id, stockModal.type, qty, stockReason)
    if (!r.ok) { toast.error(r.error || 'Could not adjust stock'); return }
    log(user?.id || 'system', 'STOCK', 'Inventory', `${stockModal.type.toUpperCase()} ${qty} ${stockModal.item.name} — ${stockReason || 'no reason'}`)
    toast.success('Stock updated', `${stockModal.item.name} now ${stockModal.item.quantity + (stockModal.type === 'in' ? qty : stockModal.type === 'out' ? -qty : qty)}`)
    setStockModal(null)
    setStockQty('1')
    setStockReason('')
  }

  const saveSupplier = () => {
    if (!supplierModal) return
    if (supplierModal.name.trim().length < 2) { toast.error('Enter a supplier name.'); return }
    upsertSupplier({ ...supplierModal, id: supplierModal.id || uid('sup'), name: supplierModal.name.trim() })
    toast.success(isNewSupplier ? 'Supplier added' : 'Supplier updated')
    setSupplierModal(null)
  }

  const saveCategory = () => {
    if (!catModal) return
    const r = catModal.editing
      ? renameInventoryCategory(catModal.editing, catModal.value)
      : addInventoryCategory(catModal.value)
    if (!r.ok) { toast.error(r.error || 'Could not save category'); return }
    log(user?.id || 'system', catModal.editing ? 'UPDATE' : 'CREATE', 'Inventory Category', `${catModal.editing ? `Renamed ${catModal.editing} to ` : 'Added '}${catModal.value.trim()}`)
    toast.success(catModal.editing ? 'Category renamed' : 'Category added')
    setCatModal(null)
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        desc="Track stock levels, suppliers, and movements across your clubs."
        actions={canManage ? <Button onClick={openNewItem}><Plus className="size-4" /> Add item</Button> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items in stock" value={String(inventory.length)} icon={<Package className="size-4" />} />
        <StatCard label="Low stock" value={String(low.length)} hint="at or below reorder point" icon={<SlidersHorizontal className="size-4" />} />
        <StatCard label="Out of stock" value={String(out.length)} icon={<ArrowDownToLine className="size-4" />} />
        <StatCard label="Stock value" value={formatGhsExact(stockValue)} hint="at cost" icon={<Truck className="size-4" />} />
      </div>

      <div className="mt-5"><Segmented value={tab} onChange={setTab} options={[
        { id: 'items', label: 'Items' },
        { id: 'suppliers', label: 'Suppliers' },
        { id: 'categories', label: 'Categories' },
        { id: 'movements', label: 'Movements' },
      ]} /></div>

      {tab === 'items' && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, category…" />
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44">
              <option value="all">All categories</option>
              {inventoryCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="card mt-4 table-wrap">
            <table className="data">
              <thead>
                <tr><th>Item</th><th>Category</th><th>Stock</th><th>Cost</th><th>Sell</th><th>Supplier</th><th>Status</th><th>ACTIONS</th></tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const st = stockStatus(i)
                  return (
                    <tr key={i.id}>
                      <td>
                        <p className="font-semibold">{i.name}</p>
                        <p className="font-mono text-xs text-mist">{i.sku}</p>
                      </td>
                      <td><Badge tone="zinc">{i.category}</Badge></td>
                      <td className="font-semibold">{i.quantity} <span className="text-xs font-normal text-mist">{i.unit}</span></td>
                      <td className="text-mist">{formatGhsExact(i.costPrice)}</td>
                      <td>{formatGhsExact(i.sellPrice)}</td>
                      <td className="text-mist">{supplierName(i.supplierId)}</td>
                      <td>
                        <StatusBadge status={st === 'ok' ? 'active' : st === 'low' ? 'pending' : 'overdue'} />
                      </td>
                      <td className="whitespace-nowrap">
                        {canManage && (
                          <>
                            <button className="rounded-lg p-2 text-mist hover:text-lime" title="Receive stock" onClick={() => setStockModal({ item: i, type: 'in' })}><ArrowDownToLine className="size-4" /></button>
                            <button className="rounded-lg p-2 text-mist hover:text-sky-400" title="Issue stock" onClick={() => setStockModal({ item: i, type: 'out' })}><ArrowUpFromLine className="size-4" /></button>
                            <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit item" onClick={() => openEditItem(i)}><Pencil className="size-4" /></button>
                            <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete item" onClick={() => setDeleteItem(i)}><Trash2 className="size-4" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <Empty title="No items found" desc={q || cat !== 'all' ? 'Try a different search or filter.' : 'Add your first inventory item.'} />}
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <>
          <div className="mt-4 flex justify-end">
            {canManage && <Button onClick={() => { setIsNewSupplier(true); setSupplierModal({ id: '', name: '', contact: '', email: '', phone: '', category: supplierCategories[0] || '' }) }}><Plus className="size-4" /> Add supplier</Button>}
          </div>
          <div className="card mt-4 table-wrap">
            <table className="data">
              <thead><tr><th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th><th>Items</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.contact}</td>
                    <td className="text-mist">{s.email}</td>
                    <td className="text-mist">{s.phone}</td>
                    <td>{inventory.filter((i) => i.supplierId === s.id).length}</td>
                    <td className="whitespace-nowrap">
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => { setIsNewSupplier(false); setSupplierModal(s) }}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { deleteSupplier(s.id); toast.success('Supplier removed') }}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'categories' && (
        <>
          <div className="mt-4 flex justify-end">
            {canManage && <Button onClick={() => setCatModal({ value: '' })}><Plus className="size-4" /> Add category</Button>}
          </div>
          <div className="card mt-4 table-wrap">
            <table className="data">
              <thead><tr><th>Category</th><th>Items</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {inventoryCategories.map((c) => (
                  <tr key={c}>
                    <td className="font-semibold">{c}</td>
                    <td>{inventory.filter((i) => i.category === c).length}</td>
                    <td className="whitespace-nowrap">
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Rename category" onClick={() => setCatModal({ editing: c, value: c })}><Pencil className="size-4" /></button>
                          <button
                            className="rounded-lg p-2 text-mist hover:text-ember"
                            title="Delete category"
                            onClick={() => {
                              const r = deleteInventoryCategory(c)
                              if (!r.ok) { toast.error('Cannot delete', r.error); return }
                              toast.success('Category deleted')
                            }}
                          ><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="card mt-4 table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Item</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>
              {stockMovements.map((m) => {
                const item = inventory.find((i) => i.id === m.itemId)
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-mist">{formatDateTime(m.createdAt)}</td>
                    <td className="font-semibold">{item?.name || m.itemId}</td>
                    <td><Badge tone={m.type === 'in' ? 'lime' : m.type === 'out' ? 'amber' : 'sky'}>{m.type}</Badge></td>
                    <td className={cn('font-semibold', m.quantity < 0 && 'text-ember')}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                    <td className="text-mist">{m.reason}</td>
                    <td className="text-mist">{nameOf(m.userId)}</td>
                  </tr>
                )
              })}
              {!stockMovements.length && <tr><td colSpan={6} className="text-mist">No movements yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Item editor */}
      <Modal open={!!itemModal} onClose={() => setItemModal(null)} title={isNewItem ? 'Add item' : 'Edit item'} wide>
        {itemModal && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required><Input value={itemModal.name} onChange={(e) => setItemModal({ ...itemModal, name: e.target.value })} /></Field>
            <Field label="SKU"><Input value={itemModal.sku} onChange={(e) => setItemModal({ ...itemModal, sku: e.target.value })} className="font-mono" /></Field>
            <Field label="Category">
              <Select value={itemModal.category} onChange={(e) => setItemModal({ ...itemModal, category: e.target.value as InventoryCategory })}>
                {inventoryCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Unit">
              <Select value={itemModal.unit} onChange={(e) => setItemModal({ ...itemModal, unit: e.target.value })}>
                {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Quantity in stock"><Input type="number" min={0} value={itemModal.quantity} onChange={(e) => setItemModal({ ...itemModal, quantity: e.target.value })} /></Field>
            <Field label="Reorder point"><Input type="number" min={0} value={itemModal.reorderPoint} onChange={(e) => setItemModal({ ...itemModal, reorderPoint: e.target.value })} /></Field>
            <Field label="Cost price (GHS)"><Input type="number" min={0} value={itemModal.costPrice} onChange={(e) => setItemModal({ ...itemModal, costPrice: e.target.value })} /></Field>
            <Field label="Sell price (GHS)"><Input type="number" min={0} value={itemModal.sellPrice} onChange={(e) => setItemModal({ ...itemModal, sellPrice: e.target.value })} /></Field>
            <Field label="Supplier">
              <Select value={itemModal.supplierId} onChange={(e) => setItemModal({ ...itemModal, supplierId: e.target.value })}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Branch">
              <Select value={itemModal.branchId} onChange={(e) => setItemModal({ ...itemModal, branchId: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setItemModal(null)}>Cancel</Button>
              <Button onClick={saveItem}>{isNewItem ? 'Add item' : 'Save item'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock adjustment */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={stockModal?.type === 'in' ? 'Receive stock' : 'Issue stock'}>
        {stockModal && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{stockModal.item.name}</p>
              <p className="text-mist">Current stock: {stockModal.item.quantity} {stockModal.item.unit}</p>
            </div>
            <Field label={`Quantity (${stockModal.item.unit})`} required>
              <Input type="number" min={1} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </Field>
            <Field label="Reason"><Input value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder={stockModal.type === 'in' ? 'e.g. Supplier delivery' : 'e.g. Retail sale'} /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={doAdjust}>{stockModal.type === 'in' ? 'Receive' : 'Issue'}</Button>
              <Button variant="outline" onClick={() => setStockModal(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete item */}
      <Modal open={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete item?">
        {deleteItem && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{deleteItem.name}</span> and its movement history? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteInventoryItem(deleteItem.id); toast.success('Item deleted'); setDeleteItem(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Category editor */}
      <Modal open={!!catModal} onClose={() => setCatModal(null)} title={catModal?.editing ? 'Rename category' : 'Add category'}>
        {catModal && (
          <div className="space-y-3">
            <Field label="Category name" required>
              <Input
                autoFocus
                value={catModal.value}
                onChange={(e) => setCatModal({ ...catModal, value: e.target.value })}
                placeholder="e.g. Supplements"
              />
            </Field>
            {catModal.editing && (
              <p className="text-xs text-mist">Renaming updates all {inventory.filter((i) => i.category === catModal.editing).length} item(s) in this category.</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCatModal(null)}>Cancel</Button>
              <Button onClick={saveCategory}>{catModal.editing ? 'Save' : 'Add category'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Supplier editor */}
      <Modal open={!!supplierModal} onClose={() => setSupplierModal(null)} title={isNewSupplier ? 'Add supplier' : 'Edit supplier'}>
        {supplierModal && (
          <div className="grid gap-3">
            <Field label="Name" required><Input value={supplierModal.name} onChange={(e) => setSupplierModal({ ...supplierModal, name: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={supplierModal.category || ''} onChange={(e) => setSupplierModal({ ...supplierModal, category: e.target.value })}>
                <option value="">Select category…</option>
                {supplierCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Contact person"><Input value={supplierModal.contact} onChange={(e) => setSupplierModal({ ...supplierModal, contact: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={supplierModal.email} onChange={(e) => setSupplierModal({ ...supplierModal, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={supplierModal.phone} onChange={(e) => setSupplierModal({ ...supplierModal, phone: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setSupplierModal(null)}>Cancel</Button>
              <Button onClick={saveSupplier}>{isNewSupplier ? 'Add supplier' : 'Save supplier'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
