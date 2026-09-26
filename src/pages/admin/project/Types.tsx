import { useMemo, useState } from 'react'
import { Filter, Network, Printer, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button, Field, Input, Select, Textarea, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { ProjectType, TemplateStatus } from '../../../types'

type Tab = 'project' | 'contract'

interface TypeForm { id?: string; name: string; description: string; status: TemplateStatus }
const blank = (): TypeForm => ({ name: '', description: '', status: 'ACTIVE' })

export function ProjectTypes() {
  const app = useApp()
  const toast = useToast()
  const { projectTypes, contractTypes, upsertProjectType, deleteProjectType, upsertContractType, deleteContractType } = app

  const [tab, setTab] = useState<Tab>('project')
  const [form, setForm] = useState<TypeForm>(blank())
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deleting, setDeleting] = useState<ProjectType | null>(null)

  const source = tab === 'project' ? projectTypes : contractTypes
  const typeLabel = tab === 'project' ? 'Project Type' : 'Contract Type'

  const list = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...source].sort((a, b) => a.name.localeCompare(b.name) * dir)
  }, [source, sortDir])

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = list.slice((safePage - 1) * pageSize, safePage * pageSize)

  const switchTab = (t: Tab) => { setTab(t); setForm(blank()); setPage(1) }

  const save = () => {
    if (!form.name.trim()) { toast.error(`Enter the ${typeLabel.toLowerCase()} name.`); return }
    const record: ProjectType = { id: form.id || uid(tab === 'project' ? 'pt' : 'ct'), name: form.name.trim(), description: form.description.trim(), status: form.status }
    if (tab === 'project') upsertProjectType(record)
    else upsertContractType(record)
    toast.success(form.id ? `${typeLabel} updated` : `${typeLabel} saved`)
    setForm(blank())
  }

  const exportRows = list.map((t) => ({ [typeLabel]: t.name, Description: t.description || '', Status: t.status }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span>Project Settings</span><span>/</span><span className="font-semibold text-inherit">Types</span>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-line">
          <button onClick={() => switchTab('project')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${tab === 'project' ? 'border-t-2 border-purple-600 bg-white text-zinc-800' : 'bg-purple-600 text-white'}`}>
            <Filter className="size-4" /> Project Type
          </button>
          <button onClick={() => switchTab('contract')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${tab === 'contract' ? 'border-t-2 border-green-500 bg-white text-zinc-800' : 'bg-green-500 text-white'}`}>
            <Network className="size-4" /> Contract Type
          </button>
          <div className="ml-auto flex items-center gap-2 self-center pr-2">
            <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700" title="Print" aria-label="Print"><Printer className="size-4" /></button>
            <ExportButtons filename={tab === 'project' ? 'project-types' : 'contract-types'} rows={exportRows} compact />
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          {/* Left form */}
          <div className="space-y-4">
            <Field label={typeLabel}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="please provide description" className="placeholder:italic placeholder:text-red-500" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TemplateStatus })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
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
                        {typeLabel} {sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t, i) => (
                    <tr key={t.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                      <td className="px-2 py-2.5 align-top font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</td>
                      <td className="px-2 py-2.5 align-top">
                        <span className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${t.status === 'ACTIVE' ? 'border-green-400 text-green-600' : 'border-zinc-300 text-zinc-500'}`}>{t.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setForm({ id: t.id, name: t.name, description: t.description || '', status: t.status })}
                            className="flex items-center gap-1.5 rounded-md bg-[#1f4e79] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#16395c]">
                            <Pencil className="size-3" /> Edit
                          </button>
                          <button onClick={() => setDeleting(t)} className="grid size-7 place-items-center rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50" aria-label="Delete"><Trash2 className="size-3.5" /></button>
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
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${typeLabel.toLowerCase()}`}>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { if (tab === 'project') deleteProjectType(deleting.id); else deleteContractType(deleting.id); toast.success('Deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
