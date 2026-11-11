import { useMemo, useState } from 'react'
import { Pencil, Plus, Settings2, ShieldAlert, Trash2, Database } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext } from './CertificateShared'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'

type Draft = { settingName: string; certificateType: string; autoNumbering: string; serialPrefix: string; qrCode: string; digitalSignature: string; dataSource: string; status: string }

const DATA_SOURCES = ['Student', 'Employee', 'Member', 'All', 'Manual'] as const

export function CertificateSettingsPage() {
  const { settings, types, can, patch } = useCertificateContext()
  const toast = useToast()
  const allowed = can('settings')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [draft, setDraft] = useState<Draft>({ settingName: '', certificateType: '', autoNumbering: 'Yes', serialPrefix: 'CERT-', qrCode: 'Yes', digitalSignature: 'Yes', dataSource: 'All', status: 'Active' })
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)

  const typeNames = useMemo(() => types.map((r) => String(r.name ?? '')).filter(Boolean), [types])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return settings
    return settings.filter((r) => [r.settingName, r.certificateType, r.serialPrefix, r.dataSource, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [settings, query])

  const openNew = () => { setDraft({ settingName: '', certificateType: typeNames[0] ?? '', autoNumbering: 'Yes', serialPrefix: 'CERT-', qrCode: 'Yes', digitalSignature: 'Yes', dataSource: 'All', status: 'Active' }); setEditing({ id: '' } as EduRow) }
  const openEdit = (row: EduRow) => {
    setDraft({
      settingName: String(row.settingName ?? ''),
      certificateType: String(row.certificateType ?? ''),
      autoNumbering: String(row.autoNumbering ?? 'Yes'),
      serialPrefix: String(row.serialPrefix ?? 'CERT-'),
      qrCode: String(row.qrCode ?? 'Yes'),
      digitalSignature: String(row.digitalSignature ?? 'Yes'),
      dataSource: String(row.dataSource ?? 'All'),
      status: String(row.status ?? 'Active'),
    })
    setEditing(row)
  }
  const save = () => {
    if (!draft.settingName.trim()) { toast.error('Name required', 'Give this setting a name.'); return }
    const row: EduRow = {
      id: editing?.id || uid('certset'),
      settingName: draft.settingName.trim(),
      certificateType: draft.certificateType,
      autoNumbering: draft.autoNumbering,
      serialPrefix: draft.serialPrefix.trim() || 'CERT-',
      qrCode: draft.qrCode,
      digitalSignature: draft.digitalSignature,
      dataSource: draft.dataSource,
      status: draft.status,
    }
    const next = editing?.id ? settings.map((r) => r.id === editing.id ? row : r) : [...settings, row]
    patch({ certificateSettings: next as EduRow[] })
    toast.success(editing?.id ? 'Setting updated' : 'Setting created', draft.settingName)
    setEditing(null)
  }
  const remove = () => {
    if (!confirmDelete) return
    patch({ certificateSettings: settings.filter((r) => r.id !== confirmDelete.id) as EduRow[] })
    toast.success('Deleted', String(confirmDelete.settingName ?? 'Setting'))
    setConfirmDelete(null)
  }

  const columns: Column<EduRow>[] = [
    { key: 'settingName', header: 'Setting Name', render: (r) => <span className="font-semibold">{String(r.settingName ?? '')}</span> },
    { key: 'certificateType', header: 'Certificate Type', render: (r) => <span className="text-sm">{String(r.certificateType ?? '—')}</span> },
    { key: 'dataSource', header: 'Data Source', render: (r) => {
      const src = String(r.dataSource ?? 'All')
      const tone = src === 'Student' ? 'blue' : src === 'Employee' ? 'violet' : src === 'Member' ? 'teal' : src === 'Manual' ? 'zinc' : 'emerald'
      return <Badge tone={tone as 'blue' | 'violet' | 'teal' | 'zinc' | 'emerald'}>{src}</Badge>
    } },
    { key: 'serialPrefix', header: 'Prefix', render: (r) => <span className="font-mono text-xs rounded bg-black/5 px-2 py-1 dark:bg-white/10">{String(r.serialPrefix ?? '')}</span> },
    { key: 'autoNumbering', header: 'Auto No.', render: (r) => <Badge tone={String(r.autoNumbering).toLowerCase() === 'yes' ? 'lime' : 'zinc'}>{String(r.autoNumbering ?? '')}</Badge> },
    { key: 'qrCode', header: 'QR', render: (r) => <Badge tone={String(r.qrCode).toLowerCase() === 'yes' ? 'lime' : 'zinc'}>{String(r.qrCode ?? '')}</Badge> },
    { key: 'digitalSignature', header: 'Signature', render: (r) => <Badge tone={String(r.digitalSignature).toLowerCase() === 'yes' ? 'lime' : 'zinc'}>{String(r.digitalSignature ?? '')}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={String(r.status).toLowerCase() === 'active' ? 'lime' : 'amber'}>{String(r.status ?? '')}</Badge> },
    {
      key: 'actions', header: '', width: 100, render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)}><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Certificate Settings" desc="Control auto-numbering, prefixes, QR codes, digital signatures and data source for auto-population per certificate type." printTitle="Certificate Settings" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot edit settings.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search settings…" className="max-w-xs" />
        <div className="ml-auto flex gap-2">
          <Badge tone="zinc">{filtered.length} setting{filtered.length === 1 ? '' : 's'}</Badge>
          <Button size="sm" onClick={openNew} disabled={!allowed}><Plus className="size-4" /> New Setting</Button>
        </div>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No settings yet" emptyDesc="Add a setting to configure numbering and verification for a certificate type." />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Setting' : 'New Setting'} footer={<><Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" onClick={save} disabled={!allowed}>Save</Button></>}>
        <div className="grid gap-4">
          <Field label="Setting Name *"><Input value={draft.settingName} onChange={(e) => setDraft({ ...draft, settingName: e.target.value })} placeholder="e.g. Default numbering" /></Field>
          <Field label="Certificate Type"><Select value={draft.certificateType} onChange={(e) => setDraft({ ...draft, certificateType: e.target.value })}><option value="">All types</option>{typeNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          <div className="rounded-xl border border-line bg-blue-50/40 p-4 dark:bg-blue-50/10">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300"><Database className="size-4" /> Data Source for Auto-Population</h4>
            <Field label="Default Data Source">
              <Select value={draft.dataSource} onChange={(e) => setDraft({ ...draft, dataSource: e.target.value })}>
                <option value="All">All — Student, Employee & Member</option>
                <option value="Student">Student — from School database</option>
                <option value="Employee">Employee — from HR database</option>
                <option value="Member">Member — from Membership database</option>
                <option value="Manual">Manual — no auto-population</option>
              </Select>
            </Field>
            <p className="mt-2 text-xs text-mist">
              When generating a certificate, the holder picker will default to this data source. "All" shows students, employees and members. "Manual" disables auto-population entirely.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Auto Numbering"><Select value={draft.autoNumbering} onChange={(e) => setDraft({ ...draft, autoNumbering: e.target.value })}><option>Yes</option><option>No</option></Select></Field>
            <Field label="Serial Prefix"><Input value={draft.serialPrefix} onChange={(e) => setDraft({ ...draft, serialPrefix: e.target.value })} placeholder="CERT-" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Include QR Code"><Select value={draft.qrCode} onChange={(e) => setDraft({ ...draft, qrCode: e.target.value })}><option>Yes</option><option>No</option></Select></Field>
            <Field label="Digital Signature"><Select value={draft.digitalSignature} onChange={(e) => setDraft({ ...draft, digitalSignature: e.target.value })}><option>Yes</option><option>No</option></Select></Field>
          </div>
          <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option>Active</option><option>Inactive</option></Select></Field>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete setting?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String(confirmDelete?.settingName ?? '')}</b>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}
