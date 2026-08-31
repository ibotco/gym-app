import { useState } from 'react'
import { Plus, Pencil, Trash2, Percent, Tag } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Empty, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { DISCOUNT_TYPES, DISCOUNT_APPLIES, computeDiscount, discountGroupLabel } from '../../lib/discounts'
import type { Discount, DiscountStatus, DiscountType } from '../../types'

type FormState = {
  id?: string
  code: string
  name: string
  type: DiscountType
  value: string
  minSpend: string
  maxDiscount: string
  usageLimit: string
  perCustomerLimit: string
  startsAt: string
  expiresAt: string
  status: DiscountStatus
  appliesTo: 'all' | 'members' | 'plans' | 'products'
  group: 'general' | 'specific_product'
  productId: string
}

const blank = (): FormState => ({
  code: '', name: '', type: 'percentage', value: '', minSpend: '', maxDiscount: '',
  usageLimit: '', perCustomerLimit: '', startsAt: '', expiresAt: '', status: 'active', appliesTo: 'all',
  group: 'general', productId: '',
})

function tone(status: DiscountStatus): 'lime' | 'zinc' | 'rose' {
  if (status === 'active') return 'lime'
  if (status === 'inactive') return 'zinc'
  return 'rose'
}

export function Discounts() {
  const app = useApp()
  const { discounts, upsertDiscount, deleteDiscount, log, inventory } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Discount | null>(null)

  const rows = [...discounts].sort((a, b) => a.code.localeCompare(b.code))

  const openNew = () => setEditing(blank())
  const openEdit = (d: Discount) => setEditing({
    id: d.id, code: d.code, name: d.name, type: d.type, value: String(d.value),
    minSpend: d.minSpend != null ? String(d.minSpend) : '',
    maxDiscount: d.maxDiscount != null ? String(d.maxDiscount) : '',
    usageLimit: d.usageLimit != null ? String(d.usageLimit) : '',
    perCustomerLimit: d.perCustomerLimit != null ? String(d.perCustomerLimit) : '',
    startsAt: d.startsAt || '', expiresAt: d.expiresAt || '', status: d.status, appliesTo: d.appliesTo || 'all',
    group: d.group || 'general', productId: d.productId || '',
  })

  const save = () => {
    if (!editing) return
    if (editing.code.trim().length < 2) { toast.error('Enter a discount code.'); return }
    const value = Number(editing.value)
    if (!Number.isFinite(value) || value <= 0) { toast.error('Enter a valid discount value.'); return }
    if (editing.type === 'percentage' && value > 100) { toast.error('Percentage must be 100 or less.'); return }
    const clash = discounts.some((d) => d.code.toLowerCase() === editing.code.trim().toLowerCase() && d.id !== editing.id)
    if (clash) { toast.error('That discount code already exists.'); return }
    if (editing.group === 'specific_product' && !editing.productId) { toast.error('Assign a product to this discount, or switch the group back to General.'); return }

    const isNew = !editing.id
    const rec: Discount = {
      id: editing.id || uid('dc'),
      code: editing.code.trim().toUpperCase(),
      name: editing.name.trim() || editing.code.trim().toUpperCase(),
      type: editing.type,
      value,
      minSpend: editing.minSpend ? Number(editing.minSpend) : undefined,
      maxDiscount: editing.type === 'percentage' && editing.maxDiscount ? Number(editing.maxDiscount) : undefined,
      usageLimit: editing.usageLimit ? Number(editing.usageLimit) : 0,
      perCustomerLimit: editing.perCustomerLimit ? Number(editing.perCustomerLimit) : undefined,
      startsAt: editing.startsAt || undefined,
      expiresAt: editing.expiresAt || undefined,
      status: editing.status,
      appliesTo: editing.appliesTo,
      group: editing.group,
      productId: editing.group === 'specific_product' ? editing.productId : undefined,
      used: isNew ? 0 : (discounts.find((d) => d.id === editing.id)?.used || 0),
      createdAt: isNew ? new Date().toISOString() : (discounts.find((d) => d.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertDiscount(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Discount', `${isNew ? 'Created' : 'Updated'} ${rec.code}`)
    toast.success(isNew ? 'Discount created' : 'Discount updated', rec.code)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteDiscount(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Discount', `Deleted ${deleting.code}`)
    toast.success('Discount deleted', deleting.code)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Discounts"
        desc="Create and manage discount and promo codes for sales."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New discount</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Value</th><th>Group</th><th>Applies to</th><th>Usage</th><th>Valid until</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-sm font-bold">{d.code}</td>
                <td>{d.name}</td>
                <td className="text-mist">{d.type === 'percentage' ? 'Percentage' : 'Fixed'}</td>
                <td className="font-semibold">{d.type === 'percentage' ? `${d.value}%` : formatGhs(d.value)}</td>
                <td className="text-mist">{discountGroupLabel(d, (id) => inventory.find((item) => item.id === id)?.name)}</td>
                <td className="text-mist">{DISCOUNT_APPLIES.find((a) => a.id === d.appliesTo)?.label || d.appliesTo}</td>
                <td className="text-mist">{d.used}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                <td className="text-mist">{d.expiresAt ? formatDate(d.expiresAt) : '—'}</td>
                <td><Badge tone={tone(d.status)}>{d.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit discount" onClick={() => openEdit(d)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete discount" onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No discounts yet" desc="Create your first discount with the New button." />}
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit discount' : 'New discount'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code" required>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="e.g. WELCOME10" className="font-mono" />
              </Field>
              <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. New member welcome" /></Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as DiscountType })}>
                  {DISCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label={editing.type === 'percentage' ? 'Value (%)' : 'Value (GHS)'} required>
                <Input type="number" min={0} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
              </Field>
              <Field label="Applies to">
                <Select value={editing.appliesTo} onChange={(e) => setEditing({ ...editing, appliesTo: e.target.value as FormState['appliesTo'] })}>
                  {DISCOUNT_APPLIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>
              <Field label="Discount group">
                <Select value={editing.group} onChange={(e) => setEditing({ ...editing, group: e.target.value as FormState['group'], productId: e.target.value === 'specific_product' ? editing.productId : '' })}>
                  <option value="general">General (all products)</option>
                  <option value="specific_product">Specific product</option>
                </Select>
              </Field>
              {editing.group === 'specific_product' && (
                <Field label="Assign product / program" required>
                  <Select value={editing.productId} onChange={(e) => setEditing({ ...editing, productId: e.target.value })}>
                    <option value="">Select a product…</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {item.sku} ({formatGhs(item.sellPrice)})</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as DiscountStatus })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="expired">expired</option>
                </Select>
              </Field>
              <Field label="Minimum spend (optional)"><Input type="number" min={0} value={editing.minSpend} onChange={(e) => setEditing({ ...editing, minSpend: e.target.value })} /></Field>
              {editing.type === 'percentage' && (
                <Field label="Max discount (optional)"><Input type="number" min={0} value={editing.maxDiscount} onChange={(e) => setEditing({ ...editing, maxDiscount: e.target.value })} /></Field>
              )}
              <Field label="Usage limit (0 = unlimited)"><Input type="number" min={0} value={editing.usageLimit} onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value })} /></Field>
              <Field label="Per-customer limit (optional)"><Input type="number" min={0} value={editing.perCustomerLimit} onChange={(e) => setEditing({ ...editing, perCustomerLimit: e.target.value })} /></Field>
              <Field label="Starts on (optional)"><DatePicker value={editing.startsAt} onChange={(v) => setEditing({ ...editing, startsAt: v })} /></Field>
              <Field label="Expires on (optional)"><DatePicker value={editing.expiresAt} onChange={(v) => setEditing({ ...editing, expiresAt: v })} /></Field>
            </div>

            {editing.value && Number(editing.value) > 0 && (
              <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-lime" /> Preview</p>
                <p className="mt-1 text-mist">
                  {editing.group === 'specific_product' ? 'A GHS 1000 order containing the assigned product would get ' : 'A GHS 1000 order would get '}
                  <span className="font-semibold text-inherit">
                    {formatGhs(computeDiscount(
                      { ...(editing as unknown as Discount), status: 'active', used: 0 },
                      1000,
                      editing.productId ? [editing.productId] : undefined,
                    ))}
                  </span>{' '}
                  off with this code.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Percent className="size-4" /> {editing.id ? 'Save discount' : 'Create discount'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete discount?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete discount <span className="font-mono font-semibold text-inherit">{deleting.code}</span>? This cannot be undone.
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
