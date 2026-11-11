import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bot, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, FileDown,
  FileSpreadsheet, FileText, Info, ListOrdered, Pencil, Plus, Printer, Save, Settings2,
  Trash2, UserPlus, Zap,
} from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Switch, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { exportExcel, exportPdf, type ExportRow } from '../../../lib/export'
import {
  APPROVAL_MENUS,
  addSampleApprovalSetup,
  docTypeName,
  ensureSampleApprovalSetup,
  loadApprovalDocTypes,
  menuLabel,
  newApprovalRuleGroup,
  saveApprovalData,
  saveApprovalDocTypes,
  visibleApprovalWorkflows,
  type ApprovalDocType,
  type ApprovalModuleData,
  type ApprovalRuleAction,
  type ApprovalRuleCondition,
  type ApprovalRuleGroup,
  type ApprovalRuleJson,
  type ApprovalRuleJsonCondition,
  type ApprovalRuleJsonNode,
  type ApprovalRuleNode,
  type ApprovalStep,
  type ApprovalWorkflow,
} from '../../../lib/approvals'
import { formatGhsExact, uid } from '../../../lib/utils'

const BUILDER_TABS = [
  { id: 'general', label: 'General Rule', icon: Settings2 },
  { id: 'workflows', label: 'Approval Workflows', icon: ClipboardList },
  { id: 'steps', label: 'Approval Steps', icon: ListOrdered },
  { id: 'actions', label: 'Rule Actions', icon: Bot },
  { id: 'automatic', label: 'Auto Approval Rule', icon: Zap },
  { id: 'documentTypes', label: 'Document Type', icon: FileText },
] as const

type BuilderTab = typeof BUILDER_TABS[number]['id']
type Toast = ReturnType<typeof useToast>

const RULE_FIELDS = [
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'document_type', label: 'Document type' },
  { value: 'third_party', label: 'Third party / payee' },
  { value: 'branch_id', label: 'Branch' },
  { value: 'requested_by', label: 'Requested by' },
]
const RULE_OPERATORS = [
  { value: '=', label: 'Equals (=)' },
  { value: '!=', label: 'Does not equal (≠)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '>=', label: 'At least (≥)' },
  { value: '<', label: 'Less than (<)' },
  { value: '<=', label: 'At most (≤)' },
  { value: 'contains', label: 'Contains' },
]
const ACTION_OPTIONS = [
  { value: 'auto_approve', label: 'Auto approve' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'escalate', label: 'Escalate to higher role' },
] as const

function dateNow() { return new Date().toISOString() }
function blankRuleCondition(): ApprovalRuleNode {
  return { id: uid('condition'), kind: 'condition', field: 'amount', operator: '>', value: '', rule_action: null }
}
function cloneRule<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
function updateRuleNode(root: ApprovalRuleGroup, nodeId: string, update: (node: ApprovalRuleNode) => ApprovalRuleNode): ApprovalRuleGroup {
  if (root.id === nodeId) return update(root) as ApprovalRuleGroup
  return {
    ...root,
    children: root.children.map((child) => child.kind === 'group'
      ? updateRuleNode(child, nodeId, update)
      : child.id === nodeId ? update(child) as typeof child : child),
  }
}
function appendRuleChild(root: ApprovalRuleGroup, groupId: string, child: ApprovalRuleNode): ApprovalRuleGroup {
  if (root.id === groupId) return { ...root, children: [...root.children, child] }
  return {
    ...root,
    children: root.children.map((node) => node.kind === 'group' ? appendRuleChild(node, groupId, child) : node),
  }
}
function removeRuleNode(root: ApprovalRuleGroup, nodeId: string): ApprovalRuleGroup {
  return {
    ...root,
    children: root.children.filter((node) => node.id !== nodeId).map((node) => node.kind === 'group' ? removeRuleNode(node, nodeId) : node),
  }
}
function ruleGroupExists(root: ApprovalRuleGroup, groupId: string): boolean {
  return root.id === groupId || root.children.some((node) => node.kind === 'group' && ruleGroupExists(node, groupId))
}
function roleLabel(roleId: string, roles: Array<{ id: string; name: string }>): string {
  return roles.find((role) => role.id === roleId)?.name || roleId.replace(/_/g, ' ')
}
function approvalStepListName(stepName: string): string {
  return stepName.replace(/^Sample\s*·\s*/i, '')
}
function amountRange(workflow: ApprovalWorkflow): string {
  if (!workflow.useAmountRange) return 'Any amount'
  return `${formatGhsExact(workflow.minAmount ?? 0)} – ${formatGhsExact(workflow.maxAmount ?? 0)}`
}

const SLA_TOOLTIP_TEXT = 'Service Level Agreement (SLA) Hours: An expected speed of service delivery. It defines how many hours are allowed before an approval step is considered overdue.'
const ESCALATION_TOOLTIP_TEXT = 'Escalation hour(s) is the extra time allowed after the SLA expires before the system escalates the request to a higher role.'
const ESCALATION_ROLE_TOOLTIP_TEXT = 'Escalation role is the user role that a request is assigned to when escalation happens. Thus, the next higher person (or role) who receives the task when escalation occurs.'
const REJECT_STEP_TOOLTIP_TEXT = 'Reject to step level defines where a rejected request should return in the workflow. Thus, when a request is rejected at a certain step, it goes back to a specific earlier step (level) in the workflow.'

function BootstrapInfoTip({ text }: { text: string }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false })
  const updatePosition = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return
    const halfWidth = Math.min(125, Math.max(70, (window.innerWidth - 24) / 2))
    const left = Math.max(halfWidth + 12, Math.min(window.innerWidth - halfWidth - 12, rect.left + rect.width / 2))
    setPosition({ top: rect.top, left, ready: true })
  }, [])
  useLayoutEffect(() => {
    if (open) updatePosition()
    else setPosition((current) => ({ ...current, ready: false }))
  }, [open, updatePosition])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  return (
    <span
      ref={anchor}
      tabIndex={0}
      role="img"
      aria-label={text}
      className="ml-1 inline-flex cursor-help align-middle text-[#17c0eb]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Info className="size-4" fill="currentColor" stroke="white" strokeWidth={2.5} />
      {open && position.ready && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none"
          style={{
            position: 'fixed', top: position.top, left: position.left,
            transform: 'translate(-50%, calc(-100% - 8px))', zIndex: 2147483647,
            width: 250, maxWidth: 'calc(100vw - 24px)', padding: '9px 13px',
            borderRadius: 7, background: '#203c73', color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,.28)', fontSize: 14,
            fontWeight: 400, lineHeight: 1.5, whiteSpace: 'normal',
          }}
        >
          {text}
          <span style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #203c73' }} />
        </div>,
        document.body,
      )}
    </span>
  )
}

