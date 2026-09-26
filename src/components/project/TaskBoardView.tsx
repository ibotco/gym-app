import type { Project, ProjectTask, User } from '../../types'
import { TASK_STATUSES } from '../../lib/tasks'
import { PRIORITY_META } from '../../lib/projects'

/**
 * Kanban-style read-only task board (one column per task status).
 * Used by the public share page.
 */
export function TaskBoardView({ project, tasks, users }: { project: Project; tasks: ProjectTask[]; users?: Pick<User, 'id' | 'name'>[] }) {
  const nameOf = (id?: string) => users?.find((u) => u.id === id)?.name

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((col) => {
        const cards = tasks
          .filter((t) => t.projectId === project.id && t.status === col.id)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        return (
          <div key={col.id} className="rounded-lg border border-zinc-200 bg-zinc-50">
            <div className="flex items-center justify-between border-b-2 px-3 py-2" style={{ borderColor: col.card }}>
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-600">{col.label}</span>
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">{cards.length}</span>
            </div>
            <div className="space-y-2 p-2.5">
              {cards.map((t) => (
                <div key={t.id} className="rounded-md border border-zinc-200 bg-white p-2.5 shadow-sm">
                  <p className="text-xs font-semibold text-zinc-800">{t.name}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${(PRIORITY_META[t.priority] || { badge: 'bg-zinc-100 text-zinc-600' }).badge}`}>{(PRIORITY_META[t.priority] || { label: t.priority }).label}</span>
                    <span>Due {t.dueDate}</span>
                  </div>
                  {nameOf(t.assigneeId) && <p className="mt-1 text-[10px] text-zinc-500">→ {nameOf(t.assigneeId)}</p>}
                </div>
              ))}
              {!cards.length && <p className="py-4 text-center text-[10px] text-zinc-400">No tasks</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
