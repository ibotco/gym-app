import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Power, Building2 } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { nextCompanyId, DEFAULT_COMPANY_ID } from '../../lib/companies'
import { visibleCompanies } from '../../lib/accessScope'
import { CURRENCIES } from '../../lib/currencies'
import { TIMEZONES } from '../../lib/timezones'
import type { Company } from '../../types'

type FormState = {
  id?: string
  name: string
  legalName: string
  email: string
  phone: string
  address: string
  digitalAddress: string
  taxId: string
  currency: string
  timezone: string
  brandPrimary: string
  logoText: string
  webAddress: string
  status: 'active' | 'inactive'
}

const blank = (): FormState => ({
  name: '', legalName: '', email: '', phone: '+233 ', address: '', digitalAddress: '',
  taxId: '', currency: 'GHS', timezone: 'Africa/Accra', brandPrimary: '#C8F542',
  logoText: '', webAddress: '', status: 'active',
})

export function Companies() {
  const { companies, branches, upsertCompany, deleteCompany, setCompanyStatus, setActiveCompany, activeCompanyId, log } = useApp()
  const { user, hasPermission } = useAuth()
  const toast = useToast()

  const canManage = hasPermission('companies.manage')
  const canDelete = hasPermission('companies.delete')
  const canCreate = canManage && (user?.role === 'super_admin' || user?.role === 'gym_manager')
  const canSwitchCompany = user?.role === 'super_admin' || user?.role === 'gym_manager'
  const accessibleCompanies = useMemo(() => visibleCompanies(user, companies, branches), [branches, companies, user])

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [err, setErr] = useState('')

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return accessibleCompanies.filter((c) => {
      if (!ql) return true
      return `${c.name} ${c.legalName || ''} ${c.email} ${c.currency}`.toLowerCase().includes(ql)
    })
  }, [accessibleCompanies, q])

  const branchCount = (id: string) => branches.filter((b) => (b.companyId || DEFAULT_COMPANY_ID) === id).length

  const exportRows = rows.map((c) => ({
    name: c.name, legalName: c.legalName || '', email: c.email, phone: c.phone,
    address: c.address || '', taxId: c.taxId || '', currency: c.currency,
    timezone: c.timezone, status: c.status, branches: branchCount(c.id), created: c.createdAt,
  }))

  const openCreate = () => {
    if (!canCreate) { toast.error('Only Super Admin can create another company.'); return }
    setEditing(blank())
    setErr('')
  }

  const openEdit = (c: Company) => {
    setEditing({
      id: c.id,
      name: c.name,
      legalName: c.legalName || '',
      email: c.email,
      phone: c.phone,
      address: c.address,
      digitalAddress: c.digitalAddress || '',
      taxId: c.taxId || '',
      currency: c.currency,
      timezone: c.timezone,
      brandPrimary: c.brandPrimary,
      logoText: c.logoText || '',
      webAddress: c.webAddress || '',
      status: c.status,
    })
    setErr('')
  }

  const validate = (f: FormState) => {
    if (f.name.trim().length < 2) return 'Company name is required.'
    if (!isEmail(f.email)) return 'Enter a valid company email.'
    if (!isPhone(f.phone)) return 'Enter a valid phone number.'
    if (f.address.trim().length < 4) return 'Address is required.'
    if (!f.currency) return 'Select a currency.'
    if (!f.timezone) return 'Select a timezone.'
    const dup = companies.some((c) => c.name.toLowerCase() === f.name.trim().toLowerCase() && c.id !== f.id)
    if (dup) return 'A company with that name already exists.'
    return ''
  }

  const save = () => {
    if (!editing) return
    if (!canManage) { toast.error('You do not have permission to manage companies.'); return }
    const isNew = !editing.id
    if (isNew && !canCreate) { toast.error('Only Super Admin can create another company.'); return }
    if (!isNew && !accessibleCompanies.some((company) => company.id === editing.id)) {
      toast.error('You cannot manage a company outside your organisation.'); return
    }
    const v = validate(editing)
    if (v) { setErr(v); return }
    const record: Company = {
      id: editing.id || nextCompanyId(),
      name: editing.name.trim(),
      legalName: editing.legalName.trim() || undefined,
      email: editing.email.trim(),
      phone: editing.phone.trim(),
      address: editing.address.trim(),
      digitalAddress: editing.digitalAddress.trim() || undefined,
      taxId: editing.taxId.trim() || undefined,
      currency: editing.currency,
      timezone: editing.timezone,
      brandPrimary: editing.brandPrimary,
      logoText: editing.logoText.trim() || editing.name.trim(),
      webAddress: editing.webAddress.trim() || undefined,
      status: editing.status,
      isDefault: isNew ? false : companies.find((c) => c.id === editing.id)?.isDefault,
      createdAt: isNew ? new Date().toISOString().slice(0, 10) : companies.find((c) => c.id === editing.id)?.createdAt || '',
    }
    upsertCompany(record)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Company', `${isNew ? 'Created' : 'Updated'} ${record.name}`)
    toast.success(isNew ? 'Company created' : 'Company updated')
    setEditing(null)
  }

  const toggleStatus = (c: Company) => {
    if (c.isDefault) { toast.error('The default company cannot be deactivated.'); return }
    const next = c.status === 'active' ? 'inactive' : 'active'
    setCompanyStatus(c.id, next)
    log(user?.id || 'system', 'UPDATE', 'Company', `${next === 'active' ? 'Activated' : 'Deactivated'} ${c.name}`)
    toast.success(`${c.name} ${next === 'active' ? 'activated' : 'deactivated'}`)
  }

  const doDelete = () => {
    if (!deleting) return
    if (deleting.isDefault) { toast.error('The default company cannot be deleted.'); setDeleting(null); return }
    deleteCompany(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Company', `Deleted ${deleting.name}`)
    toast.success('Company deleted')
    setDeleting(null)
  }

  const columns: Column<Company>[] = [
    { key: 'name', header: 'COMPANY', sortValue: (c) => c.name, render: (c) => (
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg text-white" style={{ backgroundColor: c.brandPrimary }}>
          <Building2 className="size-4" />
        </div>
        <div>
          <p className="font-semibold">{c.name}{c.isDefault ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-lime">Default</span> : null}</p>
          <p className="text-xs text-mist">{c.legalName || c.email}</p>
        </div>
      </div>
    ) },
    { key: 'email', header: 'CONTACT', sortValue: (c) => c.email, render: (c) => (
      <div className="text-sm"><p>{c.email}</p><p className="text-xs text-mist">{c.phone}</p></div>
    ) },
    { key: 'currency', header: 'CURRENCY', sortValue: (c) => c.currency, render: (c) => <span className="text-sm">{c.currency}</span> },
    { key: 'branches', header: 'BRANCHES', sortValue: (c) => branchCount(c.id), render: (c) => <span className="text-sm">{branchCount(c.id)}</span> },
    { key: 'created', header: 'CREATED', sortValue: (c) => c.createdAt, render: (c) => <span className="text-sm text-mist">{formatDate(c.createdAt)}</span> },
    { key: 'status', header: 'STATUS', sortValue: (c) => c.status, render: (c) => <Badge tone={c.status === 'active' ? 'lime' : 'zinc'}>{c.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS', render: (c) => (
        <div className="flex items-center justify-end gap-1">
          {canManage && (
            <>
              <button className="rounded-lg p-2 text-mist hover:text-lime" title={c.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(c)}>
                <Power className="size-4" />
              </button>
              <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(c)}>
                <Pencil className="size-4" />
              </button>
            </>
          )}
          {canDelete && !c.isDefault && (
            <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(c)}>
              <Trash2 className="size-4" />
            </button>
          )}
          {canSwitchCompany && !c.isDefault && c.id !== activeCompanyId && (
            <button className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-lime hover:bg-lime/10" onClick={() => { setActiveCompany(c.id); toast.success(`Switched to ${c.name}`) }}>
              Switch
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Companies"
        desc="Manage the tenants on the Advance FitPro platform — each with isolated data and branches."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="size-4" /> New company</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search companies…" className="max-w-sm" />
        <div className="ml-auto"><ExportButtons filename="companies" rows={exportRows} /></div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(c) => c.id}
        emptyTitle="No companies"
        emptyDesc={canManage ? 'Create your first tenant company to get started.' : 'No companies to show.'}
      />

      {/* Create / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit company' : 'New company'} wide>
        {editing && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Legal name"><Input value={editing.legalName} onChange={(e) => setEditing({ ...editing, legalName: e.target.value })} /></Field>
              <Field label="Email"><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Address"><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field></div>
              <Field label="Digital address"><Input value={editing.digitalAddress} onChange={(e) => setEditing({ ...editing, digitalAddress: e.target.value })} /></Field>
              <Field label="Tax ID (TIN)"><Input value={editing.taxId} onChange={(e) => setEditing({ ...editing, taxId: e.target.value })} /></Field>
              <Field label="Currency">
                <Select value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </Select>
              </Field>
              <Field label="Timezone">
                <Select value={editing.timezone} onChange={(e) => setEditing({ ...editing, timezone: e.target.value })}>
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                </Select>
              </Field>
              <Field label="Brand colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.brandPrimary} onChange={(e) => setEditing({ ...editing, brandPrimary: e.target.value })} className="h-10 w-14 cursor-pointer rounded border border-line bg-transparent p-1" />
                  <Input value={editing.brandPrimary} onChange={(e) => setEditing({ ...editing, brandPrimary: e.target.value })} />
                </div>
              </Field>
              <Field label="Logo text"><Input value={editing.logoText} onChange={(e) => setEditing({ ...editing, logoText: e.target.value })} placeholder={editing.name} /></Field>
              <div className="sm:col-span-2"><Field label="Web address"><Input value={editing.webAddress} onChange={(e) => setEditing({ ...editing, webAddress: e.target.value })} placeholder="https://" /></Field></div>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <Button className="mt-4 w-full" onClick={save}>{editing.id ? 'Save changes' : 'Create company'}</Button>
          </>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete company?">
        {deleting && (
          <>
            <p className="text-sm text-mist">
              Delete company <span className="font-semibold text-inherit">{deleting.name}</span>? All its branches and data will be orphaned. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