function Panel({ title, icon, children, className = '' }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 overflow-hidden border-t-[3px] border-t-emerald-600 ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
        <span className="text-ink dark:text-white">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function ExportActions({ rows, filename }: { rows: ExportRow[]; filename: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button type="button" size="icon" variant="outline" title="Print" aria-label="Print" onClick={exportPdf}>
        <Printer className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="outline" title="Save as PDF" aria-label="Save as PDF" onClick={exportPdf}>
        <FileDown className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="outline" title="Export to Excel" aria-label="Export to Excel" onClick={() => { void exportExcel(filename, rows) }}>
        <FileSpreadsheet className="size-4" />
      </Button>
    </div>
  )
}

function ListToolbar({
  query, onQuery, pageSize, onPageSize, shown, total, exportRows, filename,
}: {
  query: string
  onQuery: (value: string) => void
  pageSize: number
  onPageSize: (value: number) => void
  shown: number
  total: number
  exportRows: ExportRow[]
  filename: string
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-mist">
        <span>Show</span>
        <Select className="w-[76px]" value={String(pageSize)} onChange={(event) => onPageSize(Number(event.target.value))} aria-label="Rows per page">
          {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </Select>
        <span>entries</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <ExportActions rows={exportRows} filename={filename} />
        <Input className="w-full sm:w-52" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search…" aria-label="Search records" />
      </div>
      <span className="sr-only">Showing {shown} of {total} matching entries</span>
    </div>
  )
}

function Pager({
  page, pageSize, total, onPage,
}: { page: number; pageSize: number; total: number; onPage: (next: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = total ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, total)
  return (
    <div className="mt-3 flex flex-col gap-2 text-xs text-mist sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {first} to {last} of {total} entries</span>
      <div className="flex items-center gap-1 self-end">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
        <span className="min-w-12 text-center">{page} / {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))} aria-label="Next page"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  )
}

function EmptyRows({ colSpan, label = 'No entries found' }: { colSpan: number; label?: string }) {
  return <tr><td colSpan={colSpan} className="px-3 py-7 text-center text-sm text-mist">{label}</td></tr>
}

export function ApprovalRuleBuilderPage() {
  const app = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId
  const branchId = app.activeBranch?.id || app.activeBranchId || ''
  const [tab, setTab] = useState<BuilderTab>('general')
  const [data, setData] = useState<ApprovalModuleData>(() => ensureSampleApprovalSetup(companyId, branchId))
  const [documentTypes, setDocumentTypes] = useState<ApprovalDocType[]>(() => loadApprovalDocTypes())

  useEffect(() => {
    setData(ensureSampleApprovalSetup(companyId, branchId))
  }, [companyId, branchId])

  const persist = (next: ApprovalModuleData) => {
    setData(next)
    saveApprovalData(companyId, next)
  }
  const persistDocumentTypes = (next: ApprovalDocType[]) => {
    setDocumentTypes(next)
    if (!saveApprovalDocTypes(next)) toast.error('Document types could not be saved', 'Browser storage is unavailable or full.')
  }
  const addSamplePack = () => {
    const result = addSampleApprovalSetup(data, companyId, branchId)
    const added = result.workflowsAdded + result.stepsAdded + result.ruleActionsAdded + Number(result.settingsAdded)
    if (!added) {
      toast.update('Sample approval pack is already present for the configured document types.')
      return
    }
    persist(result.data)
    toast.success('Sample approval pack added', `${result.workflowsAdded} workflows, ${result.stepsAdded} approval steps, ${result.ruleActionsAdded} rule actions${result.settingsAdded ? ', and branch approval settings' : ''}.`)
  }
  const workflows = useMemo(
    () => visibleApprovalWorkflows(data.workflows, companyId, branchId),
    [data.workflows, companyId, branchId],
  )
  const currentSettings = data.settings.find((setting) => setting.companyId === companyId && setting.branchId === branchId) ?? {
    id: 'new-settings', companyId, branchId, enableApproval: true, enableAutomatic: true,
    userId: user?.id || '', createdAt: dateNow(), updatedAt: dateNow(),
  }
  const companyName = app.activeCompany?.name || 'Current company'
  const branchName = app.activeBranch?.name || 'Current branch'

  return (
    <div>
      <PageHeader
        eyebrow="Approvals"
        title="Approval Rule Builder"
        desc="Configure approval settings, workflows, approver steps and automatic decision rules."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="lime" size="sm" onClick={addSamplePack} title="Add sample workflows for document types that do not already have a workflow.">
              <Plus className="size-4" /> Add sample pack
            </Button>
            <Badge tone="sky">{companyName} · {branchName}</Badge>
          </div>
        )}
      />
      <div className="min-w-0">
        <div className="mb-4 w-full">
          <nav aria-label="Approval rule builder sections" className="card grid w-full grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
            {BUILDER_TABS.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={active ? 'page' : undefined}
                  className={`flex min-w-0 items-center justify-center gap-2 border-r border-b border-line px-2 py-3 text-center text-xs leading-snug transition sm:px-3 sm:py-4 sm:text-sm ${active ? 'font-bold' : 'text-mist hover:bg-black/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-white'}`}
                  style={active ? { backgroundColor: 'var(--btn, #c8f542)', color: 'var(--btn-ink, #132000)' } : undefined}>
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
        <div className="min-w-0">
          {tab === 'general' && <GeneralRulePanel settings={currentSettings} data={data} persist={persist} branchName={branchName} userId={user?.id || ''} toast={toast} log={app.log} />}
          {tab === 'workflows' && <WorkflowsPanel data={data} persist={persist} workflows={workflows} documentTypes={documentTypes} companyId={companyId} branchId={branchId} branchName={branchName} userId={user?.id || ''} toast={toast} log={app.log} />}
          {tab === 'steps' && <StepsPanel data={data} persist={persist} workflows={workflows} roles={app.roles} users={app.users} companyId={companyId} toast={toast} log={app.log} userId={user?.id || ''} />}
          {tab === 'actions' && <RuleActionsPanel data={data} persist={persist} companyId={companyId} branchId={branchId} userId={user?.id || ''} toast={toast} log={app.log} />}
          {tab === 'automatic' && <AutoApprovalPanel data={data} persist={persist} workflows={workflows} roles={app.roles} ruleActions={data.ruleActions.filter((action) => action.companyId === companyId && (action.branchId === branchId || action.branchId === '*') && action.isActive)} toast={toast} />}
          {tab === 'documentTypes' && <DocumentTypesPanel documentTypes={documentTypes} persist={persistDocumentTypes} userId={user?.id || ''} toast={toast} log={app.log} />}
        </div>
      </div>
    </div>
  )
}

function GeneralRulePanel({
  settings, data, persist, branchName, userId, toast, log,
}: {
  settings: ApprovalModuleData['settings'][number]
  data: ApprovalModuleData
  persist: (next: ApprovalModuleData) => void
  branchName: string
  userId: string
  toast: Toast
  log: (userId: string, action: string, entity: string, details: string) => void
}) {
  const saveSetting = (patch: Partial<ApprovalModuleData['settings'][number]>) => {
    const now = dateNow()
    const existing = data.settings.find((setting) => setting.companyId === settings.companyId && setting.branchId === settings.branchId)
    const base = existing || settings
    const nextSetting = { ...base, ...patch, id: existing?.id || uid('apset'), userId, createdAt: existing?.createdAt || now, updatedAt: now }
    persist({ ...data, settings: existing
      ? data.settings.map((setting) => setting.id === existing.id ? nextSetting : setting)
      : [...data.settings, nextSetting] })
    log(userId || 'system', existing ? 'UPDATE' : 'CREATE', 'ApprovalSettings', `${branchName}: approval ${nextSetting.enableApproval ? 'enabled' : 'disabled'}; automatic ${nextSetting.enableAutomatic ? 'enabled' : 'disabled'}`)
    toast.success('Approval settings saved', branchName)
  }
  return (
    <Panel title="General Rule" icon={<Pencil className="size-5" />}>
      <div className="grid max-w-xl gap-4">
        <fieldset className="rounded-xl border border-line px-4 pb-4 pt-2">
          <legend className="px-2 text-sm font-semibold text-sky-600">Approval Settings</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold" title="Turn approval routing on or off for this branch.">
            <Switch checked={settings.enableApproval} onChange={(enableApproval) => saveSetting({ enableApproval })} aria-label="Enable Approval" />
            {settings.enableApproval ? <Check className="size-4 text-emerald-600" /> : <span className="size-4" />}
            <span>Enable Approval</span>
          </label>
        </fieldset>
        <fieldset className="rounded-xl border border-line px-4 pb-4 pt-2">
          <legend className="px-2 text-sm font-semibold text-sky-600">Automatic Approval Settings</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold" title="Auto-approve a matching document after it exceeds the final approval step’s escalation hours.">
            <Switch checked={settings.enableAutomatic} disabled={!settings.enableApproval} onChange={(enableAutomatic) => saveSetting({ enableAutomatic })} aria-label="Enable Automatic Approval" />
            {settings.enableAutomatic ? <Check className="size-4 text-emerald-600" /> : <span className="size-4" />}
            <span>Enable Automatic Approval</span>
          </label>
        </fieldset>
      </div>
    </Panel>
  )
}

type WorkflowForm = {
  id: string
  menuId: string
  documentType: string
  title: string
  description: string
  sequential: boolean
  useAmountRange: boolean
  minAmount: string
  maxAmount: string
  email: boolean
  sms: boolean
  whatsapp: boolean
  isActive: boolean
  scope: 'all' | 'branch'
}
function emptyWorkflowForm(): WorkflowForm {
  return { id: '', menuId: '', documentType: '', title: '', description: '', sequential: true, useAmountRange: false, minAmount: '', maxAmount: '', email: true, sms: false, whatsapp: false, isActive: true, scope: 'all' }
}
function workflowToForm(workflow: ApprovalWorkflow): WorkflowForm {
  return {
    id: workflow.id, menuId: String(workflow.menuId), documentType: workflow.documentType, title: workflow.title,
    description: workflow.description, sequential: workflow.sequential, useAmountRange: workflow.useAmountRange,
    minAmount: workflow.minAmount == null ? '' : String(workflow.minAmount), maxAmount: workflow.maxAmount == null ? '' : String(workflow.maxAmount),
    email: workflow.email, sms: workflow.sms, whatsapp: workflow.whatsapp, isActive: workflow.isActive,
    scope: workflow.branchId ? 'branch' : 'all',
  }
}

