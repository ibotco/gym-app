import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, SearchField, Empty } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { CUSTOMER_STATUSES } from '../../lib/customers'
import { visibleBranches } from '../../lib/accessScope'
import { PortalAccess } from '../../components/PortalAccess'
import { CustomFields } from '../../components/CustomFields'
import type { Customer, CustomerStatus, CustomFieldValues } from '../../types'

type FormState = {
  id?: string
  name: string
  email: string
  phone: string
  company: string
  address: string
  category: string
  branchId: string
  status: CustomerStatus
  notes: string
  customFields: CustomFieldValues
}

const blank = (defaultCategory = '', branchId = 'br_airport'): FormState => ({
  name: '', email: '', phone: '+233 ', company: '', address: '', category: defaultCategory, branchId, status: 'active', notes: '',
  customFields: {},
})

function statusTone(s: CustomerStatus): 'lime' | 'zinc' | 'sky' {
  if (s === 'active') return 'lime'
  if (s === 'prospect') return 'sky'
  return 'zinc'
}

export function Customers() {
  const app = useApp()
  const { customers, users, branches, customerCategories, upsertCustomer, deleteCustomer, patchUser, log } = app
  const { user, hasPermission } = useAuth()
  const toast = useToast()
  const branchOptions = visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive')
  const branchIdFor = (customer: Customer) => customer.branchId || (customer.userId ? users.find((candidate) => candidate.id === customer.userId)?.branchId : undefined)

  const canView = hasPermission('customers.view')
  const canManage = hasPermission('customers.manage')
  const canDelete = hasPermission('customers.delete')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...customers]
      .filter((c) => {
        if (statusFilter && c.status !== statusFilter) return false
        if (catFilter && c.category !== catFilter) return false
        if (!ql) return true
        return `${c.name} ${c.email} ${c.phone} ${c.company || ''} ${c.category}`.toLowerCase().includes(ql)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [customers, q, statusFilter, catFilter])

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'Customer', sortValue: (c) => c.name,
      render: (c) => (
        <div>
          <p className="font-semibold">{c.name}</p>
          <p className="text-xs text-mist">{c.company || c.email}</p>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortValue: (c) => c.email, render: (c) => <span className="text-mist">{c.email}</span> },
    { key: 'category', header: 'Category', sortValue: (c) => c.category, render: (c) => <Badge tone="zinc">{c.category}</Badge> },
    { key: 'branch', header: 'Branch', sortValue: (c) => branches.find((branch) => branch.id === branchIdFor(c))?.name || '', render: (c) => branches.find((branch) => branch.id === branchIdFor(c))?.name || '—' },
    { key: 'phone', header: 'Phone', sortValue: (c) => c.phone, render: (c) => <span className="text-mist">{c.phone}</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <Badge tone={statusTone(c.status)}>{CUSTOMER_STATUSES.find((s) => s.id === c.status)?.label || c.status}</Badge> },
    { key: 'spent', header: 'Spend', sortValue: (c) => c.totalSpent, align: 'right', render: (c) => <span className="font-semibold">{formatGhs(c.totalSpent)}</span> },
    { key: 'joined', header: 'Added', sortValue: (c) => c.createdAt, render: (c) => <span className="text-mist">{formatDate(c.createdAt)}</span> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (c) => (
        <span className="whitespace-nowrap">
          {canManage && (
            <PortalAccess
              subject={{ id: c.id, name: c.name, email: c.email, phone: c.phone, companyId: c.companyId, branchId: branchIdFor(c), userId: c.userId }}
              role="customer"
              entity="Customer"
              onLinked={(userId) => upsertCustomer({ ...c, userId: userId || undefined })}
            />
          )}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit customer" onClick={() => openEdit(c)}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete customer" onClick={() => setDeleting(c)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing(blank(customerCategories[0] || '', app.activeBranchId || branchOptions[0]?.id || ''))
  const openEdit = (c: Customer) => setEditing({
    id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company || '',
    address: c.address || '', category: c.category,
    branchId: branchIdFor(c) || app.activeBranchId || branchOptions[0]?.id || '',
    status: c.status, notes: c.notes || '',
    customFields: c.customFields || {},
  })

  const save = () => {
    if (!editing) return
    if (editing.name.trim().length < 2) { toast.error('Enter a customer name.'); return }
    if (!isEmail(editing.email)) { toast.error('Enter a valid email address.'); return }
    if (!isPhone(editing.phone)) { toast.error('Enter a valid phone number.'); return }
    if (!editing.category) { toast.error('Select a customer category.'); return }
    if (!editing.branchId || !branchOptions.some((branch) => branch.id === editing.branchId)) { toast.error('Select a permitted branch.'); return }
    const clash = customers.some((c) => c.email.toLowerCase() === editing.email.trim().toLowerCase() && c.id !== editing.id)
    if (clash) { toast.error('That email is already in use.'); return }

    const isNew = !editing.id
    const existing = editing.id ? customers.find((customer) => customer.id === editing.id) : undefined
    const rec: Customer = {
      ...existing,
      id: editing.id || uid('cus'),
      name: editing.name.trim(),
      email: editing.email.trim(),
      phone: editing.phone.trim(),
      company: editing.company.trim() || undefined,
      address: editing.address.trim() || undefined,
      category: editing.category,
      branchId: editing.branchId,
      status: editing.status,
      notes: editing.notes.trim() || undefined,
      customFields: editing.customFields,
      totalSpent: isNew ? 0 : (existing?.totalSpent || 0),
      createdAt: isNew ? new Date().toISOString() : (existing?.createdAt || new Date().toISOString()),
    }
    upsertCustomer(rec)
    if (rec.userId) patchUser(rec.userId, { branchId: rec.branchId })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Customer', `${isNew ? 'Created' : 'Updated'} ${rec.name}`)
    toast.success(isNew ? 'Customer created' : 'Customer updated', rec.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteCustomer(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Customer', `Deleted ${deleting.name}`)
    toast.success('Customer deleted', deleting.name)
    setDeleting(null)
  }

  const exportRows = rows.map((c) => ({
    name: c.name, email: c.email, phone: c.phone, company: c.company || '', address: c.address || '',
    category: c.category, branch: branches.find((branch) => branch.id === branchIdFor(c))?.name || '', status: c.status, totalSpent: c.totalSpent, added: c.createdAt,
  }))

  if (!canView) {
    return (
      <div>
        <PageHeader title="Customer management" desc="Walk-in and retail customer records." />
        <Empty title="Not authorised" desc="You need the 'View customers' permission to access this page." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Customer management"
        desc="Track walk-in and retail customers, contact details, status, and lifetime spend."
        actions={
          <>
            <ExportButtons filename="customers" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New customer</Button>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search name, email, company…" className="w-full max-w-sm" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All categories</option>
          {customerCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyTitle="No customers found"
          emptyDesc={customers.length ? 'Adjust your search or filters.' : 'Add your first customer with the New customer button.'}
        />
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit customer' : 'New customer'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Company (optional)"><Input value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} /></Field>
              <Field label="Email" required><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone" required><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="Address"><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
              <Field label="Home branch" required>
                <Select value={editing.branchId} onChange={(e) => setEditing({ ...editing, branchId: e.target.value })}>
                  <option value="">Select branch…</option>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </Field>
              <Field label="Category" required>
                <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  <option value="">Select category…</option>
                  {customerCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as CustomerStatus })}>
                  {CUSTOMER_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Relationship notes, preferences…" /></Field>
            <CustomFields module="customer" values={editing.customFields} onChange={(v) => setEditing({ ...editing, customFields: v })} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save customer' : 'Create customer'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete customer?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete customer <span className="font-semibold text-inherit">{deleting.name}</span>? This cannot be undone.
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
