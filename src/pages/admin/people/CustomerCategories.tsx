import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { CategorySettings } from './CategorySettings'
import { Empty, PageHeader } from '../../../components/ui'

export function CustomerCategories() {
  const app = useApp()
  const { customerCategories, customers, addCustomerCategory, renameCustomerCategory, deleteCustomerCategory, log } = app
  const { user, hasPermission } = useAuth()

  const canView = hasPermission('customerCategories.view')
  const canManage = hasPermission('customerCategories.manage')
  const canDelete = hasPermission('customerCategories.delete')

  if (!canView) {
    return (
      <div>
        <PageHeader title="Customer categories" />
        <Empty title="Not authorised" desc="You need the 'View customer categories' permission to access this page." />
      </div>
    )
  }

  return (
    <CategorySettings
      title="Customer categories"
      desc="Organise your customers into categories for easier management and reporting."
      label="customer category"
      items={customerCategories}
      canManage={canManage}
      canDelete={canDelete}
      countFor={(name) => customers.filter((c) => c.category === name).length}
      onAdd={addCustomerCategory}
      onRename={renameCustomerCategory}
      onDelete={deleteCustomerCategory}
      onLog={(action, details) => log(user?.id || 'system', action, 'CustomerCategory', details)}
    />
  )
}
