import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField, Empty } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { visibleBranches } from '../../lib/accessScope'
import { PortalAccess } from '../../components/PortalAccess'
import type { Supplier } from '../../types'

type FormState = { id?: string; name: string; contact: string; email: string; phone: string; category: string; branchId: string }

const blank = (defaultCategory = '', branchId = 'br_airport'): FormState => ({ name: '', contact: '', email: '', phone: '+233 ', category: defaultCategory, branchId })

export function Suppliers() {
  const app = useApp()
  const { suppliers, users, inventory, branches, supplierCategories, upsertSupplier, deleteSupplier, patchUser, log } = app
  const { user, hasPermission } = useAuth()
  const toast = useToast()
  const branchOptions = visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive')
  const branchIdFor = (supplier: Supplier) => supplier.branchId || (supplier.userId ? users.find((candidate) => candidate.id === supplier.userId)?.branchId : undefined)

  const canView = hasPermission('suppliers.view')
  const canManage = hasPermission('suppliers.manage')
  const canDelete = hasPermission('suppliers.delete')

  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return suppliers
      .filter((s) => {
        if (catFilter && s.category !== catFilter) return false
        if (!ql) return true
        return `${s.name} ${s.contact} ${s.email} ${s.phone} ${s.category || ''}`.toLowerCase().includes(ql)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [suppliers, q, catFilter])

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', sortValue: (s) => s.name, render: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'category', header: 'Category', sortValue: (s) => s.category || '', render: (s) => s.category ? <Badge tone="zinc">{s.category}</Badge> : '—' },
    { key: 'branch', header: 'Branch', sortValue: (s) => branches.find((branch) => branch.id === branchIdFor(s))?.name || '', render: (s) => branches.find((branch) => branch.id === branchIdFor(s))?.name || '—' },
    { key: 'contact', header: 'Contact', sortValue: (s) => s.contact, render: (s) => s.contact },
    { key: 'email', header: 'Email', sortValue: (s) => s.email, render: (s) => <span className="text-mist">{s.email}</span> },
    { key: 'phone', header: 'Phone', sortValue: (s) => s.phone, render: (s) => <span className="text-mist">{s.phone}</span> },
    { key: 'items', header: 'Items', sortValue: (s) => inventory.filter((i) => i.supplierId === s.id).length, align: 'center', render: (s) => inventory.filter((i) => i.supplierId === s.id).length },
    {
      key: 'actions', header: 'ACTIONS',
      render: (s) => (
        <span className="whitespace-nowrap">
          {canManage && (
            <PortalAccess
              subject={{ id: s.id, name: s.name, email: s.email, phone: s.phone, companyId: s.companyId, branchId: branchIdFor(s), userId: s.userId }}
              role="supplier"
              entity="Supplier"
              onLinked={(userId) => upsertSupplier({ ...s, userId: userId || undefined })}
            />
          )}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit supplier" onClick={() => setEditing({ id: s.id, name: s.name, contact: s.contact, email: s.email, phone: s.phone, category: s.category || '', branchId: branchIdFor(s) || app.activeBranchId || branchOptions[0]?.id || '' })}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete supplier" onClick={() => setDeleting(s)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const save = () => {
    if (!editing) return
    if (editing.name.trim().length < 2) { toast.error('Enter a supplier name.'); return }
    if (!isEmail(editing.email)) { toast.error('Enter a valid email address.'); return }
    if (!isPhone(editing.phone)) { toast.error('Enter a valid phone number.'); return }
    if (!editing.category) { toast.error('Select a supplier category.'); return }
    if (!editing.branchId || !branchOptions.some((branch) => branch.id === editing.branchId)) { toast.error('Select a permitted branch.'); return }

    const isNew = !editing.id
    const existing = editing.id ? suppliers.find((supplier) => supplier.id === editing.id) : undefined
    const rec: Supplier = {
      ...existing,
      id: editing.id || uid('sup'),
      name: editing.name.trim(),
      contact: editing.contact.trim(),
      email: editing.email.trim(),
      phone: editing.phone.trim(),
      category: editing.category,
      branchId: editing.branchId,
    }
    upsertSupplier(rec)
    if (rec.userId) patchUser(rec.userId, { branchId: rec.branchId })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Supplier', `${isNew ? 'Created' : 'Updated'} ${rec.name}`)
    toast.success(isNew ? 'Supplier added' : 'Supplier updated', rec.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteSupplier(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Supplier', `Deleted ${deleting.name}`)
    toast.success('Supplier removed', deleting.name)
    setDeleting(null)
  }

  const exportRows = rows.map((s) => ({
    name: s.name,
    category: s.category || '',
    branch: branches.find((branch) => branch.id === branchIdFor(s))?.name || '',
    contact: s.contact,
    email: s.email,
    phone: s.phone,
  }))

  if (!canView) {
    return (
      <div>
        <PageHeader title="Supplier management" desc="Vendors that supply your clubs." />
        <Empty title="Not authorised" desc="You need the 'View suppliers' permission to access this page." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Supplier management"
        desc="Manage the vendors that supply equipment, stock, and services to your clubs."
        actions={
          <>
            <ExportButtons filename="suppliers" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={() => setEditing(blank(supplierCategories[0] || '', app.activeBranchId || branchOptions[0]?.id || ''))}><Plus className="size-4" /> New supplier</Button>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search supplier, contact, email…" className="w-full max-w-sm" />
        <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All categories</option>
          {supplierCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(s) => s.id}
          emptyTitle="No suppliers found"
          emptyDesc={suppliers.length ? 'Adjust your search.' : 'Add your first supplier with the New supplier button.'}
        />
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit supplier' : 'New supplier'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Supplier name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Category" required>
                <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  <option value="">Select category…</option>
                  {supplierCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Home branch" required>
                <Select value={editing.branchId} onChange={(e) => setEditing({ ...editing, branchId: e.target.value })}>
                  <option value="">Select branch…</option>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </Field>
              <Field label="Contact person"><Input value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} /></Field>
              <Field label="Email" required><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone" required><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save supplier' : 'Add supplier'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete supplier?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete supplier <span className="font-semibold text-inherit">{deleting.name}</span>? This cannot be undone.
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
