import { useMemo, useState } from 'react'
import { Pencil, Printer, Trash2, ChevronUp, ChevronDown, Palette } from 'lucide-react'
import { Button, Field, Input, Select, Textarea, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { ProjectColorDef } from '../../../types'

export type ColorKind = 'statuses' | 'priorities' | 'categories'

const KIND_META: Record<ColorKind, {
  title: string; singular: string; fieldLabel: string; filename: string;
  list: (a: ReturnType<typeof useApp>) => ProjectColorDef[];
  upsert: (a: ReturnType<typeof useApp>) => (d: ProjectColorDef) => void;
  remove: (a: ReturnType<typeof useApp>) => (id: string) => void;
  hint: string;
}> = {
  statuses: {
    title: 'Statuses', singular: 'Status', fieldLabel: 'Status Name', filename: 'project-statuses',
    list: (a) => a.projectStatuses, upsert: (a) => a.upsertProjectStatus, remove: (a) => a.deleteProjectStatus,
    hint: 'The colour chosen here is applied to the status pill and summary cards on the Projects page.',
  },
  priorities: {
    title: 'Priorities', singular: 'Priority', fieldLabel: 'Priority Name', filename: 'project-priorities',
    list: (a) => a.projectPriorities, upsert: (a) => a.upsertProjectPriority, remove: (a) => a.deleteProjectPriority,
    hint: 'The colour chosen here is applied to priority chips on projects and cards.',
  },
  categories: {
    title: 'Categories', singular: 'Category', fieldLabel: 'Category Name', filename: 'project-categories',
    list: (a) => a.projectCategories, upsert: (a) => a.upsertProjectCategory, remove: (a) => a.deleteProjectCategory,
    hint: 'Group projects by category; the colour marks the category chip on each project.',
  },
}

interface DefForm { id?: string; name: string; color: string; description: string }
const blank = (): DefForm => ({ name: '', color: '#0d6efd', description: '' })

/** Shared Project Settings page for colour-coded Statuses / Priorities / Categories. */
export function ColorSettings({ kind }: { kind: ColorKind }) {
  const app = useApp()
  const toast = useToast()
  const meta = KIND_META[kind]

  const [form, setForm] = useState<DefForm>(blank())
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deleting, setDeleting] = useState<ProjectColorDef | null>(null)

  const source = meta.list(app)

  const list = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...source].sort((a, b) => a.name.localeCompare(b.name) * dir)
  }, [source, sortDir])

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = list.slice((safePage - 1) * pageSize, safePage * pageSize)

  const save = () => {
    if (!form.name.trim()) { toast.error(`Enter the ${meta.singular.toLowerCase()} name.`); return }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.color)) { toast.error('Pick a valid hex colour.'); return }
    meta.upsert(app)({
      id: form.id || uid(kind === 'statuses' ? 'pst' : kind === 'priorities' ? 'ppr' : 'pcat'),
      name: form.name.trim(),
      color: form.color,
      description: form.description.trim() || undefined,
    })
    toast.success(form.id ? `${meta.singular} updated` : `${meta.singular} saved`)
    setForm(blank())
  }

  const exportRows = list.map((t) => ({ [meta.singular]: t.name, Colour: t.color, Description: t.description || '' }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span>Project Settings</span><span>/</span>
        <span className="font-semibold text-inherit">{meta.title}</span>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Palette className="size-4 text-purple-600" aria-hidden />
          <h2 className="text-sm font-bold">{meta.title}</h2>
          <p className="hidden text-xs text-mist sm:block">{meta.hint}</p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700" title="Print" aria-label="Print"><Printer className="size-4" /></button>
            <ExportButtons filename={meta.filename} rows={exportRows} compact />
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          {/* Left form */}
          <div className="space-y-4">
            <Field label={meta.fieldLabel}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="size-9 cursor-pointer rounded border border-line bg-transparent p-0.5"
                  aria-label={`${meta.singular} colour`}
                />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-32 font-mono" />
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold" style={{ borderColor: form.color, color: form.color, background: `${form.color}1a` }}>
                  Preview
                </span>
              </div>
            </Field>
            <Field label="Description">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="please provide description" className="placeholder:italic placeholder:text-red-500" />
            </Field>
            <Button onClick={save} className="w-full bg-[#1f4e79]">Save</Button>
          </div>

          {/* Right list */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Show
              <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="50">50</option>
              </Select>
              entries
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="w-12 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">No.</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">
                      <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="flex items-center gap-1 font-bold">
                        {meta.singular} {sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Colour</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t, i) => (
                    <tr key={t.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                      <td className="px-2 py-2.5 align-top">
                        <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                          <span className="size-3 rounded-full border border-black/10" style={{ background: t.color }} aria-hidden />
                          {t.name}
                        </span>
                        {t.description && <span className="mt-0.5 block text-[11px] text-zinc-500">{t.description}</span>}
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <span className="rounded-full border px-3 py-0.5 text-[11px] font-semibold" style={{ borderColor: t.color, color: t.color, background: `${t.color}1a` }}>
                          {t.color.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setForm({ id: t.id, name: t.name, color: t.color, description: t.description || '' })}
                            className="flex items-center gap-1.5 rounded-md bg-[#1f4e79] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#16395c]"
                          >
                            <Pencil className="size-3" /> Edit
                          </button>
                          <button onClick={() => setDeleting(t)} className="grid size-7 place-items-center rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50" aria-label={`Delete ${t.name}`}><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!paged.length && (
                    <tr><td colSpan={4} className="bg-zinc-100 px-4 py-4 text-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No data available in table</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer — same format as All Sales */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
              <span>
                Showing {list.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to{' '}
                {Math.min(safePage * pageSize, list.length)} of {list.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</button>
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                  const n = i + 1
                  return (
                    <button key={n} type="button" className="btn min-w-9" aria-current={safePage === n ? 'page' : undefined}
                      style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                      onClick={() => setPage(n)}>{n}</button>
                  )
                })}
                <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${meta.singular.toLowerCase()}`}>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.name}</span>? Projects already using it fall back to a neutral colour.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { meta.remove(app)(deleting.id); toast.success('Deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