function WorkflowsPanel({
  data, persist, workflows, documentTypes, companyId, branchId, branchName, userId, toast, log,
}: {
  data: ApprovalModuleData
  persist: (next: ApprovalModuleData) => void
  workflows: ApprovalWorkflow[]
  documentTypes: ApprovalDocType[]
  companyId: string
  branchId: string
  branchName: string
  userId: string
  toast: Toast
  log: (userId: string, action: string, entity: string, details: string) => void
}) {
  const [form, setForm] = useState<WorkflowForm>(emptyWorkflowForm)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const activeDocTypes = documentTypes.filter((item) => item.isActive && item.sidemenu === Number(form.menuId))
  const inactiveSelection = documentTypes.find((item) => !item.isActive && item.sidemenu === Number(form.menuId) && item.documentType === form.documentType)
  const docTypeOptions = inactiveSelection ? [...activeDocTypes, inactiveSelection] : activeDocTypes
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return workflows.filter((workflow) => !q || `${workflow.title} ${workflow.documentType} ${menuLabel(workflow.menuId)}`.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [workflows, query])
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const exportRows: ExportRow[] = filtered.map((workflow) => ({
    'Approval Workflows Title': workflow.title,
    Menu: menuLabel(workflow.menuId),
    'Document Type': docTypeName(workflow.documentType, documentTypes),
    'Amount Range': amountRange(workflow),
    Scope: workflow.branchId ? branchName : 'All branches',
    Status: workflow.isActive ? 'ACTIVE' : 'INACTIVE',
  }))

  useEffect(() => setPage(1), [query, pageSize, workflows.length])

  const save = () => {
    if (!form.menuId) { toast.error('Select a menu first.'); return }
    const previous = form.id ? data.workflows.find((workflow) => workflow.id === form.id) : undefined
    const selectedDocType = documentTypes.find((item) => item.documentType === form.documentType && item.sidemenu === Number(form.menuId))
    const keepingInactiveType = !!selectedDocType && !selectedDocType.isActive && previous?.documentType === form.documentType
    if (!selectedDocType || (!selectedDocType.isActive && !keepingInactiveType)) { toast.error('Select an active document type.'); return }
    if (!form.title.trim()) { toast.error('Enter the approval workflow title.'); return }
    let minAmount: number | null = null
    let maxAmount: number | null = null
    if (form.useAmountRange) {
      minAmount = Number(form.minAmount)
      maxAmount = Number(form.maxAmount)
      if (!Number.isFinite(minAmount) || minAmount < 0) { toast.error('Enter a valid minimum amount.'); return }
      if (!Number.isFinite(maxAmount) || maxAmount < minAmount) { toast.error('Maximum amount must be equal to or greater than minimum amount.'); return }
    }
    const now = dateNow()
    const record: ApprovalWorkflow = {
      id: previous?.id || uid('apwf'), companyId, branchId: form.scope === 'branch' ? branchId : null,
      menuId: Number(form.menuId), documentType: form.documentType, title: form.title.trim(), description: form.description.trim(),
      useAmountRange: form.useAmountRange, sequential: form.sequential, minAmount, maxAmount,
      email: form.email, sms: form.sms, whatsapp: form.whatsapp, isActive: form.isActive,
      createdAt: previous?.createdAt || now, updatedAt: now,
    }
    persist({ ...data, workflows: previous
      ? data.workflows.map((workflow) => workflow.id === record.id ? record : workflow)
      : [...data.workflows, record] })
    log(userId || 'system', previous ? 'UPDATE' : 'CREATE', 'ApprovalWorkflow', `${record.title} · ${record.documentType}`)
    toast.success(previous ? 'Workflow updated' : 'Workflow saved', record.title)
    setForm(emptyWorkflowForm())
  }
  const edit = (workflow: ApprovalWorkflow) => setForm(workflowToForm(workflow))
  const remove = (workflow: ApprovalWorkflow) => {
    if (!window.confirm(`Delete workflow “${workflow.title}” and its approval steps?`)) return
    persist({ ...data, workflows: data.workflows.filter((item) => item.id !== workflow.id), steps: data.steps.filter((step) => step.workflowId !== workflow.id) })
    log(userId || 'system', 'DELETE', 'ApprovalWorkflow', workflow.title)
    toast.success('Workflow deleted', workflow.title)
    if (form.id === workflow.id) setForm(emptyWorkflowForm())
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Panel title="Approval Workflows" icon={<Pencil className="size-5" />}>
        <div className="grid gap-3">
          <Field label="Menu" required>
            <Select value={form.menuId} onChange={(event) => setForm({ ...form, menuId: event.target.value, documentType: '' })} placeholder="Please Select…">
              <option value="">Please Select…</option>
              {APPROVAL_MENUS.map((menu) => <option key={menu.id} value={menu.id}>{menu.label}</option>)}
            </Select>
          </Field>
          <Field label="Document Type" required>
            <Select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })} disabled={!form.menuId}>
              <option value="">{form.menuId ? 'Select document type…' : 'Select Menu First…'}</option>
              {docTypeOptions.map((item) => <option key={item.id} value={item.documentType}>{item.name}{item.isActive ? '' : ' (Inactive)'}</option>)}
            </Select>
          </Field>
          <Field label="Approval Workflows Title" required><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={100} /></Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sequential} onChange={(event) => setForm({ ...form, sequential: event.target.checked })} className="size-4 accent-sky-600" />
            <span>Is Sequential</span><span className="text-sky-500" title="Sequential workflows activate each approval step in level order."><Info className="size-4" /></span>
          </label>
          <Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} placeholder="Describe this approval workflow" /></Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={form.useAmountRange} onChange={(event) => setForm({ ...form, useAmountRange: event.target.checked, minAmount: '', maxAmount: '' })} className="size-4 accent-sky-600" />
            <span>Use Amount Range</span><span className="text-sky-500" title="Only requests inside this inclusive amount range will match this workflow."><Info className="size-4" /></span>
          </label>
          {form.useAmountRange && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum amount" required><Input type="number" min="0" step="0.01" value={form.minAmount} onChange={(event) => setForm({ ...form, minAmount: event.target.value })} /></Field>
              <Field label="Maximum amount" required><Input type="number" min={form.minAmount || '0'} step="0.01" value={form.maxAmount} onChange={(event) => setForm({ ...form, maxAmount: event.target.value })} /></Field>
            </div>
          )}
          <Field label="Workflow scope" hint="Choose whether this workflow applies to every branch or only the currently selected branch.">
            <Select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as WorkflowForm['scope'] })}>
              <option value="all">All branches</option><option value="branch">{branchName}</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {([
              ['email', 'Email'], ['sms', 'SMS Alert'], ['whatsapp', 'Whatsapp'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="size-4 accent-sky-600" />{label}
              </label>
            ))}
          </div>
          <Field label="Status" required>
            <Select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}>
              <option value="active">ACTIVE</option><option value="inactive">INACTIVE</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="lime" className="flex-1" onClick={save}><Save className="size-4" />{form.id ? 'Update Workflow' : 'Save'}</Button>
            {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyWorkflowForm())}>Cancel</Button>}
          </div>
        </div>
      </Panel>
      <Panel title="Approval Workflows List" icon={<ListOrdered className="size-5" />}>
        <ListToolbar query={query} onQuery={setQuery} pageSize={pageSize} onPageSize={setPageSize} shown={rows.length} total={filtered.length} exportRows={exportRows} filename="approval-workflows" />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[650px] border-collapse text-sm">
            <thead className="bg-[#d7deea] text-left text-[#26384f] dark:bg-white/10 dark:text-zinc-200"><tr>
              <th className="px-3 py-3">No.</th><th className="px-3 py-3">Approval Workflows Title</th><th className="px-3 py-3">Amount Range</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((workflow, index) => (
                <tr key={workflow.id} className="odd:bg-black/[0.025] dark:odd:bg-white/[0.025]">
                  <td className="px-3 py-3">{(page - 1) * pageSize + index + 1}</td>
                  <td className="px-3 py-3"><p className="font-semibold">{workflow.title}</p><p className="mt-0.5 text-xs text-mist">{menuLabel(workflow.menuId)} · {docTypeName(workflow.documentType, documentTypes)}</p></td>
                  <td className="px-3 py-3 whitespace-nowrap">{amountRange(workflow)}</td>
                  <td className="px-3 py-3"><Badge tone={workflow.isActive ? 'lime' : 'zinc'}>{workflow.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
                  <td className="px-3 py-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => edit(workflow)}><Pencil className="size-3.5" /> Edit</Button><Button type="button" size="icon" variant="ghost" aria-label={`Delete ${workflow.title}`} onClick={() => remove(workflow)}><Trash2 className="size-4 text-ember" /></Button></div></td>
                </tr>
              ))}
              {!rows.length && <EmptyRows colSpan={5} />}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
      </Panel>
    </div>
  )
}

