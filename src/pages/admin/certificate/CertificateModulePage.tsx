// @ts-nocheck
/**
 * Certificate Management — module page.
 *
 * The Certificate menu was promoted from an Education Management submenu to a
 * top-level admin menu (it sits directly after Card Management). Per the app's
 * folder convention, any menu promoted to a higher level owns its own folder
 * under pages/admin with the files it needs to keep working.
 *
 * This folder (pages/admin/certificate) carries:
 *   - CertificateModulePage.tsx    route target for /admin/certificate/:leaf
 *   - CertificateShared.ts         element model, palette, default elements
 *   - CertificateBuilderModal.tsx  drag & drop template builder (modal)
 *   - CertificateTemplateForm.tsx  full-width New Template form
 *   - index.ts                     barrel
 *
 * The generic list/table CRUD renderer (EduLeafCrud) stays shared in
 * education-management so certificate leaves behave exactly like every other
 * module leaf — including branch/company stamping on save.
 */
import { Navigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../context/I18nContext'
import { EduLeafCrud, type Group, type Leaf } from '../education-management/EduModulePage'
import menu from '../../../data/eduMenu.json'

/** The certificate group as declared in data/eduMenu.json. */
const GROUPS = (menu as { groups: Group[] }).groups
const CERTIFICATE_GROUP = GROUPS.find((g) => g.path === 'certificate') as Group | undefined

/** Leaves that belong to the Certificate menu, in menu order. */
export const CERTIFICATE_LEAVES: Leaf[] = (CERTIFICATE_GROUP?.leaves ?? []) as Leaf[]

export const CERTIFICATE_GROUP_PATH = 'certificate'

export function CertificateModulePage() {
  const { leaf: leafId } = useParams()
  const { t } = useI18n()
  const group = CERTIFICATE_GROUP
  const leaf = group?.leaves.find((l) => l.path === leafId)

  // No leaf chosen yet -> land on the first leaf (Certificate Types).
  if (!leafId) {
    const first = group?.leaves.find((l) => !l.hidden) ?? group?.leaves[0]
    if (first) return <Navigate to={`/admin/${CERTIFICATE_GROUP_PATH}/${first.path}`} replace />
  }

  if (!group || !leaf) {
    return (
      <div className="card p-8 text-center">
        <p className="font-extrabold">Section not found</p>
        <p className="mt-1 text-[12px] text-mist">This Certificate Management section does not exist.</p>
      </div>
    )
  }

  return <EduLeafCrud group={group} leaf={leaf} crumb={['Certificate Management', t(leaf.key)]} />
}

export default CertificateModulePage
