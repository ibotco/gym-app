import { useMemo, useState } from 'react'
import { List as ListIcon, Printer, MoreVertical, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Button, Field, Input, Select, Textarea, Modal } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { PROJECT_TYPES, TEMPLATE_STATUSES } from '../../../lib/taskTemplates'
import type { TaskTemplate, WorkStage, TemplateStatus } from '../../../types'

type Tab = 'task' | 'stage'
type SortKey = 'task' | 'sort' | 'stage' | 'type'

function SortHeader({ label, k, sortBy, sortDir, onSort }: {
  label: string; k: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void
}) {
  const active = sortBy === k
  return (
    <button onClick={() => onSort(k)} className="flex items-center gap-1 font-bold">
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  )
}

const StatusPill = ({ status }: { status: TemplateStatus }) => (
  <span className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${status === 'ACTIVE' ? 'border-green-400 bg-transparent text-green-600' : 'border-zinc-300 bg-transparent text-zinc-500'}`}>{status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
)

interface TaskForm { id?: string; projectType: string; workStageId: string; description: string; sort: string; status: TemplateStatus }
interface StageForm { id?: string; projectType: string; name: string; description: string; sort: string; status: TemplateStatus }

const blankTask = (): TaskForm => ({ projectType: '', workStageId: '', description: '', sort: '1', status: 'ACTIVE' })
const blankStage = (): StageForm => ({ projectType: '', name: '', description: '', sort: '1', status: 'ACTIVE' })

export function TasksTemplate() {
  const app = useApp()
  const toast = useToast()
  const { taskTemplates, workStages, projectTypes, upsertTaskTemplate, deleteTaskTemplate, upsertWorkStage, deleteWorkStage } = app

  const [tab, setTab] = useState<Tab>('task')
  const [taskForm, setTaskForm] = useState<TaskForm>(blankTask())
  const [stageForm, setStageForm] = useState<StageForm>(blankStage())
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('sort')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ kind: Tab; id: string; label: string } | null>(null)

  // Active project types from Project Settings -> Types (fallback to built-ins).
  const typeNames = useMemo(() => {
    const names = projectTypes.filter((t) => t.status === 'ACTIVE').map((t) => t.name)
    return names.length ? names : PROJECT_TYPES
  }, [projectTypes])

  const stageOptions = useMemo(
    () => workStages.filter((w) => w.projectType === taskForm.projectType && w.status === 'ACTIVE'),
    [workStages, taskForm.projectType],
  )

  const templates = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...taskTemplates].sort((a, b) => {
      if (sortBy === 'task') return a.description.localeCompare(b.description) * dir
      if (sortBy === 'sort') return (a.sort - b.sort) * dir
      return a.workStage.localeCompare(b.workStage) * dir
    })
  }, [taskTemplates, sortBy, sortDir])

  const stages = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return workStages
      .filter((w) => !stageForm.projectType || w.projectType === stageForm.projectType)
      .sort((a, b) => {
        if (sortBy === 'stage') return a.name.localeCompare(b.name) * dir
        if (sortBy === 'sort') return (a.sort - b.sort) * dir
        return (a.sort - b.sort) * dir
      })
  }, [workStages, sortBy, sortDir, stageForm.projectType])

  const list = tab === 'task' ? templates : stages
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = list.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(k); setSortDir('asc') }
  }

  const saveTask = () => {
    if (!taskForm.projectType) { toast.error('Select a project type.'); return }
    if (!taskForm.workStageId) { toast.error('Select a work stage.'); return }
    if (!taskForm.description.trim()) { toast.error('Enter the task / process description.'); return }
    const stage = workStages.find((w) => w.id === taskForm.workStageId)
    upsertTaskTemplate({
      id: taskForm.id || uid('tt'),
      projectType: taskForm.projectType,
      workStageId: taskForm.workStageId,
      workStage: stage?.name || '',
      description: taskForm.description.trim(),
      sort: Number(taskForm.sort) || 1,
      status: taskForm.status,
    })
    toast.success(taskForm.id ? 'Template updated' : 'Template saved')
    setTaskForm(blankTask())
  }

  const saveStage = () => {
    if (!stageForm.projectType) { toast.error('Select a project type.'); return }
    if (!stageForm.name.trim()) { toast.error('Enter the work stage name.'); return }
    upsertWorkStage({ id: stageForm.id || uid('ws'), projectType: stageForm.projectType, name: stageForm.name.trim(), description: stageForm.description.trim(), sort: Number(stageForm.sort) || 1, status: stageForm.status })
    toast.success(stageForm.id ? 'Work stage updated' : 'Work stage saved')
    setStageForm(blankStage())
  }

  const exportRows = tab === 'task'
    ? templates.map((t) => ({ Task: t.description, Work_Stage: t.workStage, Project_Type: t.projectType, Sort: t.sort, Status: t.status }))
    : stages.map((w) => ({ Work_Stage: w.name, Project_Type: w.projectType, Description: w.description || '', Sort: w.sort, Status: w.status }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span className="font-semibold text-inherit">Tasks Template</span>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-line">
          <button onClick={() => setTab('task')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${tab === 'task' ? 'border-t-2 border-purple-600 bg-white text-zinc-800' : 'bg-purple-600 text-white'}`}>
            <ListIcon className="size-4" /> Task / Process
          </button>
          <button onClick={() => setTab('stage')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${tab === 'stage' ? 'border-t-2 border-green-500 bg-white text-zinc-800' : 'bg-green-500 text-white'}`}>
            Work Stage / Operation
          </button>
          <div className="ml-auto flex items-center gap-2 self-center pr-2">
            <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white" title="Print" aria-label="Print"><Printer className="size-4" /></button>
            <ExportButtons filename={tab === 'task' ? 'task-templates' : 'work-stages'} rows={exportRows} compact />
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-12">
          {/* Left form — col-md-5 */}
          <div className="space-y-4 md:col-span-5">
            {tab === 'task' ? (
              <>
                <Field label="Project Type" required>
                  <Select value={taskForm.projectType} onChange={(e) => setTaskForm({ ...taskForm, projectType: e.target.value, workStageId: '' })}>
                    <option value="">Please Select...</option>
                    {typeNames.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Work Stage" required>
                  <Select value={taskForm.workStageId} onChange={(e) => setTaskForm({ ...taskForm, workStageId: e.target.value })} disabled={!taskForm.projectType}>
                    <option value="">{taskForm.projectType ? 'Please Select...' : 'Select Type first'}</option>
                    {stageOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </Field>
                <Field label="Task/Job Description/Process" required>
                  <Textarea rows={4} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </Field>
                <Field label="Task Ordering (Sort)" required>
                  <Select value={taskForm.sort} onChange={(e) => setTaskForm({ ...taskForm, sort: e.target.value })}>
                    <option value="">Please Select...</option>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}</option>)}
                  </Select>
                </Field>
                <Field label="Status" required>
                  <Select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TemplateStatus })}>
                    {TEMPLATE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Button onClick={saveTask} className="w-full bg-[#1f4e79]">Save</Button>
              </>
            ) : (
              <>
                <Field label="Project Type" required>
                  <Select value={stageForm.projectType} onChange={(e) => setStageForm({ ...stageForm, projectType: e.target.value })}>
                    <option value="">Please Select...</option>
                    {typeNames.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Work Stage/Operation" required>
                  <Input value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} placeholder="e.g. Substructure" />
                </Field>
                <Field label="Description" required>
                  <Textarea rows={4} value={stageForm.description} onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })} />
                </Field>
                <Field label="Work Stage Ordering (Sort)" required>
                  <Select value={stageForm.sort} onChange={(e) => setStageForm({ ...stageForm, sort: e.target.value })}>
                    <option value="">Please Select...</option>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}</option>)}
                  </Select>
                </Field>
                <Field label="Status" required>
                  <Select value={stageForm.status} onChange={(e) => setStageForm({ ...stageForm, status: e.target.value as TemplateStatus })}>
                    {TEMPLATE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Button onClick={saveStage} className="w-full bg-[#1f4e79]">Save</Button>
              </>
            )}
          </div>

          {/* Right list — col-md-7 */}
          <div className="md:col-span-7">
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Show
              <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value="10">10</option><option value="25">25</option><option value="50">50</option>
              </Select>
              entries
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="w-12 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">No.</th>
                    {tab === 'task' ? (
                      <>
                        <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Task" k="task" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                        <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Sort" k="sort" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                      </>
                    ) : (
                      <>
                        <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Work Stage" k="stage" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                        <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Sort" k="sort" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                      </>
                    )}
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => (
                    <tr key={row.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                      {tab === 'task' ? (
                        <>
                          <td className="px-2 py-2.5 align-top">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{(row as TaskTemplate).description}</div>
                            <div className="text-[11px] text-zinc-500">{(row as TaskTemplate).workStage} · {(row as TaskTemplate).projectType}</div>
                          </td>
                          <td className="px-2 py-2.5 align-top">{(row as TaskTemplate).sort}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2.5 align-top">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{(row as WorkStage).name}</div>
                            {(row as WorkStage).description && <div className="text-[11px] text-zinc-500">{(row as WorkStage).description}</div>}
                            <div className="text-[11px] text-zinc-400">{(row as WorkStage).projectType}</div>
                          </td>
                          <td className="px-2 py-2.5 align-top">{(row as WorkStage).sort}</td>
                        </>
                      )}
                      <td className="px-2 py-2.5 align-top"><StatusPill status={row.status} /></td>
                      <td className="px-2 py-2.5 align-top">
                        {tab === 'stage' ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { const w = row as WorkStage; setStageForm({ id: w.id, projectType: w.projectType, name: w.name, description: w.description || '', sort: String(w.sort), status: w.status }) }}
                              className="flex items-center gap-1.5 rounded-md bg-[#1f4e79] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#16395c]">
                              <Pencil className="size-3" /> Edit
                            </button>
                            <button onClick={() => setDeleting({ kind: 'stage', id: row.id, label: (row as WorkStage).name })}
                              className="grid size-7 place-items-center rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative inline-block">
                            <button onClick={() => setMenuFor(menuFor === row.id ? null : row.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions"><MoreVertical className="size-4" /></button>
                            {menuFor === row.id && (
                              <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                                <button onClick={() => { setMenuFor(null); const t = row as TaskTemplate; setTaskForm({ id: t.id, projectType: t.projectType, workStageId: t.workStageId || '', description: t.description, sort: String(t.sort), status: t.status }) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Pencil className="size-3.5" /> Edit</button>
                                <button onClick={() => { setMenuFor(null); setDeleting({ kind: 'task', id: row.id, label: (row as TaskTemplate).description }) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600"><Trash2 className="size-3.5" /> Delete</button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!paged.length && (
                    <tr><td colSpan={5} className="bg-zinc-100 px-4 py-4 text-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No data available in table</td></tr>
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
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete template">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.label}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleting.kind === 'task' ? deleteTaskTemplate(deleting.id) : deleteWorkStage(deleting.id); toast.success('Deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
