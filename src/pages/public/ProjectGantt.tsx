import { useParams, Link } from 'react-router-dom'
import { loadProjects } from '../../lib/projects'
import { loadTasks } from '../../lib/tasks'
import { GanttView } from '../../components/project/GanttView'

/** Public (no-login) read-only Gantt chart for one project, shareable by link. */
export function PublicProjectGantt() {
  const { id } = useParams()
  const project = loadProjects().find((p) => p.id === id)
  const tasks = loadTasks()

  return (
    <div className="min-h-screen bg-zinc-100 py-10">
      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          {project ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Shared project view · read only</p>
              <h1 className="mt-1 text-xl font-bold text-zinc-900">{project.name} — Gantt Chart</h1>
              <p className="mb-5 text-sm text-zinc-500">
                Client: {project.clientName || '—'} · {project.startDate} → {project.endDate || '—'} · {project.progress}% complete
              </p>
              <GanttView project={project} tasks={tasks} />
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-lg font-bold text-zinc-800">Project not found</p>
              <p className="mt-1 text-sm text-zinc-500">This shared link is invalid or the project was removed.</p>
              <Link to="/" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">← Back to home</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
