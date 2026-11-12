import { useMemo, useState } from 'react'
import { Archive as ArchiveIcon, RotateCcw, Trash2, Search, FolderKanban } from 'lucide-react'
import { PageHeader, Button, Modal, Input } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import type { Project } from '../../../types'

/** Striped purple progress bar, same look as the Projects list. */
function ProgressStripe({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const stripe = 'repeating-linear-gradient(45deg, #9333ea 0 8px, #a855f7 8px 16px)'
  return (
    <div className="relative h-4 w-28 overflow-hidden rounded-full bg-slate-200/70 dark:bg-zinc-700">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundImage: stripe }} />
      <span
        className="absolute top-0 flex h-4 -translate-x-1/2 items-center rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-slate-800 shadow"
        style={{ left: `${Math.max(pct, 12)}%` }}
      >
        {pct} %
      </span>
    </div>
  )
}

/**
 * Project Settings → Project Archive.
 * Central home for archived projects: review, restore, or remove for good.
 * Projects are archived from the Projects list action menu ("Archive").
 */
export function ProjectArchive() {
  const { projects, upsertProject, deleteProject, projectStatuses, projectPriorities, projectCategories } = useApp()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [deleting, setDeleting] = useState<Project | null>(null)

  const statusDef = (id: string) => projectStatuses.find((x) => x.id === id) || { id, name: id, color: '#8d939b' }
  const priorityDef = (id: string) => projectPriorities.find((x) => x.id === id) || { id, name: id, color: '#64748b' }
  const categoryDef = (id?: string) => projectCategories.find((x) => x.id === id)

  const archived = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return projects
      .filter((p) => p.archived)
      .filter((p) => !ql || `${p.name} ${p.clientName}`.toLowerCase().includes(ql))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, q])

  const restore = (p: Project) => {
    upsertProject({ ...p, archived: false })
    toast.success('Project restored', `${p.name} is back in the Projects list.`)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteProject(deleting.id)
    toast.success('Project deleted', deleting.name)
    setDeleting(null)
  }

  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span>Project Settings</span><span>/</span>
        <span className="font-semibold text-inherit">Project Archive</span>
      </div>
      <PageHeader
        title="Project Archive"
        desc="Archived projects are hidden from the Projects list but kept here. Restore one to bring it back, or delete it for good."
      />

      <div className="card">
        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <ArchiveIcon className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Archived projects</p>
              <p className="text-[11px] text-zinc-500">{archived.length} in the archive</p>
            </div>
          </div>
          <div className="relative">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="type to filter..."
              className="w-56 pr-8 italic"
              aria-label="Filter archived projects"
            />
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-mist" />
          </div>
        </div>

        <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full min-w-[900px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                <th className="w-8 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Project</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Client</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Priority</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Progress</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((p, i) => {
                const st = statusDef(p.status)
                const pr = priorityDef(p.priority)
                const cat = categoryDef(p.categoryId)
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 transition-colors hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]"
                    style={{ background: i % 2 ? 'rgba(148,163,184,0.07)' : undefined }}
                  >
                    <td className="px-2 py-3 align-middle text-zinc-500 dark:text-zinc-400">{i + 1}</td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: p.idColor || '#8d939b' }}
                          aria-hidden
                         data-tip={p.name}>
                          {initials(p.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                          <p className="text-[11px] text-zinc-500">{p.startDate} → {p.endDate || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{p.clientName || '—'}</p>
                      <p className="text-[11px] text-zinc-500">{p.clientPhone}</p>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: `${pr.color}22`, color: pr.color }}
                      >
                        {pr.name}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ borderColor: st.color, color: st.color, background: `${st.color}14` }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: st.color }} aria-hidden />
                        {st.name}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-middle"><ProgressStripe value={p.progress} /></td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => restore(p)}
                          className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                          title="Restore to Projects list"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </button>
                        <button
                          onClick={() => setDeleting(p)}
                          className="flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40"
                          title="Delete forever"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                        {cat && (
                          <span
                            className="ml-1 hidden rounded px-2 py-0.5 text-[11px] font-semibold xl:inline"
                            style={{ background: `${cat.color}22`, color: cat.color }}
                            title="Category"
                          >
                            {cat.name}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!archived.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    <FolderKanban className="mx-auto mb-2 size-8 text-mist" />
                    {q ? 'No archived projects match your filter.' : 'No archived projects. Archive one from the Projects list action menu.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span>Showing {archived.length} of {archived.length} archived entries</span>
          <span className="text-[11px] text-zinc-500">Restore puts a project back in the Projects list · Delete removes it permanently.</span>
        </div>
      </div>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete archived project">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              Permanently delete <span className="font-semibold text-inherit">{deleting.name}</span> and everything linked to it?
              This cannot be undone — use Restore instead if you may need it again.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete forever</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
