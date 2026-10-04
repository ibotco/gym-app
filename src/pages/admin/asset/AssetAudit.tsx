import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ClipboardCheck, ClipboardList, Boxes, CheckCircle2, XCircle, AlertTriangle, Clock,
  ShieldAlert, SquarePen, Trash2, Send, Play, Paperclip, FileX, Archive,
  ArrowLeftRight, Eye, Wrench, MapPin, UserRound, Ban, RotateCcw,
} from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, Field, Modal, Empty, SearchField } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { assetLocationPath, loadAssetLocations } from '../../../lib/assetLocations'
import {
  AUDIT_EVIDENCE_INLINE_LIMIT, CORRECTIVE_ACTIONS, DISCREPANCY_TYPES, PHYSICAL_STATUSES,
  SESSION_STATUSES, correctiveStatus, findDiscrepancies, loadAuditItems, loadAuditLog,
  loadAudits, nextAuditNumber, saveAuditItems, saveAuditLog, saveAudits, auditableAssets,
  physicalStatusLabel, sessionStatusLabel, discrepancyLabel,
  type AssetAudit as AuditSession, type AssetAuditItem, type AuditCorrectiveAction,
  type AuditEvidence, type AuditLogEntry, type AuditPhysicalStatus, type AuditSessionStatus,
  type DiscrepancyRow,
} from '../../../lib/assetAudit'

// ---- Page tabs ----
const AUDIT_TABS = [
  { id: 'audits', label: 'Audits' },
  { id: 'verification', label: 'Verification' },
  { id: 'discrepancies', label: 'Discrepancies' },
  { id: 'actions', label: 'Corrective Actions' },
  { id: 'reports', label: 'Reports' },
  { id: 'history', label: 'History' },
] as const
type AuditTab = (typeof AUDIT_TABS)[number]['id']

const REPORTS = [
  { id: 'summary', label: 'Asset Audit Summary' },
  { id: 'verification', label: 'Asset Verification Report' },
  { id: 'missing', label: 'Missing Assets Report' },
  { id: 'condition', label: 'Asset Condition Report' },
  { id: 'discrepancy', label: 'Audit Discrepancy Report' },
  { id: 'history', label: 'Audit History Report' },
] as const
type ReportId = (typeof REPORTS)[number]['id']

const physicalTone = (s: AuditPhysicalStatus): 'lime' | 'rose' | 'amber' | 'orange' | 'violet' | 'zinc' =>
  s === 'verified' ? 'lime'
    : s === 'missing' ? 'rose'
      : s === 'lost' ? 'rose'
        : s === 'damaged' ? 'orange'
          : s === 'obsolete' ? 'violet'
            : 'zinc'

const sessionTone = (s: AuditSessionStatus): 'lime' | 'sky' | 'amber' | 'rose' | 'zinc' =>
  s === 'approved' ? 'lime'
    : s === 'submitted' ? 'amber'
      : s === 'in_progress' ? 'sky'
        : s === 'rejected' ? 'rose'
          : 'zinc'

const discrepancyTone = (t: DiscrepancyRow['type']): 'rose' | 'amber' | 'violet' | 'sky' | 'orange' =>
  t === 'missing_asset' ? 'rose'
    : t === 'incorrect_location' ? 'amber'
      : t === 'incorrect_custodian' ? 'violet'
        : t === 'unregistered' ? 'sky'
          : 'orange'

const correctiveTone = (a: AuditCorrectiveAction): 'violet' | 'rose' | 'orange' =>
  a === 'transfer' ? 'violet' : a === 'dispose' ? 'orange' : 'rose'

const ACTION_ICONS: Record<AuditCorrectiveAction, typeof ArrowLeftRight> = {
  transfer: ArrowLeftRight,
  dispose: Archive,
  write_off: FileX,
}

/** Label for a corrective-action select value ('none' included). */
const correctiveLabelOf = (v: string): string =>
  v === 'none' ? 'None' : CORRECTIVE_ACTIONS.find((c) => c.id === v)?.label || v

const nowIso = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)
const norm = (s?: string) => (s || '').trim().toLowerCase()
const mismatch = (observed?: string, expected?: string) =>
  !!observed && !!expected && norm(observed) !== norm(expected)

/**
 * Manager-equivalent and verifier roles. DashboardLayout mirrors the enterprise
 * roles onto the same menus (company_admin / head_office / branch_admin follow
 * gym_manager, receptionist follows staff), so the page gates must accept the
 * same roles the navigation already exposes the page to.
 */
const MANAGER_ROLES = ['super_admin', 'gym_manager', 'company_admin', 'head_office', 'branch_admin'] as const
const VERIFIER_ROLES = [...MANAGER_ROLES, 'staff', 'receptionist'] as const