type StepForm = {
  id: string
  workflowId: string
  level: string
  stepName: string
  roleId: string
  slaHours: string
  customSlaHours: string
  escalationHours: string
  escalationRoleId: string
  rejectToStepId: string
  approvalMode: ApprovalStep['approvalMode']
  isActive: boolean
  assignedUserIds: string[]
}
function emptyStepForm(workflowId = ''): StepForm {
  return { id: '', workflowId, level: '', stepName: '', roleId: '', slaHours: '', customSlaHours: '', escalationHours: '', escalationRoleId: '', rejectToStepId: '', approvalMode: 'approve_all', isActive: true, assignedUserIds: [] }
}
function stepToForm(step: ApprovalStep): StepForm {
  const predefinedSla = [4, 8, 24, 48, 72].includes(step.slaHours)
  return { id: step.id, workflowId: step.workflowId, level: String(step.level), stepName: step.stepName, roleId: String(step.roleId), slaHours: predefinedSla ? String(step.slaHours) : 'custom', customSlaHours: predefinedSla ? '' : String(step.slaHours), escalationHours: step.escalationHours > 0 ? String(step.escalationHours) : '', escalationRoleId: String(step.escalationRoleId || ''), rejectToStepId: step.rejectToStepId || '', approvalMode: step.approvalMode, isActive: step.isActive, assignedUserIds: [...step.assignedUserIds] }
}

