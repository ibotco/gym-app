import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, Button, Badge, Input } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

export function AssetCategorySettings() {
  const app = useApp()
  const { assetCategories, addAssetCategory, renameAssetCategory, deleteAssetCategory, assets, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const countFor = (name: string) => assets.filter((a) => a.category === name).length

  const doAdd = () => {
    const res = addAssetCategory(newName)
    if (!res.ok) { toast.error('Could not add', res.error); return }
    log(user?.id || 'system', 'CREATE', 'AssetCategory', `Added category "${newName.trim()}"`)
    toast.success('Category added', newName.trim())
    setNewName('')
    setAdding(false)
  }

  const doRename = (oldName: string) => {
    const res = renameAssetCategory(oldName, editValue)
    if (!res.ok) { toast.error('Could not rename', res.error); return }
    log(user?.id || 'system', 'UPDATE', 'AssetCategory', `Renamed "${oldName}" to "${editValue.trim()}"`)
    toast.success('Category renamed', editValue.trim())
    setEditingName(null)
  }

  const doDelete = (name: string) => {
    const res = deleteAssetCategory(name)
    if (!res.ok) { toast.error('Could not delete', res.error); return }
    log(user?.id || 'system', 'DELETE', 'AssetCategory', `Deleted category "${name}"`)
    toast.success('Category deleted', name)
  }

  return (
    <div>
      <PageHeader
        title="Asset category settings"
        desc="Manage the categories used to organise your asset register."
        actions={canManage ? <Button onClick={() => setAdding(true)}><Plus className="size-4" /> New category</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Category</th><th>Assets</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {assetCategories.map((name) => (
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
                        <>
                          <button className="rounded-lg p-2 text-mist hover:text-lime" title="Rename" onClick={() => { setEditingName(name); setEditValue(name) }}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => doDelete(name)}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {adding && (
              <tr>
                <td><Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" onKeyDown={(e) => e.key === 'Enter' && doAdd()} /></td>
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
    </div>
  )
}
