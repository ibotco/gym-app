/**
 * Shared store for the Asset Audit module.
 * Audit sessions, verification items and the audit log live in localStorage
 * (same pattern as Asset maintenance / Asset locations); the Asset Audit page
 * owns the CRUD, and this file keeps the record shapes, seeds and the pure
 * helpers (discrepancy detection, corrective-action progress) testable.
 */

import type { Asset, AssetTransaction } from '../types'

// ---- Physical verification status of an audited item ----
export type AuditPhysicalStatus = 'pending' | 'verified' | 'missing' | 'damaged' | 'lost' | 'obsolete'

// ---- Approval / review workflow of an audit session ----
export type AuditSessionStatus = 'draft' | 'in_progress' | 'submitted' | 'approved' | 'rejected'

// ---- Discrepancy classes detected when comparing results with the register ----
export type AuditDiscrepancyType =
  | 'missing_asset'
  | 'incorrect_location'
  | 'incorrect_custodian'
  | 'unregistered'
  | 'duplicate'

// ---- Corrective actions an approved finding can initiate ----
export type AuditCorrectiveAction = 'transfer' | 'dispose' | 'write_off'

/** Supporting evidence attached to an audit item (photo / document). */
export interface AuditEvidence {
  name: string
  type: string
  size: number
  /** Inline data URL kept only for small files so previews work offline. */
  dataUrl?: string
}

/** One asset line inside an audit session. */
export interface AssetAuditItem {
  id: string
  auditId: string
  /** Register asset id; absent for unregistered assets found on site. */
  assetId?: string
  /** Asset tag (register tag, or a field tag for unregistered finds). */
  assetTag: string
  assetName: string
  /** Register snapshot captured when the item was added. */
  expectedLocation?: string
  expectedCustodian?: string
  /** Values observed during physical verification. */
  observedLocation?: string
  observedCustodian?: string
  physicalStatus: AuditPhysicalStatus
  condition?: string
  findings?: string
  remarks?: string
  evidence: AuditEvidence[]
  /** Corrective action selected for the finding (empty / 'none' when not needed). */
  correctiveAction?: AuditCorrectiveAction | 'none'
  /** When the corrective action was launched toward Asset Transactions. */
  correctiveInitiatedAt?: string
  /** Links a duplicate find back to the original item of the same asset. */
  duplicateOfItemId?: string
  verifiedBy?: string
  verifiedAt?: string
  createdBy: string
  modifiedBy: string
  createdAt: string
  updatedAt: string
}

/** An audit session (one physical verification exercise). */
export interface AssetAudit {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Optional branch owner. */
  branchId?: string
  /** Human-facing audit number, e.g. AUD-2026-001. */
  number: string
  /** Audit date (YYYY-MM-DD). */
  date: string
  /** Audit period covered (YYYY-MM-DD). */
  periodFrom: string
  periodTo: string
  location: string
  department: string
  auditor: string
  status: AuditSessionStatus
  approvedBy?: string
  approvedAt?: string
  notes?: string
  createdBy: string
  modifiedBy: string
  createdAt: string
  updatedAt: string
}

/** Audit trail entry (security requirement: full log of user actions). */
export interface AuditLogEntry {
  id: string
  at: string
  user: string
  action: 'CREATE' | 'UPDATE' | 'START' | 'VERIFY' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CORRECT' | 'DELETE'
  target: string
  details: string
}

export const ASSET_AUDITS_KEY = 'fitpro_asset_audits_v1'
export const ASSET_AUDIT_ITEMS_KEY = 'fitpro_asset_audit_items_v1'
export const ASSET_AUDIT_LOG_KEY = 'fitpro_asset_audit_log_v1'

/** Files above this size are recorded by name only (no inline preview data). */
export const AUDIT_EVIDENCE_INLINE_LIMIT = 1_000_000