function StepsPanel({
  data, persist, workflows, roles, users, companyId, toast, log, userId,
}: {
  data: ApprovalModuleData
  persist: (next: ApprovalModuleData) => void
  workflows: ApprovalWorkflow[]
  roles: Array<{ id: string; name: string; portal: string }>
  users: Array<{ id: string; name: string; role: string; status: string; companyId?: string; branchId?: string }>
  companyId: string
  toast: Toast
  log: (userId: string, action: string, entity: string, details: string) => void
  userId: string
}) {
  const firstWorkflowId = workflows[0]?.id || ''
  const [workflowFilter, setWorkflowFilter] = useState(firstWorkflowId)
  const [form, setForm] = useState<StepForm>(() => emptyStepForm(firstWorkflowId))
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [assigningStep, setAssigningStep] = useState<ApprovalStep | null>(null)
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([])
  useEffect(() => {
    if (!workflows.some((workflow) => workflow.id === workflowFilter)) {
      const nextId = workflows[0]?.id || ''
      setWorkflowFilter(nextId)
      setForm(emptyStepForm(nextId))
    }
  }, [workflows, workflowFilter, data.steps])
  const selectedWorkflowId = form.workflowId || workflowFilter
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId)
  const workflowSteps = useMemo(() => data.steps.filter((step) => step.workflowId === workflowFilter).sort((a, b) => a.level - b.level), [data.steps, workflowFilter])
  const roleOptions = roles.filter((role) => role.portal === 'admin').sort((a, b) => a.name.localeCompare(b.name))
  const candidates = users.filter((candidate) => candidate.status === 'active' && candidate.role === form.roleId && (!candidate.companyId || candidate.companyId === companyId))
  const queryRows = workflowSteps.filter((step) => !query || `${approvalStepListName(step.stepName)} ${step.level} ${roleLabel(String(step.roleId), roleOptions)}`.toLowerCase().includes(query.trim().toLowerCase()))
  const rows = queryRows.slice((page - 1) * pageSize, page * pageSize)
  const exportRows: ExportRow[] = queryRows.map((step) => ({
    'Step Name': approvalStepListName(step.stepName), Level: step.level, Role: roleLabel(String(step.roleId), roleOptions),
    Assign: step.assignedUserIds.map((id) => users.find((candidate) => candidate.id === id)?.name || id).join(', '),
    Status: step.isActive ? 'ACTIVE' : 'INACTIVE',
  }))
  useEffect(() => setPage(1), [query, pageSize, workflowFilter, workflowSteps.length])

  const changeWorkflow = (nextId: string) => {
    setWorkflowFilter(nextId)
    setForm(emptyStepForm(nextId))
  }
  const save = () => {
    if (!form.workflowId || !workflows.some((workflow) => workflow.id === form.workflowId)) { toast.error('Select an approval workflow.'); return }
    if (!form.stepName.trim()) { toast.error('Enter a step name.'); return }
    if (!form.roleId) { toast.error('Choose the role responsible for this step.'); return }
    const level = Number(form.level)
    const slaHours = Number(form.slaHours === 'custom' ? form.customSlaHours : form.slaHours)
    const escalationHours = Number(form.escalationHours)
    if (!Number.isInteger(level) || level < 1) { toast.error('Level must be a positive whole number.'); return }
    if (!form.slaHours || !Number.isInteger(slaHours) || slaHours < 1) { toast.error('Select an SLA duration or enter a custom number of hours.'); return }
    if (!form.escalationHours || !Number.isInteger(escalationHours) || escalationHours < 1) { toast.error('Select an escalation duration of at least one hour.'); return }
    const duplicateLevel = data.steps.some((step) => step.workflowId === form.workflowId && step.level === level && step.id !== form.id)
    if (duplicateLevel) { toast.error('That workflow already has a step at this level.'); return }
    const now = dateNow()
    const old = form.id ? data.steps.find((step) => step.id === form.id) : undefined
    const record: ApprovalStep = {
      id: old?.id || uid('apst'), workflowId: form.workflowId, level, stepName: form.stepName.trim(), roleId: form.roleId,
      slaHours, escalationHours, escalationRoleId: form.escalationRoleId, rejectToStepId: form.rejectToStepId || null,
      approvalMode: form.approvalMode, isActive: form.isActive, assignedUserIds: [...form.assignedUserIds], ruleJson: old?.ruleJson || null,
      createdAt: old?.createdAt || now, updatedAt: now,
    }
    persist({ ...data, steps: old
      ? data.steps.map((step) => step.id === record.id ? record : step)
      : [...data.steps, record] })
    log(userId || 'system', old ? 'UPDATE' : 'CREATE', 'ApprovalStep', `${record.workflowId} · level ${record.level} · ${record.stepName}`)
    toast.success(old ? 'Approval step updated' : 'Approval step saved', record.stepName)
    setWorkflowFilter(record.workflowId)
    setForm(emptyStepForm(record.workflowId))
  }
  const edit = (step: ApprovalStep) => { setWorkflowFilter(step.workflowId); setForm(stepToForm(step)) }
  const remove = (step: ApprovalStep) => {
    if (!window.confirm(`Delete approval step “${step.stepName}”?`)) return
    persist({ ...data, steps: data.steps.filter((item) => item.id !== step.id).map((item) => item.rejectToStepId === step.id ? { ...item, rejectToStepId: null } : item) })
    log(userId || 'system', 'DELETE', 'ApprovalStep', `${step.stepName} · level ${step.level}`)
    toast.success('Approval step deleted', step.stepName)
    if (form.id === step.id) setForm(emptyStepForm(workflowFilter))
  }
  const openAssignments = (step: ApprovalStep) => {
    setAssigningStep(step)
    setAssignmentDraft([...step.assignedUserIds])
  }
  const assignableUsers = (step: ApprovalStep) => users.filter((candidate) =>
    candidate.status === 'active' && candidate.role === String(step.roleId) && (!candidate.companyId || candidate.companyId === companyId),
  )
  const assignmentOptions = (step: ApprovalStep) => {
    const eligible = assignableUsers(step)
    const existing = step.assignedUserIds.map((id) => users.find((candidate) => candidate.id === id)).filter((candidate): candidate is typeof users[number] => !!candidate)
    return [...eligible, ...existing.filter((candidate) => !eligible.some((option) => option.id === candidate.id))]
  }
  const saveAssignments = () => {
    if (!assigningStep) return
    const current = data.steps.find((step) => step.id === assigningStep.id)
    if (!current) { setAssigningStep(null); return }
    const updated = { ...current, assignedUserIds: [...assignmentDraft], updatedAt: dateNow() }
    persist({ ...data, steps: data.steps.map((step) => step.id === updated.id ? updated : step) })
    if (form.id === updated.id) setForm((state) => ({ ...state, assignedUserIds: [...assignmentDraft] }))
    log(userId || 'system', 'UPDATE', 'ApprovalStepUsers', `${updated.stepName}: ${assignmentDraft.length} user(s) assigned`)
    toast.success('Approver assignments saved', updated.stepName)
    setAssigningStep(null)
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Panel title="Approval Steps" icon={<Pencil className="size-5" />}>
        <div className="grid gap-3">
          <Field label="Approval Workflows" required>
            <Select value={form.workflowId} onChange={(event) => { setWorkflowFilter(event.target.value); setForm({ ...form, workflowId: event.target.value, id: '', level: '', stepName: '', roleId: '', assignedUserIds: [] }) }}>
              <option value="">Please Select…</option>
              {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.title}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-[0.75fr_1.25fr] gap-3">
            <Field label="(Level)" required>
              <Select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} disabled={!form.workflowId} aria-label="Approval step level">
                <option value="">Please Select…</option>
                {Array.from({ length: Math.max(20, Number(form.level) || 0) }, (_, index) => index + 1).map((level) => <option key={level} value={level}>{level}</option>)}
              </Select>
            </Field>
            <Field label="Role" required>
              <Select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value, assignedUserIds: [] })} disabled={!form.workflowId}>
                <option value="">Please Select…</option>
                {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Step Name" required><Input value={form.stepName} onChange={(event) => setForm({ ...form, stepName: event.target.value })} disabled={!form.workflowId} /></Field>
          <Field label={<span className="inline-flex items-center">SLA Hours <BootstrapInfoTip text={SLA_TOOLTIP_TEXT} /></span>} required>
            <Select value={form.slaHours} onChange={(event) => setForm({
              ...form,
              slaHours: event.target.value,
              customSlaHours: event.target.value === 'custom' && form.slaHours && form.slaHours !== 'custom' ? form.slaHours : form.customSlaHours,
            })} disabled={!form.workflowId}>
              <option value="">Select SLA</option>
              {[4, 8, 24, 48, 72].map((hours) => <option key={hours} value={hours}>{hours} Hours</option>)}
              <option value="custom">Custom</option>
            </Select>
          </Field>
          {form.slaHours === 'custom' && <Field label="Custom SLA Hours" required><Input type="number" min="1" step="1" value={form.customSlaHours} onChange={(event) => setForm({ ...form, customSlaHours: event.target.value })} placeholder="Enter hours" /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={<span className="inline-flex items-center">Esc Hours <BootstrapInfoTip text={ESCALATION_TOOLTIP_TEXT} /></span>} required>
              <Select value={form.escalationHours} onChange={(event) => setForm({ ...form, escalationHours: event.target.value })} disabled={!form.workflowId} aria-label="Escalation hours">
                <option value="">Please Select…</option>
                {Array.from({ length: 72 }, (_, index) => index + 1).map((hours) => <option key={hours} value={hours}>{hours}</option>)}
              </Select>
            </Field>
            <Field label={<span className="inline-flex items-center">Escalation Role <BootstrapInfoTip text={ESCALATION_ROLE_TOOLTIP_TEXT} /></span>}>
              <Select value={form.escalationRoleId} onChange={(event) => setForm({ ...form, escalationRoleId: event.target.value })} disabled={!form.workflowId}>
                <option value="">None</option>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={<span className="inline-flex items-center">Reject to Step Level <BootstrapInfoTip text={REJECT_STEP_TOOLTIP_TEXT} /></span>}>
            <Select value={form.rejectToStepId} onChange={(event) => setForm({ ...form, rejectToStepId: event.target.value })} disabled={!form.workflowId}>
              <option value="">Please Select…</option>
              {workflowSteps.filter((step) => step.id !== form.id).map((step) => <option key={step.id} value={step.id}>Level {step.level} · {step.stepName}</option>)}
            </Select>
          </Field>
          <Field label="Approval Mode">
            <Select value={form.approvalMode} onChange={(event) => setForm({ ...form, approvalMode: event.target.value as ApprovalStep['approvalMode'] })} disabled={!form.workflowId}>
              <option value="approve_all">All assigned users must approve</option><option value="approve_any_one">Any one assigned user may approve</option>
            </Select>
          </Field>
          <Field label="Assign users" hint="Optional. If no users are selected, assignments follow the selected role.">
            <div className="max-h-32 overflow-y-auto rounded-lg border border-line p-2">
              {!form.roleId && <p className="text-xs text-mist">Choose a role to see matching users.</p>}
              {form.roleId && !candidates.length && <p className="text-xs text-mist">No active users are assigned to this role.</p>}
              {candidates.map((candidate) => (
                <label key={candidate.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5">
                  <input type="checkbox" className="accent-sky-600" checked={form.assignedUserIds.includes(candidate.id)} onChange={(event) => setForm({ ...form, assignedUserIds: event.target.checked ? [...form.assignedUserIds, candidate.id] : form.assignedUserIds.filter((id) => id !== candidate.id) })} />
                  <span>{candidate.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
            <Field label="Status" required>
              <Select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}>
                <option value="active">ACTIVE</option><option value="inactive">INACTIVE</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="lime" className="flex-1" onClick={save} disabled={!form.workflowId}><Save className="size-4" />{form.id ? 'Update Step' : 'Save'}</Button>
              {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyStepForm(workflowFilter))}>Cancel</Button>}
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Approval Steps List" icon={<ListOrdered className="size-5" />}>
        <div className="mb-3 max-w-sm">
          <Field label="Approval workflow">
            <Select value={workflowFilter} onChange={(event) => changeWorkflow(event.target.value)}>
              <option value="">Please Select…</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.title}</option>)}
            </Select>
          </Field>
        </div>
        <ListToolbar query={query} onQuery={setQuery} pageSize={pageSize} onPageSize={setPageSize} shown={rows.length} total={queryRows.length} exportRows={exportRows} filename="approval-steps" />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead className="bg-[#d7deea] text-left text-[#26384f] dark:bg-white/10 dark:text-zinc-200"><tr>
              <th className="px-3 py-3">Step Name</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Assign <span title="Users explicitly assigned to this step; empty means the role may act."><CircleHelp className="inline size-3.5 text-sky-500" /></span></th><th className="px-3 py-3">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((step) => (
                <tr key={step.id} className="odd:bg-black/[0.025] dark:odd:bg-white/[0.025]">
                  <td className="px-3 py-3"><div className="flex flex-col items-start gap-1.5"><span className="font-semibold">{approvalStepListName(step.stepName)}</span><Badge tone={step.isActive ? 'lime' : 'zinc'} className="px-2 py-0.5 text-[10px]">{step.isActive ? 'Active' : 'Inactive'}</Badge></div></td>
                  <td className="px-3 py-3">{step.level}</td>
                  <td className="px-3 py-3">{roleLabel(String(step.roleId), roleOptions)}</td>
                  <td className="px-3 py-3 text-center" title={step.assignedUserIds.length ? `${step.assignedUserIds.length} user(s) assigned` : 'No specific users assigned; the role can act'}><Button type="button" size="icon" variant="lime" className="size-11 rounded-full" onClick={() => openAssignments(step)} aria-label={`Assign approvers to ${approvalStepListName(step.stepName)}`}><UserPlus className="size-5" /></Button></td>
                  <td className="px-3 py-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => edit(step)}><Pencil className="size-3.5" /> Edit</Button><Button type="button" size="icon" variant="ghost" aria-label={`Delete ${approvalStepListName(step.stepName)}`} onClick={() => remove(step)}><Trash2 className="size-4 text-ember" /></Button></div></td>
                </tr>
              ))}
              {!rows.length && <EmptyRows colSpan={5} label={workflowFilter ? 'No entries found' : 'Select or create a workflow first.'} />}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={queryRows.length} onPage={setPage} />
        {selectedWorkflow && <p className="mt-2 text-xs text-mist">Steps are activated according to this workflow&apos;s {selectedWorkflow.sequential ? 'sequential level order' : 'parallel approval setting'}.</p>}
      </Panel>
      <Modal
        open={!!assigningStep}
        onClose={() => setAssigningStep(null)}
        title={assigningStep ? `Assign approvers · ${assigningStep.stepName}` : 'Assign approvers'}
      >
        {assigningStep && (
          <div className="grid gap-4">
            <p className="text-sm text-mist">Select specific users for <span className="font-semibold text-ink dark:text-white">{roleLabel(String(assigningStep.roleId), roleOptions)}</span>. If no users are selected, the role can act on this step.</p>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-line p-2">
              {assignmentOptions(assigningStep).map((candidate) => (
                <label key={candidate.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                  <input
                    type="checkbox"
                    className="size-4 accent-sky-600"
                    checked={assignmentDraft.includes(candidate.id)}
                    onChange={(event) => setAssignmentDraft((current) => event.target.checked
                      ? [...current, candidate.id]
                      : current.filter((id) => id !== candidate.id))}
                  />
                  <span className="flex-1">{candidate.name}</span>
                  {candidate.status !== 'active' && <Badge tone="zinc">INACTIVE</Badge>}
                </label>
              ))}
              {!assignmentOptions(assigningStep).length && <p className="px-2 py-6 text-center text-sm text-mist">No active users currently match this role.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssigningStep(null)}>Cancel</Button>
              <Button type="button" variant="lime" onClick={saveAssignments}><Save className="size-4" /> Save assignments</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function RuleActionsPanel({
  data, persist, companyId, branchId, userId, toast, log,
}: {
  data: ApprovalModuleData
  persist: (next: ApprovalModuleData) => void
  companyId: string
  branchId: string
  userId: string
  toast: Toast
  log: (userId: string, action: string, entity: string, details: string) => void
}) {
  const blankForm = () => ({ id: '', field: 'amount', operator: '=', value: '', action: 'approve' as ApprovalRuleAction['action'], label: '', isActive: true })
  const [form, setForm] = useState(blankForm)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const actions = data.ruleActions.filter((action) => action.companyId === companyId && (action.branchId === branchId || action.branchId === '*'))
  const filtered = actions.filter((action) => !query || `${action.field} ${action.operator} ${action.value} ${action.action} ${action.label}`.toLowerCase().includes(query.trim().toLowerCase()))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const exportRows: ExportRow[] = filtered.map((action, index) => ({ No: index + 1, Field: action.field, Operator: action.operator, Value: action.value, Action: action.action, Label: action.label, Status: action.isActive ? 'ACTIVE' : 'INACTIVE' }))
  useEffect(() => setPage(1), [query, pageSize, actions.length])
  const save = () => {
    if (!form.field.trim()) { toast.error('Choose the field for this rule action.'); return }
    if (!form.value.trim()) { toast.error('Enter a value for this rule action.'); return }
    if (!form.label.trim()) { toast.error('Enter a label for this rule action.'); return }
    const old = form.id ? data.ruleActions.find((action) => action.id === form.id) : undefined
    const now = dateNow()
    const record: ApprovalRuleAction = {
      id: old?.id || uid('apra'), companyId, branchId, field: form.field.trim(), operator: form.operator,
      value: form.value.trim(), action: form.action, label: form.label.trim(), isActive: form.isActive,
      createdAt: old?.createdAt || now, updatedAt: now,
    }
    persist({ ...data, ruleActions: old
      ? data.ruleActions.map((action) => action.id === record.id ? record : action)
      : [...data.ruleActions, record] })
    log(userId || 'system', old ? 'UPDATE' : 'CREATE', 'ApprovalRuleAction', `${record.field} ${record.operator} ${record.value} → ${record.action}`)
    toast.success(old ? 'Rule action updated' : 'Rule action saved', record.label)
    setForm(blankForm())
  }
  const edit = (action: ApprovalRuleAction) => setForm({ id: action.id, field: action.field, operator: action.operator, value: action.value, action: action.action, label: action.label, isActive: action.isActive })
  const remove = (action: ApprovalRuleAction) => {
    if (!window.confirm(`Delete rule action “${action.label}”?`)) return
    persist({ ...data, ruleActions: data.ruleActions.filter((item) => item.id !== action.id) })
    log(userId || 'system', 'DELETE', 'ApprovalRuleAction', action.label)
    toast.success('Rule action deleted', action.label)
    if (form.id === action.id) setForm(blankForm())
  }
  const toggle = (action: ApprovalRuleAction) => persist({ ...data, ruleActions: data.ruleActions.map((item) => item.id === action.id ? { ...item, isActive: !item.isActive, updatedAt: dateNow() } : item) })

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Panel title="Rule Actions" icon={<Pencil className="size-5" />}>
        <div className="grid gap-3">
          <Field label="Field" required>
            <Select value={form.field} onChange={(event) => setForm({ ...form, field: event.target.value })}>
              {RULE_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.value}</option>)}
            </Select>
          </Field>
          <Field label="Operator" required>
            <Select value={form.operator} onChange={(event) => setForm({ ...form, operator: event.target.value })}>
              {RULE_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
            </Select>
          </Field>
          <Field label="Value" required><Input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Enter value" /></Field>
          <Field label="Action" required>
            <Select value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value as ApprovalRuleAction['action'] })}>
              {ACTION_OPTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
            </Select>
          </Field>
          <Field label="Label" required><Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. Approve" /></Field>
          <Field label="Status">
            <Select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}><option value="active">ACTIVE</option><option value="inactive">INACTIVE</option></Select>
          </Field>
          <div className="flex gap-2"><Button type="button" variant="lime" className="flex-1" onClick={save}><Save className="size-4" />{form.id ? 'Update' : 'Save'}</Button>{form.id && <Button type="button" variant="outline" onClick={() => setForm(blankForm())}>Cancel</Button>}</div>
          <p className="text-[11px] leading-relaxed text-mist">Rule Actions are reusable decision mappings. Per-step nested conditions are configured in Auto Approval Rule.</p>
        </div>
      </Panel>
      <Panel title="Rule Actions List" icon={<ListOrdered className="size-5" />}>
        <ListToolbar query={query} onQuery={setQuery} pageSize={pageSize} onPageSize={setPageSize} shown={rows.length} total={filtered.length} exportRows={exportRows} filename="approval-rule-actions" />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="bg-[#d7deea] text-left text-[#26384f] dark:bg-white/10 dark:text-zinc-200"><tr>
              <th className="px-3 py-3">No.</th><th className="px-3 py-3">Field</th><th className="px-3 py-3">Operator</th><th className="px-3 py-3">Value</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Label</th><th className="px-3 py-3">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((action, index) => (
                <tr key={action.id} className="odd:bg-black/[0.025] dark:odd:bg-white/[0.025]">
                  <td className="px-3 py-3">{(page - 1) * pageSize + index + 1}</td><td className="px-3 py-3">{action.field}</td><td className="px-3 py-3">{action.operator}</td><td className="px-3 py-3">{action.value}</td><td className="px-3 py-3">{action.action}</td><td className="px-3 py-3">{action.label}{!action.isActive && <span className="ml-2"><Badge tone="zinc">INACTIVE</Badge></span>}</td>
                  <td className="px-3 py-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => edit(action)}><Pencil className="size-3.5" /> Edit</Button><Button type="button" size="icon" variant="ghost" aria-label={`${action.isActive ? 'Deactivate' : 'Activate'} ${action.label}`} onClick={() => toggle(action)}><Check className={`size-4 ${action.isActive ? 'text-emerald-600' : 'text-mist'}`} /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Delete ${action.label}`} onClick={() => remove(action)}><Trash2 className="size-4 text-ember" /></Button></div></td>
                </tr>
              ))}
              {!rows.length && <EmptyRows colSpan={7} />}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
      </Panel>
    </div>
  )
}

