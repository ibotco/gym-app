import { useMemo } from 'react'
import type { Project, ProjectTask } from '../../types'
import { TASK_STATUSES, taskStatusMeta } from '../../lib/tasks'

const DAY = 86400000
const toMs = (d: string) => new Date(`${d}T00:00:00`).getTime()
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Dependency-free Gantt chart: one bar per task laid over the project's date
 * range, coloured by task status. Used by the Projects list action menu and
 * the public share page.
 */
export function GanttView({ project, tasks }: { project: Project; tasks: ProjectTask[] }) {
  const chart = useMemo(() => {
    const rows = [...tasks]
      .filter((t) => t.projectId === project.id && t.startDate && t.dueDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    const today = new Date().toISOString().slice(0, 10)
    const start = Math.min(
      toMs(project.startDate || today),
      ...(rows.length ? rows.map((t) => toMs(t.startDate)) : []),
    )
    const end = Math.max(
      toMs(project.endDate || project.startDate || today),
      ...(rows.length ? rows.map((t) => toMs(t.dueDate)) : []),
      start + 6 * DAY,
    )
    const total = Math.max(DAY, end - start)

    // Month gridlines across the span.
    const ticks: { pct: number; label: string }[] = []
    const d = new Date(start)
    d.setDate(1); d.setMonth(d.getMonth() + 1)
    while (d.getTime() < end) {
      ticks.push({ pct: ((d.getTime() - start) / total) * 100, label: `${MONTHS[d.getMonth()]} ${d.getFullYear() % 100}` })
      d.setMonth(d.getMonth() + 1)
    }
    const todayPct = toMs(today) >= start && toMs(today) <= end ? ((toMs(today) - start) / total) * 100 : null

    return { rows, start, end, total, ticks, todayPct }
  }, [project, tasks])

  const pos = (t: ProjectTask) => {
    const from = Math.max(chart.start, toMs(t.startDate))
    const to = Math.min(chart.end, toMs(t.dueDate) + DAY)
    const left = ((from - chart.start) / chart.total) * 100
    const width = Math.max(1.5, ((to - from) / chart.total) * 100)
    return { left: `${left}%`, width: `${width}%` }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* month ruler */}
          <div className="mb-1 ml-44 relative h-5 text-[10px] font-semibold text-zinc-400">
            {chart.ticks.map((t) => (
              <span key={t.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pct}%` }}>{t.label}</span>
            ))}
          </div>
          <div className="space-y-1.5">
            {chart.rows.map((t) => {
              const meta = taskStatusMeta(t.status)
              const overdue = t.status !== 'completed' && t.dueDate < new Date().toISOString().slice(0, 10)
              return (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-40 shrink-0 truncate text-xs font-semibold text-zinc-700" title={t.name}>{t.name}</div>
                  <div className="relative h-6 flex-1 rounded bg-zinc-100">
                    {chart.ticks.map((tick) => (
                      <span key={tick.label} className="absolute bottom-0 top-0 w-px bg-zinc-200" style={{ left: `${tick.pct}%` }} />
                    ))}
                    {chart.todayPct !== null && (
                      <span className="absolute bottom-0 top-0 w-0.5 bg-red-500" style={{ left: `${chart.todayPct}%` }} title="Today" />
                    )}
                    <span
                      className="absolute top-1 bottom-1 rounded-md"
                      style={{ ...pos(t), background: meta.card, opacity: overdue ? 0.55 : 0.9 }}
                      title={`${t.name} · ${t.startDate} → ${t.dueDate} · ${meta.label}${overdue ? ' (overdue)' : ''}`}
                    />
                  </div>
                </div>
              )
            })}
            {!chart.rows.length && (
              <p className="py-6 text-center text-xs text-zinc-500">No dated tasks on this project yet.</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
        {TASK_STATUSES.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.card }} /> {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-red-500" /> Today</span>
      </div>
    </div>
  )
}