export const PHYSICAL_STATUSES: { id: AuditPhysicalStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'missing', label: 'Missing' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'lost', label: 'Lost' },
  { id: 'obsolete', label: 'Obsolete' },
]

export const SESSION_STATUSES: { id: AuditSessionStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

export const DISCREPANCY_TYPES: { id: AuditDiscrepancyType; label: string }[] = [
  { id: 'missing_asset', label: 'Missing asset' },
  { id: 'incorrect_location', label: 'Incorrect location' },
  { id: 'incorrect_custodian', label: 'Incorrect custodian' },
  { id: 'unregistered', label: 'Unregistered asset' },
  { id: 'duplicate', label: 'Duplicate asset' },
]

export const CORRECTIVE_ACTIONS: { id: AuditCorrectiveAction; label: string }[] = [
  { id: 'transfer', label: 'Asset Transfer' },
  { id: 'dispose', label: 'Asset Disposal' },
  { id: 'write_off', label: 'Asset Write-off' },
]

// ---- Seed data ----
export const AUDIT_SEED: AssetAudit[] = [
  {
    id: 'aud_1', number: 'AUD-2026-001', date: '2026-06-30',
    periodFrom: '2026-04-01', periodTo: '2026-06-30',
    location: 'Accra — Airport City', department: 'Operations', auditor: 'Ama Owusu',
    status: 'approved', approvedBy: 'Yaw Boateng', approvedAt: '2026-07-02T10:00:00',
    notes: 'Q2 physical verification — Accra sites.',
    createdBy: 'Ama Owusu', modifiedBy: 'Yaw Boateng',
    createdAt: '2026-06-25T08:00:00', updatedAt: '2026-07-02T10:00:00',
  },
  {
    id: 'aud_2', number: 'AUD-2026-002', date: '2026-09-15',
    periodFrom: '2026-07-01', periodTo: '2026-09-30',
    location: 'Tema — Community 1', department: 'Facilities', auditor: 'Kofi Mensah',
    status: 'in_progress',
    notes: 'Q3 physical verification — Tema strength zone.',
    createdBy: 'Kofi Mensah', modifiedBy: 'Kofi Mensah',
    createdAt: '2026-09-10T09:00:00', updatedAt: '2026-09-15T14:30:00',
  },
]

export const AUDIT_ITEM_SEED: AssetAuditItem[] = [
  {
    id: 'ai_1', auditId: 'aud_1', assetId: 'ast_1', assetTag: 'AST-0001',
    assetName: 'Treadmill — Life Fitness T3',
    expectedLocation: 'Accra — Airport City', expectedCustodian: 'Kofi Mensah',
    observedLocation: 'Accra — Airport City', observedCustodian: 'Kofi Mensah',
    physicalStatus: 'verified', condition: 'Good',
    findings: 'Physically present; belt and console in working order.',
    evidence: [], verifiedBy: 'Ama Owusu', verifiedAt: '2026-06-29T10:15:00',
    createdBy: 'Ama Owusu', modifiedBy: 'Ama Owusu',
    createdAt: '2026-06-25T08:05:00', updatedAt: '2026-06-29T10:15:00',
  },
  {
    id: 'ai_2', auditId: 'aud_1', assetId: 'ast_6', assetTag: 'AST-0006',
    assetName: 'Reception POS terminal',
    expectedLocation: 'Accra — Airport City', expectedCustodian: 'Reception desk',
    observedLocation: '', observedCustodian: '',
    physicalStatus: 'missing', condition: 'Poor',
    findings: 'Not found at reception. May power surge destroyed the terminal and the remains were cleared — unit unrecoverable.',
    remarks: 'IT confirmed no backup unit on site.',
    evidence: [{ name: 'pos-site-photo.jpg', type: 'image/jpeg', size: 184320 }],
    correctiveAction: 'write_off',
    verifiedBy: 'Ama Owusu', verifiedAt: '2026-06-29T11:40:00',
    createdBy: 'Ama Owusu', modifiedBy: 'Ama Owusu',
    createdAt: '2026-06-25T08:05:00', updatedAt: '2026-06-29T11:40:00',
  },
  {
    id: 'ai_3', auditId: 'aud_1', assetId: 'ast_5', assetTag: 'AST-0005',
    assetName: 'Air conditioning unit — LG 2HP',
    expectedLocation: 'Takoradi — Beach Rd', expectedCustodian: '',
    observedLocation: 'Takoradi — Beach Rd', observedCustodian: '',
    physicalStatus: 'damaged', condition: 'Poor',
    findings: 'Refrigerant leak; compressor seized during inspection.',
    remarks: 'Vendor quote pending — repair vs replace decision deferred.',
    evidence: [{ name: 'ac-compressor.jpg', type: 'image/jpeg', size: 205110 }],
    verifiedBy: 'Ama Owusu', verifiedAt: '2026-06-30T09:05:00',
    createdBy: 'Ama Owusu', modifiedBy: 'Ama Owusu',
    createdAt: '2026-06-25T08:05:00', updatedAt: '2026-06-30T09:05:00',
  },
  {
    id: 'ai_4', auditId: 'aud_1', assetId: 'ast_4', assetTag: 'AST-0004',
    assetName: 'Dumbbell set 2.5–50 kg',
    expectedLocation: 'Kumasi — Adum', expectedCustodian: '',
    observedLocation: 'Kumasi — Adum', observedCustodian: '',
    physicalStatus: 'obsolete', condition: 'Poor',
    findings: 'Heavy rust and worn knurling; superseded by the rubberised set purchased in 2025.',
    remarks: 'Recommend disposal after approval.',
    evidence: [], correctiveAction: 'dispose',
    verifiedBy: 'Ama Owusu', verifiedAt: '2026-06-30T09:45:00',
    createdBy: 'Ama Owusu', modifiedBy: 'Ama Owusu',
    createdAt: '2026-06-25T08:05:00', updatedAt: '2026-06-30T09:45:00',
  },
  {
    id: 'ai_5', auditId: 'aud_2', assetId: 'ast_3', assetTag: 'AST-0003',
    assetName: 'Squat Rack — Rogue R-3',
    expectedLocation: 'Tema — Community 1', expectedCustodian: '',
    observedLocation: 'Tema — Community 1', observedCustodian: 'Efua Hammond',
    physicalStatus: 'verified', condition: 'Good',
    findings: 'Present in the strength zone; now looked after by Efua Hammond.',
    evidence: [], verifiedBy: 'Kofi Mensah', verifiedAt: '2026-09-15T14:20:00',
    createdBy: 'Kofi Mensah', modifiedBy: 'Kofi Mensah',
    createdAt: '2026-09-10T09:05:00', updatedAt: '2026-09-15T14:20:00',
  },
  {
    id: 'ai_6', auditId: 'aud_2', assetId: 'ast_5', assetTag: 'AST-0005',
    assetName: 'Air conditioning unit — LG 2HP',
    expectedLocation: 'Takoradi — Beach Rd', expectedCustodian: '',
    observedLocation: 'Accra — Airport City', observedCustodian: '',
    physicalStatus: 'verified', condition: 'Fair',
    findings: 'Unit found at the Airport City annex instead of Takoradi — relocated without a transfer record.',
    evidence: [{ name: 'ac-annex-photo.jpg', type: 'image/jpeg', size: 176220 }],
    verifiedBy: 'Kofi Mensah', verifiedAt: '2026-09-15T14:30:00',
    createdBy: 'Kofi Mensah', modifiedBy: 'Kofi Mensah',
    createdAt: '2026-09-10T09:05:00', updatedAt: '2026-09-15T14:30:00',
  },
  {
    id: 'ai_7', auditId: 'aud_2', assetTag: 'UNREG-001',
    assetName: 'Wall-mounted TV — Samsung 55"',
    observedLocation: 'Tema — Community 1', observedCustodian: '',
    physicalStatus: 'verified', condition: 'Good',
    findings: 'Found mounted in the studio but not present in the asset register.',
    remarks: 'Purchase invoice located with Facilities — register the asset.',
    evidence: [{ name: 'tv-studio-photo.jpg', type: 'image/jpeg', size: 220440 }],
    verifiedBy: 'Kofi Mensah', verifiedAt: '2026-09-15T15:00:00',
    createdBy: 'Kofi Mensah', modifiedBy: 'Kofi Mensah',
    createdAt: '2026-09-15T15:00:00', updatedAt: '2026-09-15T15:00:00',
  },
  {
    id: 'ai_8', auditId: 'aud_2', assetId: 'ast_3', assetTag: 'AST-0003',
    assetName: 'Squat Rack — Rogue R-3',
    expectedLocation: 'Tema — Community 1', expectedCustodian: '',
    observedLocation: 'Tema — Community 1', observedCustodian: '',
    physicalStatus: 'verified', condition: 'Fair',
    findings: 'Second unit found carrying the same serial number RG-R3-99120.',
    remarks: 'Confirm whether this is the warranty replacement unit.',
    evidence: [], duplicateOfItemId: 'ai_5',
    verifiedBy: 'Kofi Mensah', verifiedAt: '2026-09-15T15:10:00',
    createdBy: 'Kofi Mensah', modifiedBy: 'Kofi Mensah',
    createdAt: '2026-09-15T15:10:00', updatedAt: '2026-09-15T15:10:00',
  },
]

export const AUDIT_LOG_SEED: AuditLogEntry[] = [
  { id: 'al_1', at: '2026-06-25T08:00:00', user: 'Ama Owusu', action: 'CREATE', target: 'AUD-2026-001', details: 'Audit session created — Q2 verification, Accra sites' },
  { id: 'al_2', at: '2026-06-29T11:40:00', user: 'Ama Owusu', action: 'VERIFY', target: 'AUD-2026-001 · AST-0006', details: 'Recorded Missing — not found at reception' },
  { id: 'al_3', at: '2026-06-30T16:00:00', user: 'Ama Owusu', action: 'SUBMIT', target: 'AUD-2026-001', details: 'Submitted for review — 4 items verified' },
  { id: 'al_4', at: '2026-07-02T10:00:00', user: 'Yaw Boateng', action: 'APPROVE', target: 'AUD-2026-001', details: 'Audit approved' },
  { id: 'al_5', at: '2026-09-10T09:00:00', user: 'Kofi Mensah', action: 'CREATE', target: 'AUD-2026-002', details: 'Audit session created — Q3 verification, Tema strength zone' },
]

// ---- Persistence ----
export function loadAudits(): AssetAudit[] {
  try {
    const raw = localStorage.getItem(ASSET_AUDITS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AssetAudit[]
    }
  } catch { /* fall through to seed */ }
  return AUDIT_SEED
}

export function saveAudits(list: AssetAudit[]) {
  try { localStorage.setItem(ASSET_AUDITS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadAuditItems(): AssetAuditItem[] {
  try {
    const raw = localStorage.getItem(ASSET_AUDIT_ITEMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AssetAuditItem[]
    }
  } catch { /* fall through to seed */ }
  return AUDIT_ITEM_SEED
}

export function saveAuditItems(list: AssetAuditItem[]) {
  try { localStorage.setItem(ASSET_AUDIT_ITEMS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(ASSET_AUDIT_LOG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AuditLogEntry[]
    }
  } catch { /* fall through to seed */ }
  return AUDIT_LOG_SEED
}

export function saveAuditLog(list: AuditLogEntry[]) {
  try { localStorage.setItem(ASSET_AUDIT_LOG_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// ---- Helpers ----
const norm = (s: string) => s.trim().toLowerCase()

/** Next AUD-<year>-### number based on the sessions that already exist. */
export function nextAuditNumber(audits: AssetAudit[], now = new Date()): string {
  const year = now.getFullYear()
  const prefix = `AUD-${year}-`
  const max = audits.reduce((m, a) => {
    if (!a.number.startsWith(prefix)) return m
    const n = Number(a.number.slice(prefix.length))
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export interface DiscrepancyRow {
  id: string
  type: AuditDiscrepancyType
  item: AssetAuditItem
  auditId: string
  assetId?: string
  /** "TAG — Name" label for display and exports. */
  assetLabel: string
  /** What the register says. */
  expected: string
  /** What the physical check found. */
  observed: string
}

/**
 * Compares verification results against the register snapshot and returns one
 * row per discrepancy found (an item can produce several, e.g. missing + wrong
 * custodian). Pending items are skipped — they have not been checked yet.
 */
export function findDiscrepancies(items: AssetAuditItem[]): DiscrepancyRow[] {
  const rows: DiscrepancyRow[] = []
  const push = (type: AuditDiscrepancyType, item: AssetAuditItem, expected: string, observed: string) => {
    rows.push({
      id: `${item.id}:${type}`, type, item, auditId: item.auditId, assetId: item.assetId,
      assetLabel: `${item.assetTag} — ${item.assetName}`, expected, observed,
    })
  }
  for (const it of items) {
    if (it.physicalStatus === 'pending') continue
    if (it.physicalStatus === 'missing' || it.physicalStatus === 'lost') {
      push('missing_asset', it, it.expectedLocation || it.observedLocation || '—', 'Not found on site')
    }
    if (
      it.observedLocation && it.expectedLocation
      && norm(it.observedLocation) !== norm(it.expectedLocation)
    ) {
      push('incorrect_location', it, it.expectedLocation, it.observedLocation)
    }
    const expCust = (it.expectedCustodian || '').trim()
    const obsCust = (it.observedCustodian || '').trim()
    if (expCust && norm(obsCust) !== norm(expCust)) {
      push('incorrect_custodian', it, expCust, obsCust || 'Unassigned')
    }
    if (!it.assetId) push('unregistered', it, 'Not in the asset register', `${it.assetTag} found on site`)
    if (it.duplicateOfItemId) push('duplicate', it, '1 unit in the register', 'Additional unit with the same identity found')
  }
  return rows
}

export type CorrectiveState = 'done' | 'initiated' | 'pending'

/**
 * Progress of an item's corrective action: done once a matching transaction
 * exists in Asset Transactions (same type + asset, dated on/after the audit
 * item was created), initiated when it was launched but not saved yet.
 */
export function correctiveStatus(
  item: AssetAuditItem,
  transactions: AssetTransaction[],
): { state: CorrectiveState; tx?: AssetTransaction } {
  const action = item.correctiveAction
  if (!action || action === 'none' || !item.assetId) return { state: 'pending' }
  const since = (item.createdAt || '').slice(0, 10)
  const tx = transactions.find(
    (t) => t.type === action && t.assetId === item.assetId && t.date >= since,
  )
  if (tx) return { state: 'done', tx }
  if (item.correctiveInitiatedAt) return { state: 'initiated' }
  return { state: 'pending' }
}

/** Assets eligible to be pulled into an audit (disposed / written-off stay out). */
export function auditableAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => a.status !== 'disposed' && a.status !== 'written_off')
}

export function physicalStatusLabel(s: AuditPhysicalStatus): string {
  return PHYSICAL_STATUSES.find((x) => x.id === s)?.label || s
}

export function sessionStatusLabel(s: AuditSessionStatus): string {
  return SESSION_STATUSES.find((x) => x.id === s)?.label || s
}

export function discrepancyLabel(t: AuditDiscrepancyType): string {
  return DISCREPANCY_TYPES.find((x) => x.id === t)?.label || t
}