type DocumentTypeForm = {
  sidemenu: string
  name: string
  documentType: string
}

const emptyDocumentTypeForm = (): DocumentTypeForm => ({ sidemenu: '', name: '', documentType: '' })

function DocumentTypesPanel({
  documentTypes, persist, userId, toast, log,
}: {
  documentTypes: ApprovalDocType[]
  persist: (next: ApprovalDocType[]) => void
  userId: string
  toast: Toast
  log: (userId: string, action: string, entity: string, details: string) => void
}) {
  const [form, setForm] = useState<DocumentTypeForm>(emptyDocumentTypeForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const formPanelRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documentTypes.filter((item) => !q ||
      `${menuLabel(item.sidemenu)} ${item.name} ${item.documentType} ${item.isActive ? 'active enabled' : 'inactive disabled'}`.toLowerCase().includes(q))
      .sort((a, b) => a.id - b.id)
  }, [documentTypes, query])
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const exportRows: ExportRow[] = filtered.map((item) => ({
    No: item.id,
    Menu: menuLabel(item.sidemenu),
    Name: item.name,
    'Document Type': item.documentType,
    Status: item.isActive ? 'ACTIVE' : 'INACTIVE',
  }))
  useEffect(() => setPage(1), [query, pageSize, documentTypes.length])

  const save = () => {
    const name = form.name.trim()
    const documentType = form.documentType.trim().toUpperCase()
    const sidemenu = Number(form.sidemenu)
    if (form.sidemenu === '') { toast.error('Select the menu for this document type.'); return }
    if (!name) { toast.error('Enter a document type name.'); return }
    if (name.length > 100) { toast.error('Document type name is too long', 'Use no more than 100 characters.'); return }
    if (!documentType) { toast.error('Enter a document type code.'); return }
    if (documentType.length > 50 || !/^[A-Z0-9][A-Z0-9 _-]*$/.test(documentType)) {
      toast.error('Enter a valid document type code', 'Use up to 50 letters, numbers, spaces, underscores or hyphens. The value is saved in uppercase.')
      return
    }
    if (documentTypes.some((item) => item.id !== editingId && item.documentType.trim().toUpperCase() === documentType)) {
      toast.error('That document type code already exists', `Use a unique code instead of “${documentType}”.`)
      return
    }
    const existing = editingId === null ? undefined : documentTypes.find((item) => item.id === editingId)
    if (editingId !== null && !existing) { toast.error('Document type was not found. Refresh the list and try again.'); return }
    const record: ApprovalDocType = existing
      ? { ...existing, sidemenu, name, documentType }
      : { id: Math.max(0, ...documentTypes.map((item) => item.id)) + 1, sidemenu, name, documentType, docTypeTable: '', isActive: true }
    const next = existing
      ? documentTypes.map((item) => item.id === existing.id ? record : item)
      : [...documentTypes, record]
    persist(next.sort((a, b) => a.id - b.id))
    log(userId || 'system', existing ? 'UPDATE' : 'CREATE', 'ApprovalDocType', `${record.documentType} · ${record.name}`)
    toast.success(existing ? 'Document type updated' : 'Document type added', `${record.name} (${record.documentType})`)
    setForm(emptyDocumentTypeForm())
    setEditingId(null)
  }

  const edit = (record: ApprovalDocType) => {
    setForm({ sidemenu: String(record.sidemenu), name: record.name, documentType: record.documentType })
    setEditingId(record.id)
    window.requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const cancelEdit = () => {
    setForm(emptyDocumentTypeForm())
    setEditingId(null)
  }

  const toggle = (record: ApprovalDocType) => {
    const isActive = !record.isActive
    persist(documentTypes.map((item) => item.id === record.id ? { ...item, isActive } : item))
    log(userId || 'system', 'UPDATE', 'ApprovalDocType', `${record.documentType} ${isActive ? 'enabled' : 'disabled'}`)
    toast.success(`Document type ${isActive ? 'enabled' : 'disabled'}`, record.name)
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div ref={formPanelRef}>
      <Panel title={editingId === null ? 'Add Document Type' : 'Edit Document Type'} icon={<FileText className="size-5" />}>
        <div className="grid gap-3">
          <Field label="Menu" required>
            <Select value={form.sidemenu} onChange={(event) => setForm({ ...form, sidemenu: event.target.value })}>
              <option value="">Please Select…</option>
              <option value="0">Other / General</option>
              {APPROVAL_MENUS.map((menu) => <option key={menu.id} value={menu.id}>{menu.label}</option>)}
            </Select>
          </Field>
          <Field label="Document Type Name" required>
            <Input value={form.name} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. EXPENSE CLAIM" />
          </Field>
          <Field label="Document Type Code" required hint="Unique value stored as document_type, e.g. EXPENSE_CLAIM.">
            <Input value={form.documentType} maxLength={50} onChange={(event) => setForm({ ...form, documentType: event.target.value })} placeholder="e.g. EXPENSE_CLAIM" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="lime" onClick={save}>{editingId === null ? <Plus className="size-4" /> : <Save className="size-4" />}{editingId === null ? 'Add Document Type' : 'Update Document Type'}</Button>
            {editingId !== null && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
          </div>
          <p className="text-[11px] leading-relaxed text-mist">Document types are available to Approval Workflows. In this build, entries and status changes are saved in this browser because no document-type API is available.</p>
        </div>
      </Panel>
      </div>
      <Panel title="Document Type List" icon={<ListOrdered className="size-5" />}>
        <ListToolbar query={query} onQuery={setQuery} pageSize={pageSize} onPageSize={setPageSize} shown={rows.length} total={filtered.length} exportRows={exportRows} filename="approval-document-types" />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead className="bg-[#d7deea] text-left text-[#26384f] dark:bg-white/10 dark:text-zinc-200"><tr>
              <th className="px-3 py-3">No.</th><th className="px-3 py-3">Menu</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Document Type</th><th className="px-3 py-3 text-center">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((item) => (
                <tr key={item.documentType} className="odd:bg-black/[0.025] dark:odd:bg-white/[0.025]">
                  <td className="px-3 py-3 font-mono text-xs">{item.id}</td>
                  <td className="px-3 py-3">{menuLabel(item.sidemenu)}</td>
                  <td className="px-3 py-3 font-semibold">{item.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{item.documentType}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => edit(item)} aria-label={`Edit ${item.name}`}><Pencil className="size-3.5" /> Edit</Button>
                      {!item.isActive && <span className="text-[10px] font-bold uppercase tracking-wide text-mist">Disabled</span>}
                      <Switch checked={item.isActive} onChange={() => toggle(item)} aria-label={`${item.isActive ? 'Disable' : 'Enable'} ${item.name}`} />
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <EmptyRows colSpan={5} label="No document types match your search" />}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
      </Panel>
    </div>
  )
}

function AutoApprovalPanel({
  data, persist, workflows, roles, ruleActions, toast,
}: {
  data: ApprovalModuleData
  persist: (next: ApprovalModuleData) => void
  workflows: ApprovalWorkflow[]
  roles: Array<{ id: string; name: string }>
  ruleActions: ApprovalRuleAction[]
  toast: Toast
}) {
  const [workflowId, setWorkflowId] = useState('')
  const [stepId, setStepId] = useState('')
  const [rule, setRule] = useState<ApprovalRuleGroup>(() => newApprovalRuleGroup())
  const [activeGroupId, setActiveGroupId] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const ruleActionOptions = useMemo((): Array<{ value: string; label: string }> => {
    if (!ruleActions.length) return ACTION_OPTIONS.map((action) => ({ value: action.value, label: action.label }))
    const configured = new Map<string, { value: string; label: string }>()
    for (const action of ruleActions) {
      if (!configured.has(action.action)) configured.set(action.action, { value: action.action, label: action.label })
    }
    return [...configured.values()]
  }, [ruleActions])
  useEffect(() => {
    if (!workflows.some((workflow) => workflow.id === workflowId)) setWorkflowId(workflows[0]?.id || '')
  }, [workflows, workflowId])
  const workflowSteps = data.steps.filter((step) => step.workflowId === workflowId).sort((a, b) => a.level - b.level)
  useEffect(() => {
    if (!workflowSteps.some((step) => step.id === stepId)) setStepId(workflowSteps[0]?.id || '')
  }, [workflowSteps, stepId])
  const selectedStep = workflowSteps.find((step) => step.id === stepId)
  useEffect(() => {
    const loadedRule = ruleJsonToGroup(selectedStep?.ruleJson || null)
    setRule(loadedRule)
    setActiveGroupId(loadedRule.id)
    setPreviewOpen(false)
  }, [selectedStep?.id])

  const updateNode = (nodeId: string, update: (node: ApprovalRuleNode) => ApprovalRuleNode) => setRule((current) => updateRuleNode(current, nodeId, update))
  const addCondition = (groupId: string) => setRule((current) => appendRuleChild(current, groupId, blankRuleCondition()))
  const addGroup = (groupId: string) => {
    const group = newApprovalRuleGroup()
    setRule((current) => appendRuleChild(current, groupId, group))
    setActiveGroupId(group.id)
  }
  const removeNode = (nodeId: string) => {
    const next = rule.id === nodeId ? { ...rule, children: [] } : removeRuleNode(rule, nodeId)
    setRule(next)
    setActiveGroupId((current) => ruleGroupExists(next, current) ? current : next.id)
  }
  const save = () => {
    if (!selectedStep) { toast.error('Select an approval workflow and step first.'); return }
    if (!rule.children.length) { toast.error('Add at least one condition or sub-group before saving.'); return }
    const missing = findMissingRuleValue(rule)
    if (missing) { toast.error('Complete all rule conditions before saving.', missing); return }
    const nextStep = { ...selectedStep, ruleJson: ruleGroupToJson(rule), updatedAt: dateNow() }
    persist({ ...data, steps: data.steps.map((step) => step.id === nextStep.id ? nextStep : step) })
    toast.success(selectedStep.ruleJson ? 'Automatic approval rule updated' : 'Automatic approval rule saved', `${selectedStep.stepName} · Level ${selectedStep.level}`)
  }
  const previewJson = JSON.stringify(ruleGroupToJson(rule), null, 2)

  return (
    <section className="min-w-0">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="min-w-0">
          <Field label="Approval Workflows" required>
            <Select value={workflowId} onChange={(event) => { setWorkflowId(event.target.value); setStepId('') }}>
              <option value="">Please Select…</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.title}</option>)}
            </Select>
          </Field>
          <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
            <Field label="Step Name" required><Input value={selectedStep?.stepName || ''} readOnly disabled /></Field>
            <Field label="Level" required><Input value={selectedStep ? String(selectedStep.level) : ''} readOnly disabled /></Field>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-bold">Nested Rule Builder</p>
              {rule.name && <Badge tone="lime">{rule.name}</Badge>}
            </div>
            <RuleGroupEditor node={rule} depth={0} activeGroupId={activeGroupId || rule.id} onSelectGroup={setActiveGroupId} onUpdate={updateNode} onAddCondition={addCondition} onAddGroup={addGroup} onRemove={removeNode} actionOptions={ruleActionOptions} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-line p-3 shadow-sm sm:grid-cols-[max-content_max-content_minmax(0,1fr)] sm:items-center">
            <Button type="button" variant="lime" className="w-full sm:w-auto" onClick={() => addGroup(rule.id)}><Plus className="size-4" /> Add Group</Button>
            <Button type="button" variant="lime" className="w-full sm:w-auto" onClick={() => setPreviewOpen((open) => !open)}><CircleHelp className="size-4" /> Preview</Button>
            <Button type="button" variant="lime" className="w-full min-w-0" onClick={save} disabled={!selectedStep}><Save className="size-4" /> {selectedStep?.ruleJson ? 'Update' : 'Save'}</Button>
          </div>
          {previewOpen && <div className="mt-3 min-h-[280px] rounded-sm border border-line bg-[#f7f8fa] p-3 dark:bg-white/[0.03]"><pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.35]">{previewJson}</pre></div>}
          {!workflowSteps.length && <div className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-mist">Create an Approval Workflow and at least one Approval Step before configuring its automatic rule.</div>}
        </div>
        <aside className="min-w-0">
          <p className="mb-2 text-base font-semibold">Approval Steps List</p>
          <div className="min-h-[210px] rounded-2xl border border-[#e7e4df] bg-[#faf9f7] p-2.5 dark:border-white/10 dark:bg-white/[0.035]">
            {workflowSteps.map((step) => {
              const selected = step.id === stepId
              return (
                <button key={step.id} type="button" aria-pressed={selected} onClick={() => setStepId(step.id)} className={`mb-2 flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selected ? 'shadow-sm' : 'border-transparent bg-transparent hover:border-line hover:bg-white/70 dark:hover:bg-white/5'}`} style={selected ? { borderColor: 'var(--btn, #c8f542)', backgroundColor: 'color-mix(in srgb, var(--btn, #c8f542) 16%, transparent)' } : undefined}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium leading-5 text-ink dark:text-white">Level {step.level} · {step.stepName}</span>
                    <span className="mt-1.5 block text-sm leading-4 text-mist">{roleLabel(String(step.roleId), roles)}</span>
                  </span>
                  <Badge tone={step.ruleJson ? 'lime' : 'zinc'} className="mt-0.5 max-w-[88px] shrink-0 whitespace-normal px-3 py-1.5 text-center text-xs font-medium leading-4">{step.ruleJson ? 'RULE SET' : 'NO RULE'}</Badge>
                </button>
              )
            })}
            {!workflowSteps.length && <p className="p-3 text-sm text-mist">Select a workflow with configured approval steps.</p>}
          </div>
        </aside>
      </div>
    </section>
  )
}

