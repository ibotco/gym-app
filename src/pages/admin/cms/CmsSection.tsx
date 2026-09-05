import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Switch, SearchField } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { RichTextEditor } from '../../../components/RichTextEditor'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { CMS_SECTIONS, nextCmsId, type CmsField } from '../../../lib/cms'

type Row = Record<string, unknown>

function emptyValue(f: CmsField): unknown {
  if (f.type === 'number') return 0
  if (f.type === 'checkbox') return false
  return ''
}

function display(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export function CmsSection({ sectionKey }: { sectionKey: string }) {
  const { cms, setCms, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const config = CMS_SECTIONS[sectionKey]

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; form: Row } | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [err, setErr] = useState('')

  const rows = useMemo(() => (cms[config.collection] as unknown as Row[]) || [], [cms, config])
  const ql = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!ql) return rows
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(ql)))
  }, [rows, ql])

  const resolveOptions = (f: CmsField): { value: string; label: string }[] => {
    if (f.options) return f.options
    if (f.key === 'parentId') return (cms.menus as unknown as Row[]).map((m) => ({ value: String(m.id), label: String(m.title || m.id) }))
    if (f.key === 'categoryId') return (cms.galleryCategories as unknown as Row[]).map((c) => ({ value: String(c.id), label: String(c.name || c.id) }))
    return []
  }

  const openCreate = () => {
    const form: Row = {}
    for (const f of config.fields) form[f.key] = emptyValue(f)
    setEditing({ id: null, form })
    setErr('')
  }

  const openEdit = (row: Row) => {
    const form: Row = {}
    for (const f of config.fields) form[f.key] = row[f.key] ?? emptyValue(f)
    setEditing({ id: String(row.id), form })
    setErr('')
  }

  const onImageUpload = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditing((ed) => (ed ? { ...ed, form: { ...ed.form, [key]: String(reader.result) } } : ed))
    reader.readAsDataURL(file)
  }

  const save = () => {
    if (!editing) return
    for (const f of config.fields) {
      if (f.required) {
        const v = editing.form[f.key]
        if (v === '' || v === undefined || v === null) { setErr(`${f.label} is required.`); return }
      }
    }
    const record: Row = { id: editing.id || nextCmsId(sectionKey.slice(0, 4)) }
    for (const f of config.fields) {
      let v = editing.form[f.key]
      if (f.type === 'number') v = Number(v) || 0
      if (f.type === 'checkbox') v = !!v
      record[f.key] = v
    }
    const list = rows as Row[]
    const next = editing.id ? list.map((r) => (r.id === editing.id ? record : r)) : [...list, record]
    setCms({ ...cms, [config.collection]: next } as never)
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'FrontCMS', `${editing.id ? 'Updated' : 'Created'} ${config.rowTitle(record)}`)
    toast.success(editing.id ? 'Item updated' : 'Item created')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    const next = (rows as Row[]).filter((r) => r.id !== deleting.id)
    setCms({ ...cms, [config.collection]: next } as never)
    log(user?.id || 'system', 'DELETE', 'FrontCMS', `Deleted ${config.rowTitle(deleting)}`)
    toast.success('Item deleted')
    setDeleting(null)
  }

  const columns: Column<Row>[] = [
    ...config.columns.map((c) => ({
      key: c.key,
      header: c.label.toUpperCase(),
      sortValue: (r: Row) => display(r[c.key]),
      render: (r: Row) => (String(r[c.key] || '').startsWith('data:image') ? <img src={String(r[c.key])} alt="" className="h-9 w-14 rounded object-cover" /> : <span className="text-sm">{display(r[c.key])}</span>),
    })),
    {
      key: 'actions', header: 'ACTIONS',
      render: (r: Row) => (
        <span className="flex items-center justify-end gap-1 whitespace-nowrap">
          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={config.title}
        desc={config.description}
        actions={<Button onClick={openCreate}><Plus className="size-4" /> New</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder={`Search ${config.title.toLowerCase()}…`} className="max-w-sm" />
        <div className="ml-auto"><ExportButtons filename={`cms-${sectionKey}`} rows={filtered.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, display(v)])))} /></div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => String(r.id)}
        emptyTitle={`No ${config.title.toLowerCase()} yet`}
        emptyDesc="Create your first item to get started."
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit item' : 'New item'} wide>
        {editing && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.fields.map((f) => {
                const val = editing.form[f.key]
                return (
                  <Field key={f.key} label={f.label} required={f.required}>
                    {f.type === 'text' && <Input value={String(val ?? '')} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: e.target.value } })} placeholder={f.placeholder} />}
                    {f.type === 'textarea' && <Textarea value={String(val ?? '')} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: e.target.value } })} rows={3} />}
                    {f.type === 'number' && <Input type="number" value={String(val ?? 0)} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: e.target.value } })} />}
                    {f.type === 'date' && <Input type="date" value={String(val ?? '')} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: e.target.value } })} />}
                    {f.type === 'select' && (
                      <Select value={String(val ?? '')} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: e.target.value } })}>
                        <option value="">Select…</option>
                        {resolveOptions(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    )}
                    {f.type === 'checkbox' && (
                      <div className="flex h-10 items-center"><Switch checked={!!val} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, [f.key]: v } })} aria-label={f.label} /></div>
                    )}
                    {f.type === 'richtext' && <div className="sm:col-span-2"><RichTextEditor value={String(val ?? '')} onChange={(html) => setEditing({ ...editing, form: { ...editing.form, [f.key]: html } })} /></div>}
                    {f.type === 'image' && (
                      <div>
                        {val ? (
                          <div className="flex items-center gap-2">
                            <img src={String(val)} alt="" className="h-14 w-20 rounded object-cover" />
                            <div className="flex gap-1">
                              <label className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5">Replace<input type="file" accept="image/*" className="hidden" onChange={onImageUpload(f.key)} /></label>
                              <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ember" onClick={() => setEditing({ ...editing, form: { ...editing.form, [f.key]: '' } })}>Remove</button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-3 py-4 text-xs text-mist hover:border-lime/50">Click to upload<input type="file" accept="image/*" className="hidden" onChange={onImageUpload(f.key)} /></label>
                        )}
                      </div>
                    )}
                  </Field>
                )
              })}
            </div>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <Button className="mt-4 w-full" onClick={save}>{editing.id ? 'Save changes' : 'Create'}</Button>
          </>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete item?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{config.rowTitle(deleting)}</span>? This cannot be undone.</p>
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
