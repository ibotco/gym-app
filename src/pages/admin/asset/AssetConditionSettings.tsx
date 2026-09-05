import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, Button, Badge, Input } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

export function AssetConditionSettings() {
  const app = useApp()
  const { assetConditions, addAssetCondition, renameAssetCondition, deleteAssetCondition, assets, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const countFor = (name: string) => assets.filter((a) => a.condition === name).length

  const doAdd = () => {
    const res = addAssetCondition(newName)
    if (!res.ok) { toast.error('Could not add', res.error); return }
    log(user?.id || 'system', 'CREATE', 'AssetCondition', `Added condition "${newName.trim()}"`)
    toast.success('Condition added', newName.trim())
    setNewName('')
    setAdding(false)
  }

  const doRename = (oldName: string) => {
    const res = renameAssetCondition(oldName, editValue)
    if (!res.ok) { toast.error('Could not rename', res.error); return }
    log(user?.id || 'system', 'UPDATE', 'AssetCondition', `Renamed "${oldName}" to "${editValue.trim()}"`)
    toast.success('Condition renamed', editValue.trim())
    setEditingName(null)
  }

  const doDelete = (name: string) => {
    const res = deleteAssetCondition(name)
    if (!res.ok) { toast.error('Could not delete', res.error); return }
    log(user?.id || 'system', 'DELETE', 'AssetCondition', `Deleted condition "${name}"`)
    toast.success('Condition deleted', name)
  }

  return (
    <div>
      <PageHeader
        title="Asset condition settings"
        desc="Manage the condition labels used to describe the state of your assets."
        actions={canManage ? <Button onClick={() => setAdding(true)}><Plus className="size-4" /> New condition</Button> : undefined}
      />

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Condition</th><th>Assets</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {assetConditions.map((name) => (
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
                <td><Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Condition name" onKeyDown={(e) => e.key === 'Enter' && doAdd()} /></td>
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
