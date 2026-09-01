import { useParams, Navigate } from 'react-router-dom'
import { CmsSection } from './CmsSection'
import { CmsSettingsPage } from './CmsSettings'
import { CmsSeoPage } from './CmsSeo'
import { CMS_SECTIONS } from '../../../lib/cms'

export function CmsRouter() {
  const { section } = useParams()
  if (section === 'settings') return <CmsSettingsPage />
  if (section === 'seo') return <CmsSeoPage />
  if (section && CMS_SECTIONS[section]) return <CmsSection sectionKey={section} />
  return <Navigate to="/admin/cms/settings" replace />
}