function RuleGroupEditor({
  node, depth, activeGroupId, onSelectGroup, onUpdate, onAddCondition, onAddGroup, onRemove, actionOptions,
}: {
  node: ApprovalRuleNode
  depth: number
  activeGroupId: string
  onSelectGroup: (groupId: string) => void
  onUpdate: (nodeId: string, update: (node: ApprovalRuleNode) => ApprovalRuleNode) => void
  onAddCondition: (groupId: string) => void
  onAddGroup: (groupId: string) => void
  onRemove: (nodeId: string) => void
  actionOptions: Array<{ value: string; label: string }>
}) {
  if (node.kind === 'condition') {
    return (
      <div className="grid gap-2 rounded-lg border border-line bg-black/[0.02] p-2 dark:bg-white/[0.02] md:grid-cols-[1fr_.8fr_1.1fr_1.1fr_auto]">
        <Select value={node.field} onChange={(event) => {
          const field = event.target.value
          onUpdate(node.id, (current) => current.kind === 'condition' ? ({
            ...current,
            field,
            value: field === 'status' ? 'active' : current.field === 'status' ? '' : current.value,
            operator: field === 'status' ? '=' : current.operator,
          }) : current)
        }} aria-label="Condition field">
          {RULE_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
        </Select>
        <Select value={node.operator} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, operator: event.target.value }))} aria-label="Condition operator">
          {RULE_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.value}</option>)}
        </Select>
        {node.field === 'status' ? (
          <Select value={node.value} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, value: event.target.value }))} aria-label="Condition value">
            <option value="">Select Value</option>
            {['active', 'inactive', 'pending', 'approved', 'rejected'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </Select>
        ) : (
          <Input value={node.value} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, value: event.target.value }))} placeholder="Value" aria-label="Condition value" />
        )}
        <Select value={node.rule_action ?? ''} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, rule_action: event.target.value || null }))} aria-label="Rule action">
          <option value="">Select Action</option>
          {actionOptions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
        </Select>
        <Button type="button" size="icon" variant="danger" aria-label="Remove condition" onClick={() => onRemove(node.id)}><Trash2 className="size-4" /></Button>
      </div>
    )
  }
  const isActive = node.id === activeGroupId
  const groupClassName = depth === 0
    ? `rounded-md border p-3 transition-colors ${isActive ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-500/10' : 'border-line'}`
    : `ml-1 rounded-md p-2 transition-colors ${isActive ? 'bg-sky-50/70 ring-2 ring-sky-400/70 dark:bg-sky-500/10' : 'bg-black/[0.035] dark:bg-white/[0.035]'}`
  return (
    <div
      className={groupClassName}
      data-active-rule-group={isActive || undefined}
      onClick={(event) => { if (event.target === event.currentTarget) onSelectGroup(node.id) }}
      onFocusCapture={() => onSelectGroup(node.id)}
    >
      <div className="mb-2">
        <Select className={depth === 0 ? 'w-full' : 'w-[76px]'} value={node.join} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, join: event.target.value as ApprovalRuleGroup['join'] }))} aria-label="Condition group logic">
          <option value="AND">AND</option><option value="OR">OR</option>
        </Select>
      </div>
      <div className="space-y-2">
        {node.children.map((child) => <RuleGroupEditor key={child.id} node={child} depth={depth + 1} activeGroupId={activeGroupId} onSelectGroup={onSelectGroup} onUpdate={onUpdate} onAddCondition={onAddCondition} onAddGroup={onAddGroup} onRemove={onRemove} actionOptions={actionOptions} />)}
        {!node.children.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-mist">Add a condition or sub-group to define when this step applies.</p>}
      </div>
      {isActive && <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="lime" className="focus-visible:ring-2 focus-visible:ring-offset-2" onClick={() => onAddCondition(node.id)}><Plus className="size-3.5" /> Condition</Button>
        <Button type="button" size="sm" variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2" onClick={() => onAddGroup(node.id)}><Plus className="size-3.5" /> Sub Group</Button>
        <Button type="button" size="icon" variant="danger" className="focus-visible:ring-2 focus-visible:ring-offset-2" aria-label={depth === 0 ? 'Clear rule group' : 'Remove subgroup'} onClick={() => onRemove(node.id)}><Trash2 className="size-4" /></Button>
      </div>}
    </div>
  )
}

