import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button, Badge, Modal, Field, Input, Select, Switch } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES, moduleLabel, nextCustomFieldId } from '../../lib/customFields'
import type { CustomField, CustomFieldType } from '../../types'

type FormState = {
  id?: string
  name: string
  type: CustomFieldType
  module: string
  required: boolean
  options: string
}

const blank = (): FormState => ({ name: '', type: 'text', module: 'member', required: false, options: '' })

export function CustomFieldsSettings() {
  const { customFields, upsertCustomField, deleteCustomField, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<CustomField | null>(null)
  const [err, setErr] = useState('')

  const openCreate = () => { setEditing(blank()); setErr('') }

  const openEdit = (f: CustomField) => {
    setEditing({ id: f.id, name: f.name, type: f.type, module: f.module, required: f.required, options: (f.options || []).join(', ') })
    setErr('')
  }

  const save = () => {
    if (!editing) return
    if (editing.name.trim().length < 2) { setErr('Enter a field name.'); return }
    if (editing.type === 'select' && !editing.options.trim()) { setErr('Enter at least one option for a select field.'); return }
    const record: CustomField = {
      id: editing.id || nextCustomFieldId(),
      name: editing.name.trim(),
      type: editing.type,
      module: editing.module,
      required: editing.required,
      options: editing.type === 'select' ? editing.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
    }
    upsertCustomField(record)
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'CustomField', `${editing.id ? 'Updated' : 'Created'} ${record.name}`)
    toast.success(editing.id ? 'Custom field updated' : 'Custom field created')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteCustomField(deleting.id)
    log(user?.id || 'system', 'DELETE', 'CustomField', `Deleted ${deleting.name}`)
    toast.success('Custom field deleted')
    setDeleting(null)
  }

  return (
    <div className="mt-4 max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-mist">
          Custom fields appear on the relevant forms (members, customers, leads, employees…). Define them once here and they&apos;ll show up across the app.
        </p>
        <Button className="shrink-0 whitespace-nowrap" onClick={openCreate}><Plus className="size-4" /> New custom field</Button>
      </div>

      <div className="card p-5">
        {customFields.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist">No custom fields yet. Add one to extend your forms.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-mist">
                  <th className="py-2 pr-3">Field name</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Module</th>
                  <th className="py-2 pr-3">Required</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customFields.map((f) => (
                  <tr key={f.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-3 font-semibold">{f.name}</td>
                    <td className="py-2.5 pr-3">{CUSTOM_FIELD_TYPES.find((t) => t.value === f.type)?.label || f.type}</td>
                    <td className="py-2.5 pr-3">{moduleLabel(f.module)}</td>
                    <td className="py-2.5 pr-3">{f.required ? <Badge tone="amber">Required</Badge> : <Badge tone="zinc">Optional</Badge>}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(f)}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(f)}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit custom field' : 'New custom field'}>
        {editing && (
          <>
            <div className="grid gap-3">
              <Field label="Field name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Occupation" /></Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as CustomFieldType })}>
                  {CUSTOM_FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Module (where it appears)">
                <Select value={editing.module} onChange={(e) => setEditing({ ...editing, module: e.target.value })}>
                  {CUSTOM_FIELD_MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              {editing.type === 'select' && (
                <Field label="Options (comma separated)"><Input value={editing.options} onChange={(e) => setEditing({ ...editing, options: e.target.value })} placeholder="Option A, Option B" /></Field>
              )}
              <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span className="text-sm font-semibold">Required field</span>
                <Switch checked={editing.required} onChange={(v) => setEditing({ ...editing, required: v })} aria-label="Required" />
              </div>
            </div>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <Button className="mt-4 w-full" onClick={save}>{editing.id ? 'Save changes' : 'Create custom field'}</Button>
          </>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete custom field?">
        {deleting && (
          <>
            <p className="text-sm text-mist">
              Delete custom field <span className="font-semibold text-inherit">{deleting.name}</span>? It will be removed from all forms and its stored values ignored.
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
