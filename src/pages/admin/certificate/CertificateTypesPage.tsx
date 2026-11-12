import { useMemo, useState } from 'react'
import { FileBadge, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, Textarea } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext, certStatusTone } from './CertificateShared'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'

const STATUSES = ['Active', 'Inactive'] as const

type Draft = { name: string; description: string; serialPrefix: string; status: string }

const blank: Draft = { name: '', description: '', serialPrefix: 'CERT-', status: 'Active' }

export function CertificateTypesPage() {
  const { types, can, patch } = useCertificateContext()
  const toast = useToast()
  const allowed = can('configure')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return types
    return types.filter((r) => [r.name, r.description, r.serialPrefix, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [types, query])

  const openNew = () => { setDraft(blank); setEditing({ id: '' } as EduRow) }
  const openEdit = (row: EduRow) => {
    setDraft({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      serialPrefix: String(row.serialPrefix ?? 'CERT-'),
      status: String(row.status ?? 'Active'),
    })
    setEditing(row)
  }

  const save = () => {
    if (!draft.name.trim()) { toast.error('Name required', 'Certificate type needs a name.'); return }
    const row: EduRow = {
      id: editing?.id || uid('certtype'),
      name: draft.name.trim(),
      description: draft.description.trim(),
      serialPrefix: draft.serialPrefix.trim() || 'CERT-',
      status: draft.status,
    }
    const next = editing?.id ? types.map((r) => r.id === editing.id ? row : r) : [...types, row]
    patch({ certificateTypes: next as EduRow[] })
    toast.success(editing?.id ? 'Certificate type updated' : 'Certificate type created', row.name)
    setEditing(null)
  }

  const remove = () => {
    if (!confirmDelete) return
    patch({ certificateTypes: types.filter((r) => r.id !== confirmDelete.id) as EduRow[] })
    toast.success('Deleted', String(confirmDelete.name ?? 'Certificate type'))
    setConfirmDelete(null)
  }

  const columns: Column<EduRow>[] = [
    { key: 'name', header: 'Certificate Type', render: (r) => <span className="font-semibold">{String(r.name ?? '')}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-sm text-mist">{String(r.description ?? '—')}</span> },
    { key: 'serialPrefix', header: 'Serial Prefix', render: (r) => <span className="font-mono text-xs rounded bg-black/5 px-2 py-1 dark:bg-white/10">{String(r.serialPrefix ?? '')}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={certStatusTone(String(r.status))}>{String(r.status ?? '')}</Badge> },
    {
      key: 'actions', header: '', width: 120, render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)}><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Certificate Types" desc="Define the kinds of certificates this organisation issues — achievement, completion, participation and more." printTitle="Certificate Types" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot edit certificate types.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search types…" className="max-w-xs" />
        <div className="ml-auto flex gap-2">
          <Badge tone="zinc">{filtered.length} type{filtered.length === 1 ? '' : 's'}</Badge>
          <Button size="sm" onClick={openNew} disabled={!allowed}><Plus className="size-4" /> New Type</Button>
        </div>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No certificate types" emptyDesc="Create your first type to get started." />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Certificate Type' : 'New Certificate Type'} footer={<><Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" onClick={save} disabled={!allowed}>Save</Button></>}>
        <div className="grid gap-4">
          <Field label="Certificate Type *"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Achievement Certificate" /></Field>
          <Field label="Description"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What is this certificate for?" rows={2} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serial Prefix"><Input value={draft.serialPrefix} onChange={(e) => setDraft({ ...draft, serialPrefix: e.target.value })} placeholder="CERT-" /></Field>
            <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option>Active</option><option>Inactive</option></Select></Field>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete certificate type?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String(confirmDelete?.name ?? '')}</b>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

function EmptyState({ onNew, allowed }: { onNew: () => void; allowed: boolean }) {
  return (
    <div className="grid place-items-center gap-3 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-lime/15"><FileBadge className="size-6 text-lime-700" /></div>
      <div><p className="font-semibold">No certificate types yet</p><p className="text-sm text-mist">Create your first type to start issuing certificates.</p></div>
      <Button size="sm" onClick={onNew} disabled={!allowed}><Plus className="size-4" /> New Type</Button>
    </div>
  )
}
