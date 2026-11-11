import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { PageHeader, Button, Badge, Input } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import type { Asset } from '../../../types'
import type { KindCategories } from '../../../lib/assetSettings'

const kindOf = (a: Asset) => a.assetType ?? 'asset'

type CatTab = 'asset' | keyof KindCategories

const CAT_TABS: { id: CatTab; label: string; column: string }[] = [
  { id: 'asset', label: 'Assets', column: 'Asset Category' },
  { id: 'component', label: 'Components', column: 'Component Category' },
  { id: 'accessory', label: 'Accessories', column: 'Accessory Category' },
  { id: 'consumable', label: 'Consumables', column: 'Consumable Category' },
  { id: 'license', label: 'Licenses', column: 'License Category' },
]

export function AssetCategorySettings() {
  const app = useApp()
  const {
    assetCategories, addAssetCategory, renameAssetCategory, deleteAssetCategory,
    assetKindCategories, addKindCategory, renameKindCategory, deleteKindCategory,
    assets, log,
  } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [tab, setTab] = useState<CatTab>('asset')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const listFor = (t: CatTab): string[] => (t === 'asset' ? assetCategories : assetKindCategories[t])
  const countFor = (name: string) =>
    assets.filter((a) => (tab === 'asset' ? kindOf(a) === 'asset' : kindOf(a) === tab) && a.category === name).length

  const doAdd = () => {
    const res = tab === 'asset' ? addAssetCategory(newName) : addKindCategory(tab, newName)
    if (!res.ok) { toast.error('Could not add', res.error); return }
    log(user?.id || 'system', 'CREATE', 'AssetCategory', `Added ${CAT_TABS.find((c) => c.id === tab)?.column.toLowerCase()} "${newName.trim()}"`)
    toast.success('Category added', newName.trim())
    setNewName('')
    setAdding(false)
  }

  const doRename = (oldName: string) => {
    const res = tab === 'asset' ? renameAssetCategory(oldName, editValue) : renameKindCategory(tab, oldName, editValue)
    if (!res.ok) { toast.error('Could not rename', res.error); return }
    log(user?.id || 'system', 'UPDATE', 'AssetCategory', `Renamed "${oldName}" to "${editValue.trim()}"`)
    toast.success('Category renamed', editValue.trim())
    setEditingName(null)
  }

  const doDelete = (name: string) => {
    const res = tab === 'asset' ? deleteAssetCategory(name) : deleteKindCategory(tab, name)
    if (!res.ok) { toast.error('Could not delete', res.error); return }
    log(user?.id || 'system', 'DELETE', 'AssetCategory', `Deleted category "${name}"`)
    toast.success('Category deleted', name)
  }

  const active = CAT_TABS.find((c) => c.id === tab) || CAT_TABS[0]
  const list = listFor(tab)

  return (
    <div>
      <PageHeader
        title="Asset category"
        desc="Every asset type has its own category list — fixed assets use Asset Categories; components, accessories, consumables and licenses each use theirs."
        actions={canManage ? <Button onClick={() => setAdding(true)}><Plus className="size-4" /> New category</Button> : undefined}
      />

      {/* ---- Type tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CAT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setAdding(false); setEditingName(null) }}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition ${tab === t.id ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#2c4a77] hover:bg-[#243d63]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>{active.column}</th><th>{active.label}</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {list.map((name) => (
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
        {!list.length && !adding && (
          <p className="px-4 py-6 text-center text-sm text-mist">No categories yet for {active.label.toLowerCase()} — add one with “New category”.</p>
        )}
      </div>
    </div>
  )
}
