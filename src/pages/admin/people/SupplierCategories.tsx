import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { CategorySettings } from './CategorySettings'
import { Empty } from '../../../components/ui'
import { PageHeader } from '../../../components/ui'

export function SupplierCategories() {
  const app = useApp()
  const { supplierCategories, suppliers, addSupplierCategory, renameSupplierCategory, deleteSupplierCategory, log } = app
  const { user, hasPermission } = useAuth()

  const canView = hasPermission('supplierCategories.view')
  const canManage = hasPermission('supplierCategories.manage')
  const canDelete = hasPermission('supplierCategories.delete')

  if (!canView) {
    return (
      <div>
        <PageHeader title="Supplier categories" />
        <Empty title="Not authorised" desc="You need the 'View supplier categories' permission to access this page." />
      </div>
    )
  }

  return (
    <CategorySettings
      title="Supplier categories"
      desc="Organise your suppliers into categories for easier management and reporting."
      label="supplier category"
      items={supplierCategories}
      canManage={canManage}
      canDelete={canDelete}
      countFor={(name) => suppliers.filter((s) => s.category === name).length}
      onAdd={addSupplierCategory}
      onRename={renameSupplierCategory}
      onDelete={deleteSupplierCategory}
      onLog={(action, details) => log(user?.id || 'system', action, 'SupplierCategory', details)}
    />
  )
}
