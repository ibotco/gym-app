import menu from '../../../data/eduMenu.json'
import { useI18n } from '../../../context/I18nContext'
import { EduLeafCrud, type Group } from '../EduModulePage'

const GROUPS = (menu as { groups: Group[] }).groups

/**
 * Designations CRUD, surfaced under HRM → Employee Account
 * (moved out of Education Management → Staff).
 */
export function DesignationsPage() {
  const { t } = useI18n()
  const group = GROUPS.find((g) => g.id === 'staff')!
  const leaf = group.leaves.find((l) => l.id === 'designations')!
  return <EduLeafCrud group={group} leaf={leaf} crumb={[t('nav.hrm'), t('nav.hrEmployeeAccount')]} />
}
