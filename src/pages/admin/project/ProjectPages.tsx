import { FolderKanban } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button } from '../../../components/ui'

export function ProjectPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/projects" className="hover:text-lime">Project Management</Link>
        <span className="text-mist">/</span>
        <span className="font-semibold text-inherit">{title}</span>
      </div>
      <PageHeader title={title} desc={description} />
      <div className="card p-10 text-center">
        <FolderKanban className="mx-auto size-10 text-mist" />
        <h3 className="mt-3 text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-mist">This module is coming soon.</p>
        <div className="mt-4">
          <Link to="/admin/projects">
            <Button variant="outline">← Back to Projects</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Project Management main pages
export { Projects as ProjectsList } from './Projects'
export { Contracts } from './Contracts'
export { TasksAssign } from './TasksAssign'
export { TasksTemplate } from './TasksTemplate'
export { ProjectTypes } from './Types'
export { Timesheet } from './Timesheet'
export { ProjectInvoice } from './ProjectInvoice'
export { ProjectReports } from './ProjectReports'

// Project Settings sub-pages
export { ProjectArchive } from './Archive'
import { ColorSettings } from './ColorSettings'
export function ProjectStatuses() {
  return <ColorSettings kind="statuses" />
}
export function ProjectPriorities() {
  return <ColorSettings kind="priorities" />
}
export function ProjectCategories() {
  return <ColorSettings kind="categories" />
}