function findMissingRuleValue(node: ApprovalRuleNode): string | null {
  if (node.kind === 'condition') return node.value.trim() ? null : `${RULE_FIELDS.find((field) => field.value === node.field)?.label || node.field} has no value.`
  for (const child of node.children) {
    const missing = findMissingRuleValue(child)
    if (missing) return missing
  }
  return null
}

function ruleGroupToJson(group: ApprovalRuleGroup): ApprovalRuleJson {
  function convertCondition(node: ApprovalRuleCondition): ApprovalRuleJsonCondition {
    return { type: 'condition', field: node.field, operator: node.operator, value: node.value, rule_action: node.rule_action ?? null }
  }
  function convertGroup(node: ApprovalRuleGroup): ApprovalRuleJsonNode {
    return { type: 'group', logic: node.join, rules: convertRules(node) }
  }
  function convertRules(parent: ApprovalRuleGroup): ApprovalRuleJsonNode[] {
    return parent.children.flatMap((node) => {
      if (node.kind === 'condition') return [convertCondition(node)]
      // Groups with the same logic can be flattened without changing the rule's meaning.
      return node.join === parent.join ? convertRules(node) : [convertGroup(node)]
    })
  }
  return { ...(group.name ? { name: group.name } : {}), logic: group.join, rules: convertRules(group) }
}

function ruleJsonToGroup(ruleJson: ApprovalRuleJson | ApprovalRuleGroup | null): ApprovalRuleGroup {
  if (!ruleJson) return newApprovalRuleGroup()
  if ('children' in ruleJson) {
    const normalizeLegacy = (node: ApprovalRuleNode): ApprovalRuleNode => node.kind === 'group'
      ? { ...node, children: node.children.map(normalizeLegacy) }
      : { ...node, rule_action: node.rule_action ?? null }
    return normalizeLegacy(ruleJson) as ApprovalRuleGroup
  }
  const convertNode = (node: ApprovalRuleJsonNode): ApprovalRuleNode => node.type === 'group'
    ? { id: uid('rule'), kind: 'group', join: node.logic, children: node.rules.map(convertNode) }
    : { id: uid('condition'), kind: 'condition', field: node.field, operator: node.operator, value: node.value, rule_action: node.rule_action ?? null }
  return { id: uid('rule'), kind: 'group', join: ruleJson.logic, children: ruleJson.rules.map(convertNode), ...(ruleJson.name ? { name: ruleJson.name } : {}) }
}