// ---- Verification card (one audited item, edited in place) ----
function VerifyRow({
  item, editable, lockedCorrective, conditions, selected, onToggleSelect, onSave, onRemove,
}: {
  item: AssetAuditItem
  editable: boolean
  /** Corrective actions cannot be launched until the audit is approved. */
  lockedCorrective: boolean
  conditions: string[]
  selected: boolean
  onToggleSelect: () => void
  onSave: (item: AssetAuditItem) => void
  onRemove?: () => void
}) {
  const [d, setD] = useState<AssetAuditItem>(item)
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-sync when the record changes underneath (save, another tab, reset).
  useEffect(() => { setD(item); setDirty(false) }, [item])

  const set = (patch: Partial<AssetAuditItem>) => { setD((p) => ({ ...p, ...patch })); setDirty(true) }

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const incoming: AuditEvidence[] = []
    let pending = files.length
    const finish = () => {
      pending -= 1
      if (pending === 0) set({ evidence: [...d.evidence, ...incoming] })
    }
    Array.from(files).forEach((f) => {
      if (f.size <= AUDIT_EVIDENCE_INLINE_LIMIT && f.type.startsWith('image/')) {
        const r = new FileReader()
        r.onload = () => { incoming.push({ name: f.name, type: f.type, size: f.size, dataUrl: typeof r.result === 'string' ? r.result : undefined }); finish() }
        r.onerror = () => { incoming.push({ name: f.name, type: f.type, size: f.size }); finish() }
        r.readAsDataURL(f)
      } else {
        incoming.push({ name: f.name, type: f.type || 'application/octet-stream', size: f.size })
        finish()
      }
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const locBad = editable && mismatch(d.observedLocation, d.expectedLocation)
  const custBad = editable && (d.expectedCustodian || '').trim() !== '' && norm(d.observedCustodian) !== norm(d.expectedCustodian)

  return (
    <tr className={`align-top ${dirty ? 'bg-orange-500/[0.06]' : ''}`}>
      {/* bulk-verification checkbox */}
      <td className="w-10 border-t border-line px-3 py-2.5">
        <input type="checkbox" checked={selected} onChange={onToggleSelect}
          aria-label={`Select ${item.assetTag}`} className="size-4 cursor-pointer accent-blue-600" />
      </td>
      {/* asset + register snapshot */}
      <td className="border-t border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">{item.assetTag}</span>
          {!item.assetId && <Badge tone="sky">Unregistered</Badge>}
          {item.duplicateOfItemId && <Badge tone="orange">Duplicate</Badge>}
          {(locBad || custBad) && <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-label="Observed value differs from the register" />}
        </div>
        <div className="mt-0.5 font-semibold leading-tight" title={`Created by ${item.createdBy} · ${formatDate(item.createdAt.slice(0, 10))} · Updated by ${item.modifiedBy} · ${formatDate(item.updatedAt.slice(0, 10))}`}>{item.assetName}</div>
        <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-mist">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {item.expectedLocation || '—'}</span>
          <span className="inline-flex items-center gap-1"><UserRound className="size-3" /> {item.expectedCustodian || '—'}</span>
          {item.verifiedBy && <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3" /> {item.verifiedBy} · {formatDate((item.verifiedAt || '').slice(0, 10))}</span>}
        </div>
      </td>
      {/* verification inputs — every control inline so the item stays one row */}
      <td className="border-t border-line px-3 py-2.5">
        <Select value={d.physicalStatus} disabled={!editable} onChange={(e) => set({ physicalStatus: e.target.value as AuditPhysicalStatus })}>
          {PHYSICAL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </td>
      <td className="border-t border-line px-3 py-2.5">
        <Select value={d.condition || ''} disabled={!editable} onChange={(e) => set({ condition: e.target.value || undefined })}>
          <option value="">Not recorded</option>
          {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </td>
      <td className="min-w-44 border-t border-line px-3 py-2.5">
        <textarea value={d.observedLocation || ''} disabled={!editable} onChange={(e) => set({ observedLocation: e.target.value })}
          className={`field ${locBad ? 'border-amber-500 focus:border-amber-500' : ''}`}
          title={locBad ? 'Differs from the register — reported as a discrepancy' : 'Where was it found?'} placeholder="Where was it found?" />
      </td>
      <td className="min-w-40 border-t border-line px-3 py-2.5">
        <textarea value={d.observedCustodian || ''} disabled={!editable} onChange={(e) => set({ observedCustodian: e.target.value })}
          className={`field ${custBad ? 'border-amber-500 focus:border-amber-500' : ''}`}
          title={custBad ? 'Differs from the register — reported as a discrepancy' : 'Who holds it?'} placeholder="Who holds it?" />
      </td>
      <td className="border-t border-line px-3 py-2.5" title={lockedCorrective ? 'Launches once the audit is approved' : undefined}>
        <Select value={d.correctiveAction || 'none'} disabled={!editable} onChange={(e) => set({ correctiveAction: e.target.value as AuditCorrectiveAction | 'none' })}>
          <option value="none">None required</option>
          {CORRECTIVE_ACTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </td>
      <td className="min-w-48 border-t border-line px-3 py-2.5">
        <textarea value={d.findings || ''} disabled={!editable} onChange={(e) => set({ findings: e.target.value })}
          className="field" placeholder="What the physical check found…" />
      </td>
      <td className="min-w-44 border-t border-line px-3 py-2.5">
        <textarea value={d.remarks || ''} disabled={!editable} onChange={(e) => set({ remarks: e.target.value })}
          className="field" placeholder="Auditor remarks…" />
      </td>
      {/* row actions */}
      <td className="border-t border-line px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {dirty && <span className="text-[11px] font-semibold text-orange-500">Unsaved</span>}
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button type="button" disabled={!editable} onClick={() => fileRef.current?.click()}
            title={d.evidence.length > 0 ? `${d.evidence.length} attached — ${d.evidence.map((ev) => ev.name).join(', ')}` : 'Attach evidence'}
            className="relative cursor-pointer rounded-md border border-line p-1.5 text-mist transition hover:bg-black/[0.04] hover:text-inherit disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-white/[0.06]">
            <Paperclip className="size-4" />
            {d.evidence.length > 0 && <span className="absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{d.evidence.length}</span>}
          </button>
          {editable && (
            <>
              <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" disabled={!dirty} onClick={() => { onSave(d) }}>
                <CheckCircle2 className="size-3.5" /> Save item
              </Button>
              {onRemove && (
                <button type="button" title="Remove from audit" onClick={onRemove} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ---- Session form state ----
type SessionForm = {
  id?: string
  number: string
  date: string
  periodFrom: string
  periodTo: string
  location: string
  department: string
  auditor: string
  scopeLocation: string
  category: string
  custodian: string
  group: string
  notes: string
}

type UnregForm = { assetTag: string; assetName: string; observedLocation: string; observedCustodian: string; physicalStatus: AuditPhysicalStatus; condition: string; findings: string; remarks: string }

export function AssetAudit() {
  const app = useApp()
  const { assets, assetTransactions, assetConditions, assetCategories, departments, users, journals, log } = app
  const { user, hasRole, hasPermission } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  // Built-in roles gate by role (mirroring the navigation); custom tenant
  // roles gate through the 'assets.audit' permission from the permission
  // matrix. Super admins pass hasPermission unconditionally.
  const auditGranted = hasPermission('assets.audit')
  const canManage = hasRole(...MANAGER_ROLES) || auditGranted
  const canVerify = hasRole(...VERIFIER_ROLES) || auditGranted

  const [audits, setAudits] = useState<AuditSession[]>(() => loadAudits())
  const [items, setItems] = useState<AssetAuditItem[]>(() => loadAuditItems())
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => loadAuditLog())
  useEffect(() => { saveAudits(audits) }, [audits])
  useEffect(() => { saveAuditItems(items) }, [items])
  useEffect(() => { saveAuditLog(logs) }, [logs])

  const [tab, setTab] = useState<AuditTab>('audits')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sessionForm, setSessionForm] = useState<SessionForm | null>(null)
  const [verifyAuditId, setVerifyAuditId] = useState<string | null>(null)
  /** Eye icon opens the workspace scoped to a single item; null = all items (bulk). */
  const [verifyOnlyItemId, setVerifyOnlyItemId] = useState<string | null>(null)
  /** Rows checked for bulk verification. */
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [deleting, setDeleting] = useState<AuditSession | null>(null)
  const [verifyQ, setVerifyQ] = useState('')
  const [verifyStatus, setVerifyStatus] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addQ, setAddQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [unregForm, setUnregForm] = useState<UnregForm | null>(null)
  const [discAudit, setDiscAudit] = useState('')
  const [discType, setDiscType] = useState('')
  const [reportId, setReportId] = useState<ReportId>('summary')
  const [reportAudit, setReportAudit] = useState('')
  const [historyAudit, setHistoryAudit] = useState('')

  const userName = user?.name || 'System'

  // ---- Canonical option lists ----
  const setupLocations = useMemo(() => loadAssetLocations(), [])
  const locationOptions = useMemo(() => {
    const fromAssets = assets.map((a) => a.location).filter(Boolean)
    const fromSetup = setupLocations.filter((l) => l.status === 'active').map((l) => assetLocationPath(l, setupLocations))
    return Array.from(new Set([...fromAssets, ...fromSetup])).sort((a, b) => a.localeCompare(b))
  }, [assets, setupLocations])
  const custodianOptions = useMemo(
    () => Array.from(new Set(assets.map((a) => a.assignedTo).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b)),
    [assets],
  )
  const auditOf = (id: string) => audits.find((a) => a.id === id)
  const itemsOf = (auditId: string) => items.filter((i) => i.auditId === auditId)
  const voucherNo = (journalId?: string) => journals.find((j) => j.id === journalId)?.number

  // ---- Derived data ----
  const discrepancies = useMemo(() => findDiscrepancies(items), [items])
  const correctiveItems = useMemo(() => items.filter((i) => i.correctiveAction && i.correctiveAction !== 'none'), [items])

  const stats = useMemo(() => ({
    total: audits.length,
    audited: items.filter((i) => i.assetId).length,
    verified: items.filter((i) => i.physicalStatus === 'verified').length,
    missing: items.filter((i) => i.physicalStatus === 'missing' || i.physicalStatus === 'lost').length,
    damaged: items.filter((i) => i.physicalStatus === 'damaged').length,
    reviews: audits.filter((a) => a.status === 'submitted').length,
    exceptions: discrepancies.length,
  }), [audits, items, discrepancies])

  // ---- Audit log helper (module history + global activity log) ----
  const pushLog = (action: AuditLogEntry['action'], target: string, details: string) => {
    setLogs((prev) => [...prev, { id: uid('al'), at: nowIso(), user: userName, action, target, details }])
    log(user?.id || 'system', action, 'AssetAudit', `${target} — ${details}`)
  }

  // ---- Item updates ----
  const updateItem = (id: string, patch: Partial<AssetAuditItem>, logAction?: AuditLogEntry['action'], details?: string) => {
    const target = items.find((x) => x.id === id)
    if (!target) return
    const next = items.map((x) => (x.id === id ? { ...x, ...patch, modifiedBy: userName, updatedAt: nowIso() } : x))
    setItems(next)
    if (logAction) pushLog(logAction, `${auditOf(target.auditId)?.number || 'Audit'} · ${target.assetTag}`, details || '')
  }

  const saveItemDraft = (draft: AssetAuditItem) => {
    const verifyPatch = draft.physicalStatus !== 'pending'
      ? { verifiedBy: userName, verifiedAt: nowIso() }
      : {}
    updateItem(draft.id, {
      physicalStatus: draft.physicalStatus, condition: draft.condition,
      observedLocation: draft.observedLocation, observedCustodian: draft.observedCustodian,
      findings: draft.findings, remarks: draft.remarks, evidence: draft.evidence,
      correctiveAction: draft.correctiveAction, ...verifyPatch,
    }, 'VERIFY', `Recorded ${physicalStatusLabel(draft.physicalStatus)}`)
    toast.success('Verification saved', draft.assetTag)
  }

  const checkedItems = items.filter((i) => selectedItemIds.includes(i.id))

  const toggleItemSelected = (id: string) =>
    setSelectedItemIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  // ---- Session lifecycle ----
  const blankSession = (): SessionForm => ({
    number: nextAuditNumber(audits), date: today(), periodFrom: today().slice(0, 8) + '01',
    periodTo: today(), location: '', department: departments[0]?.name || '', auditor: user?.name || '',
    scopeLocation: '', category: '', custodian: '', group: '', notes: '',
  })

  const scopeAssets = (f: SessionForm) => auditableAssets(assets).filter((a) =>
    (!f.scopeLocation || a.location === f.scopeLocation)
    && (!f.category || a.category === f.category)
    && (!f.custodian || (a.assignedTo || '') === f.custodian)
    && (!f.group || (a.assetType || 'asset') === f.group))

  const saveSession = () => {
    const f = sessionForm
    if (!f) return
    if (!f.date) { toast.error('Pick the audit date.'); return }
    if (!f.periodFrom || !f.periodTo) { toast.error('Pick the audit period.'); return }
    if (!f.location.trim()) { toast.error('Enter the audit location.'); return }
    if (!f.auditor.trim()) { toast.error('Pick the auditor.'); return }
    if (f.periodTo < f.periodFrom) { toast.error('The audit period must end after it starts.'); return }
    const isNew = !f.id
    const meta = {
      number: f.number, date: f.date, periodFrom: f.periodFrom, periodTo: f.periodTo,
      location: f.location.trim(), department: f.department.trim(), auditor: f.auditor.trim(),
      notes: f.notes.trim() || undefined, modifiedBy: userName, updatedAt: nowIso(),
    }
    if (isNew) {
      const audit: AuditSession = {
        id: uid('aud'), companyId: undefined, branchId: undefined, ...meta,
        status: 'draft', createdBy: userName, createdAt: nowIso(),
      }
      const created = nowIso()
      const newItems: AssetAuditItem[] = scopeAssets(f).map((a) => ({
        id: uid('ai'), auditId: audit.id, assetId: a.id, assetTag: a.tag, assetName: a.name,
        expectedLocation: a.location, expectedCustodian: a.assignedTo || '',
        physicalStatus: 'pending' as AuditPhysicalStatus, evidence: [],
        createdBy: userName, modifiedBy: userName, createdAt: created, updatedAt: created,
      }))
      setAudits((p) => [...p, audit])
      if (newItems.length > 0) setItems((p) => [...p, ...newItems])
      pushLog('CREATE', audit.number, `Audit session created — ${newItems.length} asset${newItems.length === 1 ? '' : 's'} in scope`)
      toast.success('Audit created', `${audit.number} · ${newItems.length} assets in scope`)
    } else {
      setAudits((p) => p.map((a) => (a.id === f.id ? { ...a, ...meta } : a)))
      pushLog('UPDATE', f.number, 'Audit details updated')
      toast.success('Audit updated', f.number)
    }
    setSessionForm(null)
  }

  const setSessionStatus = (a: AuditSession, status: AuditSessionStatus, action: AuditLogEntry['action'], details: string, patch: Partial<AuditSession> = {}) => {
    setAudits((p) => p.map((x) => (x.id === a.id ? { ...x, status, ...patch, modifiedBy: userName, updatedAt: nowIso() } : x)))
    pushLog(action, a.number, details)
  }

  const deleteAudit = () => {
    if (!deleting) return
    setAudits((p) => p.filter((a) => a.id !== deleting.id))
    setItems((p) => p.filter((i) => i.auditId !== deleting.id))
    pushLog('DELETE', deleting.number, 'Audit session and its verification items deleted')
    toast.success('Audit deleted', deleting.number)
    setDeleting(null)
  }

  // ---- Verification workspace helpers ----
  const verifyAudit = verifyAuditId ? auditOf(verifyAuditId) : null
  const verifyItems = useMemo(() => {
    const ql = verifyQ.trim().toLowerCase()
    return itemsOf(verifyAuditId || '')
      .filter((i) => {
        if (verifyOnlyItemId && i.id !== verifyOnlyItemId) return false
        if (verifyStatus && i.physicalStatus !== verifyStatus) return false
        if (ql && !`${i.assetTag} ${i.assetName} ${i.findings || ''} ${i.observedLocation || ''}`.toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => a.assetTag.localeCompare(b.assetTag))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, verifyAuditId, verifyOnlyItemId, verifyQ, verifyStatus])
  // Verification stays editable through the whole review workflow (draft,
  // in progress, submitted, even rejected) — only an APPROVED audit is final.
  // Managers can reopen an approved audit from the Audits tab.
  const verifyEditable = !!verifyAudit && canVerify && verifyAudit.status !== 'approved'

  const startVerify = (a: AuditSession) => {
    if (a.status === 'draft' && canVerify) {
      setSessionStatus(a, 'in_progress', 'START', 'Physical verification started')
    }
    setVerifyOnlyItemId(null) // bulk entry point — the whole audit scope
    setSelectedItemIds([])
    setVerifyAuditId(a.id)
  }

  const alreadyInAudit = (assetId: string) => itemsOf(verifyAuditId || '').some((i) => i.assetId === assetId && !i.duplicateOfItemId)
  const pickerAssets = useMemo(() => {
    const ql = addQ.trim().toLowerCase()
    return auditableAssets(assets)
      .filter((a) => !alreadyInAudit(a.id))
      .filter((a) => !ql || `${a.tag} ${a.name} ${a.category} ${a.location}`.toLowerCase().includes(ql))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, items, verifyAuditId, addQ])

  const addPickedAssets = () => {
    if (!verifyAuditId || picked.length === 0) return
    const created = nowIso()
    const newItems: AssetAuditItem[] = picked
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({
        id: uid('ai'), auditId: verifyAuditId, assetId: a.id, assetTag: a.tag, assetName: a.name,
        expectedLocation: a.location, expectedCustodian: a.assignedTo || '',
        physicalStatus: 'pending' as AuditPhysicalStatus, evidence: [],
        createdBy: userName, modifiedBy: userName, createdAt: created, updatedAt: created,
      }))
    setItems((p) => [...p, ...newItems])
    pushLog('UPDATE', auditOf(verifyAuditId)?.number || 'Audit', `Added ${newItems.length} asset${newItems.length === 1 ? '' : 's'} to the audit scope`)
    toast.success('Assets added to audit', `${newItems.length} item${newItems.length === 1 ? '' : 's'}`)
    setPicked([])
    setAddOpen(false)
  }

  const addUnregistered = () => {
    const f = unregForm
    if (!verifyAuditId || !f) return
    if (!f.assetName.trim()) { toast.error('Describe the asset found.'); return }
    const tag = f.assetTag.trim() || `UNREG-${String(items.filter((i) => !i.assetId).length + 1).padStart(3, '0')}`
    const created = nowIso()
    const rec: AssetAuditItem = {
      id: uid('ai'), auditId: verifyAuditId, assetTag: tag, assetName: f.assetName.trim(),
      observedLocation: f.observedLocation, observedCustodian: f.observedCustodian,
      physicalStatus: f.physicalStatus, condition: f.condition || undefined,
      findings: f.findings.trim() || 'Found on site but not present in the asset register.',
      remarks: f.remarks.trim() || undefined, evidence: [],
      verifiedBy: f.physicalStatus !== 'pending' ? userName : undefined,
      verifiedAt: f.physicalStatus !== 'pending' ? created : undefined,
      createdBy: userName, modifiedBy: userName, createdAt: created, updatedAt: created,
    }
    setItems((p) => [...p, rec])
    pushLog('CREATE', `${auditOf(verifyAuditId)?.number || 'Audit'} · ${tag}`, `Unregistered asset recorded — ${rec.assetName}`)
    toast.success('Unregistered asset recorded', tag)
    setUnregForm(null)
  }

  const removeItem = (it: AssetAuditItem) => {
    if (!window.confirm(`Remove ${it.assetTag} — ${it.assetName} from this audit?`)) return
    setItems((p) => p.filter((x) => x.id !== it.id))
    pushLog('DELETE', `${auditOf(it.auditId)?.number || 'Audit'} · ${it.assetTag}`, 'Item removed from the audit scope')
  }

  // ---- Corrective actions ----
  const launchCorrective = (it: AssetAuditItem) => {
    const audit = auditOf(it.auditId)
    const action = it.correctiveAction
    if (!audit || !action || action === 'none') return
    if (audit.status !== 'approved') { toast.error('Approval required', `Approve ${audit.number} before initiating corrective actions.`); return }
    if (!it.assetId) { toast.error('Asset not registered', 'Register the asset in the Asset register first — ledger transactions need a register asset.'); return }
    updateItem(it.id, { correctiveInitiatedAt: nowIso() }, 'CORRECT', `Initiated ${CORRECTIVE_ACTIONS.find((c) => c.id === action)?.label || action}`)
    const note = `Audit ${audit.number} — ${(it.findings || it.assetName).slice(0, 120)}`
    navigate(`/admin/assets/transactions?new=${action}&asset=${encodeURIComponent(it.assetId)}&note=${encodeURIComponent(note)}`)
  }

  // ---- Audits tab rows ----
  const auditRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...audits]
      .filter((a) => {
        if (statusFilter && a.status !== statusFilter) return false
        if (ql && !`${a.number} ${a.location} ${a.department} ${a.auditor} ${a.notes || ''}`.toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [audits, q, statusFilter])

  // ---- Verification tab rows (all items across audits) ----
  const verificationRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items
      .filter((i) => {
        if (statusFilter && i.physicalStatus !== statusFilter) return false
        const audit = auditOf(i.auditId)
        if (ql && !`${i.assetTag} ${i.assetName} ${audit?.number || ''} ${i.observedLocation || ''} ${i.findings || ''}`.toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => (auditOf(b.auditId)?.date || '').localeCompare(auditOf(a.auditId)?.date || '') || a.assetTag.localeCompare(b.assetTag))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, audits, q, statusFilter])

  // Checkboxes appear both in the Verification list and the workspace; checking
  // rows reveals the Bulk verification button, which opens the bulk modal.
  const bulkVerifyBar = selectedItemIds.length > 0 && (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
      <span>{selectedItemIds.length} item{selectedItemIds.length === 1 ? '' : 's'} checked for bulk verification</span>
      <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setBulkOpen(true)}>
        <ClipboardCheck className="size-3.5" /> Bulk verification
      </Button>
      <button type="button" onClick={() => setSelectedItemIds([])} className="cursor-pointer underline-offset-2 hover:underline">Clear</button>
    </div>
  )

  // ---- Discrepancy tab rows ----
  const discrepancyRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return discrepancies
      .filter((d) => {
        if (discAudit && d.auditId !== discAudit) return false
        if (discType && d.type !== discType) return false
        if (ql && !`${d.assetLabel} ${auditOf(d.auditId)?.number || ''} ${d.expected} ${d.observed} ${d.item.findings || ''}`.toLowerCase().includes(ql)) return false
        return true
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discrepancies, audits, discAudit, discType, q])

  // ---- Reports ----
  const reportScopedItems = useMemo(
    () => (reportAudit ? items.filter((i) => i.auditId === reportAudit) : items),
    [items, reportAudit],
  )
  const reportScopedAudits = useMemo(
    () => (reportAudit ? audits.filter((a) => a.id === reportAudit) : audits),
    [audits, reportAudit],
  )

  const reportData = useMemo(() => {
    switch (reportId) {
      case 'summary':
        return reportScopedAudits.map((a) => {
          const its = itemsOf(a.id)
          const count = (s: AuditPhysicalStatus) => its.filter((i) => i.physicalStatus === s).length
          const done = its.filter((i) => i.physicalStatus !== 'pending').length
          return {
            audit: a.number, date: a.date, period: `${a.periodFrom} → ${a.periodTo}`, location: a.location,
            department: a.department, auditor: a.auditor, total: its.length, verified: count('verified'),
            missing: count('missing') + count('lost'), damaged: count('damaged'), obsolete: count('obsolete'),
            progress: its.length ? `${Math.round((done / its.length) * 100)}%` : '—',
            status: sessionStatusLabel(a.status),
          }
        })
      case 'verification':
        return reportScopedItems.map((i) => ({
          audit: auditOf(i.auditId)?.number || '', assetId: i.assetTag, asset: i.assetName,
          custodian: i.expectedCustodian || '', observedCustodian: i.observedCustodian || '',
          status: physicalStatusLabel(i.physicalStatus), condition: i.condition || '',
          verifiedBy: i.verifiedBy || '', verifiedAt: i.verifiedAt ? formatDate(i.verifiedAt.slice(0, 10)) : '',
        }))
      case 'missing':
        return reportScopedItems
          .filter((i) => i.physicalStatus === 'missing' || i.physicalStatus === 'lost')
          .map((i) => ({
            audit: auditOf(i.auditId)?.number || '', assetId: i.assetTag, asset: i.assetName,
            status: physicalStatusLabel(i.physicalStatus), lastLocation: i.expectedLocation || '',
            custodian: i.expectedCustodian || '', findings: i.findings || '',
            corrective: CORRECTIVE_ACTIONS.find((c) => c.id === i.correctiveAction)?.label || 'None',
          }))
      case 'condition':
        return reportScopedItems
          .filter((i) => i.condition)
          .map((i) => ({
            audit: auditOf(i.auditId)?.number || '', assetId: i.assetTag, asset: i.assetName,
            registerCondition: assets.find((a) => a.id === i.assetId)?.condition || '',
            auditedCondition: i.condition || '', status: physicalStatusLabel(i.physicalStatus),
            remarks: i.remarks || '',
          }))
      case 'discrepancy':
        return (reportAudit ? discrepancies.filter((d) => d.auditId === reportAudit) : discrepancies).map((d) => ({
          audit: auditOf(d.auditId)?.number || '', type: discrepancyLabel(d.type), asset: d.assetLabel,
          expected: d.expected, observed: d.observed, status: physicalStatusLabel(d.item.physicalStatus),
          findings: d.item.findings || '',
        }))
      case 'history': {
        const number = reportAudit ? auditOf(reportAudit)?.number : ''
        return [...logs]
          .filter((l) => !number || l.target.includes(number))
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((l) => ({ date: formatDate(l.at.slice(0, 10)), time: l.at.slice(11, 16), user: l.user, action: l.action, target: l.target, details: l.details }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, reportScopedAudits, reportScopedItems, discrepancies, logs, audits, assets])

  const historyRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const number = historyAudit ? auditOf(historyAudit)?.number : ''
    return [...logs]
      .filter((l) => (!number || l.target.includes(number)) && (!ql || `${l.user} ${l.action} ${l.target} ${l.details}`.toLowerCase().includes(ql)))
      .sort((a, b) => b.at.localeCompare(a.at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, audits, historyAudit, q])

  const WIDGETS: { label: string; value: number; icon: typeof Boxes; tint: string }[] = [
    { label: 'Total Audits', value: stats.total, icon: ClipboardList, tint: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
    { label: 'Assets Audited', value: stats.audited, icon: Boxes, tint: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
    { label: 'Verified Assets', value: stats.verified, icon: CheckCircle2, tint: 'bg-lime-500/15 text-lime-700 dark:text-lime-400' },
    { label: 'Missing Assets', value: stats.missing, icon: ShieldAlert, tint: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
    { label: 'Damaged Assets', value: stats.damaged, icon: Wrench, tint: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
    { label: 'Pending Reviews', value: stats.reviews, icon: Clock, tint: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    { label: 'Audit Exceptions', value: stats.exceptions, icon: AlertTriangle, tint: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  ]

  const sessionActions = (a: AuditSession) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title={a.status === 'approved' ? 'View verification' : 'Physical verification'} onClick={() => startVerify(a)} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><ClipboardCheck className="size-4" /></button>
      {canManage && (a.status === 'draft' || a.status === 'in_progress') && (
        <button type="button" title="Edit audit" onClick={() => setSessionForm({ id: a.id, number: a.number, date: a.date, periodFrom: a.periodFrom, periodTo: a.periodTo, location: a.location, department: a.department, auditor: a.auditor, scopeLocation: '', category: '', custodian: '', group: '', notes: a.notes || '' })} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>
      )}
      {canVerify && a.status === 'in_progress' && (
        <button type="button" title="Submit for review" onClick={() => { setSessionStatus(a, 'submitted', 'SUBMIT', 'Submitted for review'); toast.success('Submitted for review', a.number) }} className="cursor-pointer rounded-md p-1.5 text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"><Send className="size-4" /></button>
      )}
      {canManage && a.status === 'submitted' && (
        <>
          <button type="button" title="Approve audit" onClick={() => { setSessionStatus(a, 'approved', 'APPROVE', 'Audit approved', { approvedBy: userName, approvedAt: nowIso() }); toast.success('Audit approved', a.number) }} className="cursor-pointer rounded-md p-1.5 text-lime-600 transition hover:bg-lime-500/10 dark:text-lime-400"><CheckCircle2 className="size-4" /></button>
          <button type="button" title="Reject audit" onClick={() => { setSessionStatus(a, 'rejected', 'REJECT', 'Audit rejected — returned for correction'); toast.error('Audit rejected', a.number) }} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><XCircle className="size-4" /></button>
        </>
      )}
      {canManage && a.status === 'approved' && (
        <button type="button" title="Reopen for re-verification" onClick={() => { setSessionStatus(a, 'in_progress', 'START', 'Audit reopened for re-verification'); toast.success('Audit reopened', `${a.number} — verification unlocked`) }} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><RotateCcw className="size-4" /></button>
      )}
      {canVerify && (a.status === 'draft' || a.status === 'rejected') && (
        <button type="button" title={a.status === 'rejected' ? 'Reopen audit' : 'Start verification'} onClick={() => { setSessionStatus(a, 'in_progress', 'START', a.status === 'rejected' ? 'Audit reopened after rejection' : 'Physical verification started'); toast.success('Audit in progress', a.number) }} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><Play className="size-4" /></button>
      )}
      {canManage && (
        <button type="button" title="Delete audit" onClick={() => setDeleting(a)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>
      )}
    </div>
  )

  const scopeCount = sessionForm ? scopeAssets(sessionForm).length : 0

  return (
    <div>
      <PageHeader
        title="Asset Audit"
        desc="Physically verify assets, compare results with the asset register, resolve discrepancies and turn approved findings into transfers, disposals or write-offs."
        actions={canManage ? (
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setSessionForm(blankSession()) }}>
            <Plus className="size-4" /> New audit
          </Button>
        ) : undefined}
      />

      {/* ---- Dashboard widgets ---- */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {WIDGETS.map((w) => (
          <div key={w.label} className="card flex items-center gap-3 px-4 py-3">
            <span className={`grid size-9 flex-shrink-0 place-items-center rounded-lg ${w.tint}`}><w.icon className="size-4" /></span>
            <span className="min-w-0">
              <span className="stat-num block text-xl leading-tight">{w.value}</span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-mist">{w.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* ---- Tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {AUDIT_TABS.map((t) => {
          const count = t.id === 'audits' ? audits.length
            : t.id === 'verification' ? items.length
              : t.id === 'discrepancies' ? discrepancies.length
                : t.id === 'actions' ? correctiveItems.length
                  : t.id === 'reports' ? REPORTS.length
                    : logs.length
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setQ(''); setStatusFilter('') }}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition ${tab === t.id ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#2c4a77] hover:bg-[#243d63]'}`}
            >
              {t.label} <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>
            </button>
          )
        })}
      </div>

      {/* shared datalists */}
      <datalist id="aa-locations">
        {locationOptions.map((l) => <option key={l} value={l} />)}
      </datalist>
      <datalist id="aa-custodians">
        {custodianOptions.map((c) => <option key={c} value={c} />)}
      </datalist>

      {/* ================= AUDITS ================= */}
      {tab === 'audits' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Search audit no, location, department, auditor…" className="w-full max-w-sm" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
              <option value="">All statuses</option>
              {SESSION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr><th>Audit No</th><th>Audit Date</th><th>Audit Period</th><th>Location</th><th>Department</th><th>Auditor</th><th>Progress</th><th>Approval Status</th><th className="text-right">ACTIONS</th></tr>
              </thead>
              <tbody>
                {auditRows.length === 0 && (
                  <tr><td colSpan={9}><Empty title="No audits" desc="Create an audit session to start physical verification." /></td></tr>
                )}
                {auditRows.map((a) => {
                  const its = itemsOf(a.id)
                  const done = its.filter((i) => i.physicalStatus !== 'pending').length
                  const pct = its.length ? Math.round((done / its.length) * 100) : 0
                  return (
                    <tr key={a.id}>
                      <td className="font-semibold">{a.number}</td>
                      <td className="text-mist">{formatDate(a.date)}</td>
                      <td className="text-mist">{formatDate(a.periodFrom)} → {formatDate(a.periodTo)}</td>
                      <td>{a.location}</td>
                      <td>{a.department || '—'}</td>
                      <td>{a.auditor}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10">
                            <span className="block h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-xs text-mist">{done}/{its.length}</span>
                        </div>
                      </td>
                      <td><Badge tone={sessionTone(a.status)}>{sessionStatusLabel(a.status)}</Badge></td>
                      <td>{sessionActions(a)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= VERIFICATION (all items) ================= */}
      {tab === 'verification' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Search asset, tag, findings…" className="w-full max-w-sm" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
              <option value="">All statuses</option>
              {PHYSICAL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          {bulkVerifyBar}
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" aria-label="Select all items" disabled={verificationRows.length === 0}
                      checked={verificationRows.length > 0 && verificationRows.every((i) => selectedItemIds.includes(i.id))}
                      onChange={() => setSelectedItemIds(verificationRows.every((i) => selectedItemIds.includes(i.id)) ? [] : verificationRows.map((i) => i.id))}
                      className="size-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" />
                  </th>
                  <th>Asset ID</th><th>Asset Description</th><th>Audit</th><th>Register Location</th><th>Observed Location</th><th>Custodian</th><th>Physical Status</th><th>Condition</th><th>Evidence</th><th className="text-right">ACTIONS</th></tr>
              </thead>
              <tbody>
                {verificationRows.length === 0 && (
                  <tr><td colSpan={11}><Empty title="Nothing to verify yet" desc="Open an audit and record physical verification results." /></td></tr>
                )}
                {verificationRows.map((i) => {
                  const audit = auditOf(i.auditId)
                  return (
                    <tr key={i.id}>
                      <td>
                        <input type="checkbox" checked={selectedItemIds.includes(i.id)} onChange={() => toggleItemSelected(i.id)}
                          aria-label={`Select ${i.assetTag} (${audit?.number || '—'})`} className="size-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" />
                      </td>
                      <td className="font-semibold">{i.assetTag}</td>
                      <td>
                        <span className="font-semibold">{i.assetName}</span>
                        {!i.assetId && <Badge tone="sky" className="ml-2">Unregistered</Badge>}
                        {i.duplicateOfItemId && <Badge tone="orange" className="ml-2">Duplicate</Badge>}
                      </td>
                      <td className="text-mist">{audit?.number || '—'}</td>
                      <td className="text-mist">{i.expectedLocation || '—'}</td>
                      <td className={mismatch(i.observedLocation, i.expectedLocation) ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-mist'}>{i.observedLocation || '—'}</td>
                      <td className={mismatch(i.observedCustodian, i.expectedCustodian) && !!(i.expectedCustodian || '').trim() ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-mist'}>{i.observedCustodian || i.expectedCustodian || '—'}</td>
                      <td><Badge tone={physicalTone(i.physicalStatus)}>{physicalStatusLabel(i.physicalStatus)}</Badge></td>
                      <td className="text-mist">{i.condition || '—'}</td>
                      <td className="text-mist">{i.evidence.length > 0 ? <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" /> {i.evidence.length}</span> : '—'}</td>
                      <td>
                        <div className="flex justify-end">
                          <button type="button" title="Open verification workspace" onClick={() => { setVerifyOnlyItemId(i.id); setSelectedItemIds([]); setVerifyAuditId(i.auditId) }} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><Eye className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= DISCREPANCIES ================= */}
      {tab === 'discrepancies' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Search asset, audit, finding…" className="w-full max-w-sm" />
            <Select value={discAudit} onChange={(e) => setDiscAudit(e.target.value)} className="w-auto">
              <option value="">All audits</option>
              {audits.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}
            </Select>
            <Select value={discType} onChange={(e) => setDiscType(e.target.value)} className="w-auto">
              <option value="">All discrepancy types</option>
              {DISCREPANCY_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr><th>Discrepancy</th><th>Audit</th><th>Asset</th><th>Expected (register)</th><th>Observed (physical)</th><th>Physical Status</th><th>Findings</th><th>Corrective Action</th><th className="text-right">ACTIONS</th></tr>
              </thead>
              <tbody>
                {discrepancyRows.length === 0 && (
                  <tr><td colSpan={9}><Empty title="No discrepancies" desc="Verification results match the asset register for the current filters." /></td></tr>
                )}
                {discrepancyRows.map((d) => {
                  const audit = auditOf(d.auditId)
                  const approved = audit?.status === 'approved'
                  const action = d.item.correctiveAction && d.item.correctiveAction !== 'none' ? d.item.correctiveAction : null
                  const Ico = action ? ACTION_ICONS[action] : null
                  return (
                    <tr key={d.id}>
                      <td><Badge tone={discrepancyTone(d.type)}>{discrepancyLabel(d.type)}</Badge></td>
                      <td className="text-mist">{audit?.number || '—'}</td>
                      <td className="font-semibold">{d.assetLabel}</td>
                      <td className="text-mist">{d.expected}</td>
                      <td className="font-semibold text-amber-600 dark:text-amber-400">{d.observed}</td>
                      <td><Badge tone={physicalTone(d.item.physicalStatus)}>{physicalStatusLabel(d.item.physicalStatus)}</Badge></td>
                      <td className="max-w-60 truncate text-mist" title={d.item.findings || ''}>{d.item.findings || '—'}</td>
                      <td>
                        <Select
                          value={d.item.correctiveAction || 'none'}
                          disabled={!canManage}
                          className="w-auto min-w-36"
                          onChange={(e) => updateItem(d.item.id, { correctiveAction: e.target.value as AuditCorrectiveAction | 'none' }, 'CORRECT', `Corrective action set to ${correctiveLabelOf(e.target.value)}`)}
                        >
                          <option value="none">None required</option>
                          {CORRECTIVE_ACTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                      </td>
                      <td>
                        <div className="flex justify-end">
                          {action && Ico && (
                            <button
                              type="button"
                              title={approved ? `Create ${correctiveLabelOf(action)}` : 'Approve the audit first'}
                              onClick={() => launchCorrective(d.item)}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-white transition ${approved ? 'bg-[#2c4a77] hover:bg-[#243d63]' : 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'}`}
                            >
                              <Ico className="size-3.5" />
                              Initiate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= CORRECTIVE ACTIONS ================= */}
      {tab === 'actions' && (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th>Asset</th><th>Action</th><th>Source Audit</th><th>Approval</th><th>Physical Status</th><th>Progress</th><th className="text-right">ACTIONS</th></tr>
            </thead>
            <tbody>
              {correctiveItems.length === 0 && (
                <tr><td colSpan={7}><Empty title="No corrective actions" desc="Set a corrective action on a finding to queue a transfer, disposal or write-off here." /></td></tr>
              )}
              {[...correctiveItems].sort((a, b) => (auditOf(b.auditId)?.date || '').localeCompare(auditOf(a.auditId)?.date || '')).map((i) => {
                const audit = auditOf(i.auditId)
                const action = i.correctiveAction as AuditCorrectiveAction
                const st = correctiveStatus(i, assetTransactions)
                const approved = audit?.status === 'approved'
                const Ico = ACTION_ICONS[action]
                return (
                  <tr key={i.id}>
                    <td>
                      <p className="font-semibold">{i.assetTag} — {i.assetName}</p>
                      {!i.assetId && <Badge tone="sky" className="mt-1">Unregistered — register before posting</Badge>}
                    </td>
                    <td><Badge tone={correctiveTone(action)}><Ico className="mr-1 inline size-3" />{CORRECTIVE_ACTIONS.find((c) => c.id === action)?.label}</Badge></td>
                    <td className="text-mist">{audit?.number || '—'}</td>
                    <td>{audit ? <Badge tone={sessionTone(audit.status)}>{sessionStatusLabel(audit.status)}</Badge> : '—'}</td>
                    <td><Badge tone={physicalTone(i.physicalStatus)}>{physicalStatusLabel(i.physicalStatus)}</Badge></td>
                    <td>
                      {st.state === 'done' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
                          <CheckCircle2 className="size-3.5" /> Posted {st.tx ? formatDate(st.tx.date) : ''}{st.tx?.journalId ? ` · ${voucherNo(st.tx.journalId) || ''}` : ''}
                        </span>
                      ) : st.state === 'initiated' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400"><Clock className="size-3.5" /> Initiated — awaiting entry in Asset transactions</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-mist"><Ban className="size-3.5" /> Not started</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {st.state !== 'done' && (
                          <button
                            type="button"
                            disabled={!approved}
                            title={approved ? `Create ${CORRECTIVE_ACTIONS.find((c) => c.id === action)?.label}` : 'Approve the audit first'}
                            onClick={() => launchCorrective(i)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white transition ${approved ? 'cursor-pointer bg-[#2c4a77] hover:bg-[#243d63]' : 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'}`}
                          >
                            <Ico className="size-3.5" /> Create {CORRECTIVE_ACTIONS.find((c) => c.id === action)?.label.replace('Asset ', '')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= REPORTS ================= */}
      {tab === 'reports' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={reportId} onChange={(e) => setReportId(e.target.value as ReportId)} className="w-auto min-w-56">
              {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </Select>
            <Select value={reportAudit} onChange={(e) => setReportAudit(e.target.value)} className="w-auto">
              <option value="">All audits</option>
              {audits.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}
            </Select>
            <ExportButtons
              className="ml-auto"
              filename={`asset-audit-${reportId}`}
              rows={(reportData as Record<string, unknown>[]).map((r) => ({ ...r }))}
              onDone={(label, ok) => (ok ? toast.success(`${label} export started`) : toast.error('Export blocked'))}
            />
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>{reportData.length > 0 ? Object.keys(reportData[0]).map((k) => <th key={k} className="uppercase">{k.replace(/([A-Z])/g, ' $1')}</th>) : <th>No data</th>}</tr>
              </thead>
              <tbody>
                {reportData.length === 0 && <tr><td colSpan={8}><Empty title="Nothing to report" desc="No rows match the selected report and audit." /></td></tr>}
                {(reportData as Record<string, unknown>[]).map((r, idx) => (
                  <tr key={idx}>
                    {Object.values(r).map((v, j) => <td key={j} className={j === 0 ? 'font-semibold' : 'text-mist'}>{String(v ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-mist">Exports include Excel, CSV and print / PDF — the reconciliation pack for {REPORTS.find((r) => r.id === reportId)?.label}.</p>
        </>
      )}

      {/* ================= HISTORY ================= */}
      {tab === 'history' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Search user, action, details…" className="w-full max-w-sm" />
            <Select value={historyAudit} onChange={(e) => setHistoryAudit(e.target.value)} className="w-auto">
              <option value="">All audits</option>
              {audits.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}
            </Select>
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr><th>Date</th><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Details</th></tr>
              </thead>
              <tbody>
                {historyRows.length === 0 && <tr><td colSpan={6}><Empty title="No audit history" desc="Actions performed on audits will appear here." /></td></tr>}
                {historyRows.map((l) => (
                  <tr key={l.id}>
                    <td className="text-mist">{formatDate(l.at.slice(0, 10))}</td>
                    <td className="text-mist">{l.at.slice(11, 16)}</td>
                    <td className="font-semibold">{l.user}</td>
                    <td><Badge tone={l.action === 'APPROVE' ? 'lime' : l.action === 'REJECT' || l.action === 'DELETE' ? 'rose' : l.action === 'SUBMIT' ? 'amber' : 'sky'}>{l.action}</Badge></td>
                    <td>{l.target}</td>
                    <td className="text-mist">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= New / edit audit session ================= */}
      <Modal open={!!sessionForm} onClose={() => setSessionForm(null)} title={sessionForm?.id ? `Edit audit ${sessionForm.number}` : 'New audit session'} wide>
        {sessionForm && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Audit Number" required>
                <Input value={sessionForm.number} readOnly className="opacity-70" />
              </Field>
              <Field label="Audit Date" required>
                <Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} />
              </Field>
              <Field label="Audit Period From" required>
                <Input type="date" value={sessionForm.periodFrom} onChange={(e) => setSessionForm({ ...sessionForm, periodFrom: e.target.value })} />
              </Field>
              <Field label="Audit Period To" required>
                <Input type="date" value={sessionForm.periodTo} onChange={(e) => setSessionForm({ ...sessionForm, periodTo: e.target.value })} />
              </Field>
              <Field label="Location" required>
                <Input list="aa-locations" value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} placeholder="Primary audit site" />
              </Field>
              <Field label="Department">
                <Input list="aa-departments" value={sessionForm.department} onChange={(e) => setSessionForm({ ...sessionForm, department: e.target.value })} placeholder="Owning department" />
              </Field>
              <Field label="Auditor" required>
                <Select value={sessionForm.auditor} onChange={(e) => setSessionForm({ ...sessionForm, auditor: e.target.value })}>
                  <option value="">Select auditor…</option>
                  {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                  {sessionForm.auditor && !users.some((u) => u.name === sessionForm.auditor) && <option value={sessionForm.auditor}>{sessionForm.auditor}</option>}
                </Select>
              </Field>
              <Field label="Notes">
                <Input value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} placeholder="Purpose, instructions…" />
              </Field>
            </div>

            {!sessionForm.id && (
              <div className="mt-5 rounded-xl border border-line p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-mist">Select assets for audit</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Location">
                    <Select value={sessionForm.scopeLocation} onChange={(e) => setSessionForm({ ...sessionForm, scopeLocation: e.target.value })}>
                      <option value="">All locations</option>
                      {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Select value={sessionForm.category} onChange={(e) => setSessionForm({ ...sessionForm, category: e.target.value })}>
                      <option value="">All categories</option>
                      {assetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Custodian">
                    <Select value={sessionForm.custodian} onChange={(e) => setSessionForm({ ...sessionForm, custodian: e.target.value })}>
                      <option value="">All custodians</option>
                      {custodianOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Asset Group">
                    <Select value={sessionForm.group} onChange={(e) => setSessionForm({ ...sessionForm, group: e.target.value })}>
                      <option value="">All groups</option>
                      <option value="asset">Assets</option>
                      <option value="component">Components</option>
                      <option value="accessory">Accessories</option>
                      <option value="consumable">Consumables</option>
                      <option value="license">Licenses</option>
                    </Select>
                  </Field>
                </div>
                <p className="mt-3 text-sm text-mist"><span className="font-bold text-inherit">{scopeCount}</span> asset{scopeCount === 1 ? '' : 's'} match the selection and will be added to the audit (disposed / written-off assets are excluded).</p>
              </div>
            )}
            <datalist id="aa-departments">
              {departments.map((d) => <option key={d.id} value={d.name} />)}
            </datalist>

            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setSessionForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveSession}>{sessionForm.id ? 'Save Changes' : 'Create Audit'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* ================= Verification workspace ================= */}
      <Modal open={!!verifyAudit} onClose={() => { setVerifyAuditId(null); setVerifyOnlyItemId(null); setSelectedItemIds([]); setVerifyQ(''); setVerifyStatus('') }} title={verifyAudit ? `Verification — ${verifyAudit.number}` : ''} xl>
        {verifyAudit && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
              <Badge tone={sessionTone(verifyAudit.status)}>{sessionStatusLabel(verifyAudit.status)}</Badge>
              <span className="text-mist">{formatDate(verifyAudit.date)} · {formatDate(verifyAudit.periodFrom)} → {formatDate(verifyAudit.periodTo)}</span>
              <span className="text-mist">{verifyAudit.location}{verifyAudit.department ? ` · ${verifyAudit.department}` : ''}</span>
              <span className="text-mist">Auditor: <span className="font-semibold text-inherit">{verifyAudit.auditor}</span></span>
              {verifyAudit.approvedBy && <span className="text-mist">Approved by <span className="font-semibold text-inherit">{verifyAudit.approvedBy}</span> · {formatDate((verifyAudit.approvedAt || '').slice(0, 10))}</span>}
            </div>
            {verifyOnlyItemId && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  Single-item view — showing only the item you opened (1 of {itemsOf(verifyAudit.id).length} in {verifyAudit.number}).
                </span>
                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setVerifyOnlyItemId(null); setSelectedItemIds(itemsOf(verifyAudit.id).map((x) => x.id)) }}>
                  <ClipboardCheck className="size-3.5" /> Bulk verification — all {itemsOf(verifyAudit.id).length} items
                </Button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SearchField value={verifyQ} onChange={setVerifyQ} placeholder="Search items…" className="w-full max-w-xs" />
              <Select value={verifyStatus} onChange={(e) => setVerifyStatus(e.target.value)} className="w-auto">
                <option value="">All statuses</option>
                {PHYSICAL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
              {verifyEditable && (
                <div className="ml-auto flex gap-2">
                  <Button className="border border-line bg-transparent text-inherit hover:bg-black/[0.04] dark:hover:bg-white/[0.06]" onClick={() => { setAddQ(''); setPicked([]); setAddOpen(true) }}>
                    <Plus className="size-4" /> Add assets
                  </Button>
                  <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setUnregForm({ assetTag: '', assetName: '', observedLocation: verifyAudit.location, observedCustodian: '', physicalStatus: 'verified', condition: '', findings: '', remarks: '' })}>
                    <Plus className="size-4" /> Unregistered asset
                  </Button>
                </div>
              )}
            </div>
            {!verifyEditable && (
              <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Ban className="size-3.5" />
                {verifyAudit.status === 'approved'
                  ? 'This audit is approved — results are final. A manager can reopen it from the Audits tab (↺) to re-verify.'
                  : 'Your role can view audits but not record verification results.'}
              </p>
            )}
            {bulkVerifyBar}
            {verifyItems.length === 0
              ? <Empty title="No items in scope" desc="Add assets from the register or record an unregistered find." />
              : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[1440px] text-left text-xs">
                    <thead className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                      <tr>
                        <th className="w-10 px-3 py-2">
                          <input type="checkbox" aria-label="Select all items"
                            checked={verifyItems.length > 0 && verifyItems.every((i) => selectedItemIds.includes(i.id))}
                            onChange={() => setSelectedItemIds((p) => (verifyItems.every((i) => p.includes(i.id)) ? [] : verifyItems.map((i) => i.id)))}
                            className="size-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" />
                        </th>
                        <th className="px-3 py-2">Asset</th>
                        <th className="px-3 py-2">Physical Status</th>
                        <th className="px-3 py-2">Condition</th>
                        <th className="px-3 py-2">Observed Location</th>
                        <th className="px-3 py-2">Observed Custodian</th>
                        <th className="px-3 py-2">Corrective Action</th>
                        <th className="px-3 py-2">Findings</th>
                        <th className="px-3 py-2">Remarks</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifyItems.map((i) => (
                        <VerifyRow
                          key={i.id}
                          item={i}
                          editable={verifyEditable}
                          lockedCorrective={verifyAudit.status !== 'approved'}
                          conditions={assetConditions}
                          selected={selectedItemIds.includes(i.id)}
                          onToggleSelect={() => toggleItemSelected(i.id)}
                          onSave={saveItemDraft}
                          onRemove={verifyEditable ? () => removeItem(i) : undefined}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </Modal>

      {/* ================= Bulk verification (per-item editor) ================= */}
      {bulkOpen && checkedItems.length > 0 && (
        <Modal open onClose={() => setBulkOpen(false)} title={`Bulk verification — ${checkedItems.length} item${checkedItems.length === 1 ? '' : 's'}`} xl>
          <p className="mb-3 text-xs text-mist">
            Every checked item keeps its own values — edit Physical Status, Condition, Observed Location, Observed Custodian,
            Corrective Action, Findings and Remarks per row, then apply them to that item alone with its Save item action.
            Rows of approved audits are read-only.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[1440px] text-left text-xs">
              <thead className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" aria-label="Select all items"
                      checked={checkedItems.length > 0 && checkedItems.every((i) => selectedItemIds.includes(i.id))}
                      onChange={() => setSelectedItemIds((p) => (checkedItems.every((i) => p.includes(i.id)) ? [] : checkedItems.map((i) => i.id)))}
                      className="size-4 cursor-pointer accent-blue-600" />
                  </th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Physical Status</th>
                  <th className="px-3 py-2">Condition</th>
                  <th className="px-3 py-2">Observed Location</th>
                  <th className="px-3 py-2">Observed Custodian</th>
                  <th className="px-3 py-2">Corrective Action</th>
                  <th className="px-3 py-2">Findings</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {checkedItems.map((i) => {
                  const editable = canVerify && auditOf(i.auditId)?.status !== 'approved'
                  return (
                    <VerifyRow
                      key={i.id}
                      item={i}
                      editable={editable}
                      lockedCorrective={auditOf(i.auditId)?.status !== 'approved'}
                      conditions={assetConditions}
                      selected={selectedItemIds.includes(i.id)}
                      onToggleSelect={() => toggleItemSelected(i.id)}
                      onSave={saveItemDraft}
                      onRemove={editable ? () => removeItem(i) : undefined}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Done</Button>
          </div>
        </Modal>
      )}

      {/* ================= Add register assets to audit ================= */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add assets to audit" wide>
        <div className="mb-3">
          <SearchField value={addQ} onChange={setAddQ} placeholder="Search tag, name, category, location…" />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
              <tr><th className="px-3 py-2" /> <th className="px-3 py-2">Tag</th><th className="px-3 py-2">Asset</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Custodian</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pickerAssets.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-mist">Every matching asset is already in this audit.</td></tr>}
              {pickerAssets.map((a) => {
                const on = picked.includes(a.id)
                return (
                  <tr key={a.id} className={`cursor-pointer transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${on ? 'bg-orange-500/10' : ''}`} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}>
                    <td className="px-3 py-2"><input type="checkbox" readOnly checked={on} className="accent-orange-500" /></td>
                    <td className="px-3 py-2 font-semibold">{a.tag}</td>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-mist">{a.location}</td>
                    <td className="px-3 py-2 text-mist">{a.assignedTo || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={picked.length === 0} onClick={addPickedAssets}>Add {picked.length || ''} asset{picked.length === 1 ? '' : 's'}</Button>
        </div>
      </Modal>

      {/* ================= Unregistered asset ================= */}
      <Modal open={!!unregForm} onClose={() => setUnregForm(null)} title="Record unregistered asset" wide>
        {unregForm && (
          <>
            <p className="mb-4 text-sm text-mist">Assets found on site but missing from the register are recorded here and reported as an <span className="font-semibold text-inherit">Unregistered asset</span> discrepancy.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Field Tag" hint="Leave blank to auto-assign">
                <Input value={unregForm.assetTag} onChange={(e) => setUnregForm({ ...unregForm, assetTag: e.target.value })} placeholder="UNREG-001" />
              </Field>
              <Field label="Asset Description" required>
                <Input value={unregForm.assetName} onChange={(e) => setUnregForm({ ...unregForm, assetName: e.target.value })} placeholder="e.g. Wall-mounted TV — Samsung 55&quot;" />
              </Field>
              <Field label="Observed Location">
                <Input list="aa-locations" value={unregForm.observedLocation} onChange={(e) => setUnregForm({ ...unregForm, observedLocation: e.target.value })} />
              </Field>
              <Field label="Observed Custodian">
                <Input list="aa-custodians" value={unregForm.observedCustodian} onChange={(e) => setUnregForm({ ...unregForm, observedCustodian: e.target.value })} />
              </Field>
              <Field label="Physical Status">
                <Select value={unregForm.physicalStatus} onChange={(e) => setUnregForm({ ...unregForm, physicalStatus: e.target.value as AuditPhysicalStatus })}>
                  {PHYSICAL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Asset Condition">
                <Select value={unregForm.condition} onChange={(e) => setUnregForm({ ...unregForm, condition: e.target.value })}>
                  <option value="">Not recorded</option>
                  {assetConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Findings">
                <Input value={unregForm.findings} onChange={(e) => setUnregForm({ ...unregForm, findings: e.target.value })} placeholder="What was found…" />
              </Field>
              <Field label="Remarks">
                <Input value={unregForm.remarks} onChange={(e) => setUnregForm({ ...unregForm, remarks: e.target.value })} placeholder="Auditor remarks…" />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setUnregForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={addUnregistered}>Record Asset</Button>
            </div>
          </>
        )}
      </Modal>

      {/* ================= Delete audit ================= */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete audit?">
        {deleting && (
          <>
            <p className="text-sm">
              Delete audit <span className="font-semibold">{deleting.number}</span> and its {itemsOf(deleting.id).length} verification item(s)? The audit history entry is kept.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setDeleting(null)}>Cancel</Button>
              <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={deleteAudit}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
