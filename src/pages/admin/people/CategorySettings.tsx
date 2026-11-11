import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, Button, Badge, Input } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

export function CategorySettings({
  title,
  desc,
  label,
  items,
  canManage,
  canDelete,
  countFor,
  onAdd,
  onRename,
  onDelete,
  onLog,
}: {
  title: string
  desc: string
  /** Singular noun used in toasts/logs, e.g. "supplier category". */
  label: string
  items: string[]
  canManage: boolean
  canDelete: boolean
  countFor: (name: string) => number
  onAdd: (name: string) => { ok: boolean; error?: string }
  onRename: (oldName: string, newName: string) => { ok: boolean; error?: string }
  onDelete: (name: string) => { ok: boolean; error?: string }
  onLog: (action: string, details: string) => void
}) {
  const { user } = useAuth()
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const doAdd = () => {
    const res = onAdd(newName)
    if (!res.ok) { toast.error('Could not add', res.error); return }
    onLog('CREATE', `Added ${label} "${newName.trim()}"`)
    toast.success(`${label} added`, newName.trim())
    setNewName('')
    setAdding(false)
  }

  const doRename = (oldName: string) => {
    const res = onRename(oldName, editValue)
    if (!res.ok) { toast.error('Could not rename', res.error); return }
    onLog('UPDATE', `Renamed ${label} "${oldName}" to "${editValue.trim()}"`)
    toast.success(`${label} renamed`, editValue.trim())
    setEditingName(null)
  }

  const doDelete = (name: string) => {
    const res = onDelete(name)
    if (!res.ok) { toast.error('Could not delete', res.error); return }
    onLog('DELETE', `Deleted ${label} "${name}"`)
    toast.success(`${label} deleted`, name)
  }

  return (
    <div>
      <PageHeader
        title={title}
        desc={desc}
        actions={canManage ? <Button onClick={() => setAdding(true)}><Plus className="size-4" /> New {label}</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>In use</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {items.map((name) => (
              <tr key={name}>
                {editingName === name ? (
                  <>
                    <td><Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} /></td>
                    <td><Badge tone="zinc">{countFor(name)}</Badge></td>
                    <td className="whitespace-nowrap">
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Save" onClick={() => doRename(name)}><Check className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Cancel" onClick={() => setEditingName(null)}><X className="size-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-semibold">{name}</td>
                    <td><Badge tone={countFor(name) > 0 ? 'lime' : 'zinc'}>{countFor(name)}</Badge></td>
                    <td className="whitespace-nowrap">
                      {canManage && (
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title="Rename" onClick={() => { setEditingName(name); setEditValue(name) }}><Pencil className="size-4" /></button>
                      )}
                      {canDelete && (
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => doDelete(name)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {adding && (
              <tr>
                <td><Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`${label} name`} onKeyDown={(e) => e.key === 'Enter' && doAdd()} /></td>
                <td><Badge tone="zinc">0</Badge></td>
                <td className="whitespace-nowrap">
                  <button className="rounded-lg p-2 text-mist hover:text-lime" title="Add" onClick={doAdd}><Check className="size-4" /></button>
                  <button className="rounded-lg p-2 text-mist hover:text-ember" title="Cancel" onClick={() => setAdding(false)}><X className="size-4" /></button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-mist">
        Categories in use cannot be deleted — reassign any {label} entries first. Renaming a category updates all linked records.
        {user ? '' : ''}
      </p>
    </div>
  )
}
