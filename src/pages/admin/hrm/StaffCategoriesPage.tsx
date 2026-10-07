import menu from '../../../data/eduMenu.json'
import { useI18n } from '../../../context/I18nContext'
import { EduLeafCrud, type Group } from '../EduModulePage'

const GROUPS = (menu as { groups: Group[] }).groups

/**
 * Staff Categories CRUD, surfaced under HRM → Employee Account
 * (moved out of Education Management → Staff).
 */
export function StaffCategoriesPage() {
  const { t } = useI18n()
  const group = GROUPS.find((g) => g.id === 'staff')!
  const leaf = group.leaves.find((l) => l.id === 'staffCategories')!
  return <EduLeafCrud group={group} leaf={leaf} crumb={[t('nav.hrm'), t('nav.hrEmployeeAccount')]} />
}
