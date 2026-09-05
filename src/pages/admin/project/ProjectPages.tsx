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
export function ProjectsList() {
  return <ProjectPlaceholder title="Projects" description="Track projects, milestones, budgets and delivery status." />
}
export function Contracts() {
  return <ProjectPlaceholder title="Contracts" description="Manage client contracts, deliverables, and signed documents." />
}
export function TasksAssign() {
  return <ProjectPlaceholder title="Tasks Assign" description="Assign tasks to team members with deadlines and priorities." />
}
export function TasksTemplate() {
  return <ProjectPlaceholder title="Tasks Template" description="Reusable task templates for recurring project types." />
}
export function Timesheet() {
  return <ProjectPlaceholder title="Timesheet" description="Log and approve team hours worked on projects." />
}
export function ProjectInvoice() {
  return <ProjectPlaceholder title="Project Invoice" description="Generate and track invoices tied to project milestones." />
}
export function ProjectReports() {
  return <ProjectPlaceholder title="Project Reports" description="Profitability, timeline, budget burn, and resource utilisation reports." />
}

// Project Settings sub-pages
export function ProjectStatuses() {
  return <ProjectPlaceholder title="Project Statuses" description="Define custom status labels for the project pipeline." />
}
export function ProjectPriorities() {
  return <ProjectPlaceholder title="Project Priorities" description="Configure priority levels (Low, Medium, High, Critical)." />
}
export function ProjectCategories() {
  return <ProjectPlaceholder title="Project Categories" description="Group projects into categories for reporting." />
}
