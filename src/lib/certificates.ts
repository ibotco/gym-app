/**
 * Certificate Management — engine.
 *
 * Templates, single + bulk generation, verification, reporting and settings
 * live here so the 8 certificate pages stay thin.
 * Mirrors the Card Management engine pattern.
 */
import type { EduRecords, EduRow } from './eduRecords'

/* ------------------------------------------------------------------ types */

export const CERTIFICATE_STATUSES = ['Draft', 'Issued', 'Revoked', 'Expired'] as const
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number]

export const CERTIFICATE_HOLDER_TYPES = ['Student', 'Employee', 'Member'] as const
export type CertificateHolderType = (typeof CERTIFICATE_HOLDER_TYPES)[number]

export const CERT_VERIFICATION_STATUSES = ['Valid', 'Invalid', 'Revoked', 'Expired'] as const
export type CertVerificationStatus = (typeof CERT_VERIFICATION_STATUSES)[number]

export const CERT_REPORT_TYPES = ['Issued', 'Pending', 'Revoked', 'Verification', 'Summary'] as const
export type CertReportType = (typeof CERT_REPORT_TYPES)[number]

export const CERT_PERMISSION_KEYS = ['configure', 'generate', 'bulkGenerate', 'verify', 'reports', 'settings'] as const
export type CertPermissionKey = (typeof CERT_PERMISSION_KEYS)[number]

export const CERT_PERMISSIONS: { key: CertPermissionKey; label: string; description: string }[] = [
  { key: 'configure', label: 'Manage types & templates', description: 'Create and edit certificate types and templates.' },
  { key: 'generate', label: 'Generate certificates', description: 'Generate single certificates for holders.' },
  { key: 'bulkGenerate', label: 'Bulk generate', description: 'Create bulk certificate batches by class / group.' },
  { key: 'verify', label: 'Verify certificates', description: 'Lookup and verify certificate numbers.' },
  { key: 'reports', label: 'View reports', description: 'Open issuance, verification and summary reports.' },
  { key: 'settings', label: 'Manage settings', description: 'Configure numbering, QR, signatures and defaults.' },
]

export const CERT_ADMIN_ROLES = ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'admin', 'Administrator']

export const DEFAULT_CERT_PERMISSION_ROLES: Record<CertPermissionKey, string[]> = {
  configure: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager'],
  generate: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist'],
  bulkGenerate: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager'],
  verify: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist', 'staff', 'hr_manager', 'hr_officer'],
  reports: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'hr_manager'],
  settings: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager'],
}

export type CertificateTypeRow = EduRow & {
  name: string
  description: string
  serialPrefix: string
  status: string
}
export type CertificateTemplateRow = EduRow & {
  templateName: string
  holderType: string
  certificateType: string
  pageLayout: string
  paperSize: string
  orientation: string
  marginFilter: string
  borderStyle: string
  pattern: string
  backgroundColor: string
  backgroundImage: string
  certificateData: string
  createdAt: string
}
export type CertificateGenerationRow = EduRow & {
  certificateNo: string
  holderType: string
  holderName: string
  certificateType: string
  template: string
  issueDate: string
  expiryDate: string
  status: string
  remarks: string
}
export type CertificateBulkRow = EduRow & {
  batchName: string
  certificateType: string
  template: string
  holderType: string
  className: string
  groupName: string
  totalStudents: string
  issueDate: string
  status: string
}
export type CertificateVerificationRow = EduRow & {
  certificateNo: string
  holderType: string
  holderName: string
  certificateType: string
  issueDate: string
  verifiedBy: string
  verificationDate: string
  status: string
}
export type CertificateReportRow = EduRow & {
  title: string
  fromDate: string
  toDate: string
  holderType: string
  certificateType: string
  reportType: string
  generatedBy: string
}
export type CertificateSettingsRow = EduRow & {
  settingName: string
  certificateType: string
  autoNumbering: string
  serialPrefix: string
  qrCode: string
  digitalSignature: string
  status: string
}

/* ------------------------------------------------------------- helpers */

export const CERTIFICATE_TYPE_STATUSES = ['Active', 'Inactive'] as const
export const CERT_TEMPLATE_HOLDER_TYPES = ['Student', 'Employee', 'Member', 'All'] as const
export const CERT_PAGE_LAYOUTS = ['Portrait', 'Landscape'] as const
export const CERT_PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal', 'Custom'] as const
export const CERT_MARGINS = ['None', 'Small', 'Medium', 'Large', 'Extra Large'] as const
export const CERT_BORDER_STYLES = ['None', 'Solid Gold', 'Double', 'Dashed', 'Dotted', 'Groove', 'Ridge', 'Ornate Striped', 'Vintage', 'Elegant', 'Classic', 'Modern', 'Gold Frame', 'Silver Frame', 'Floral', 'Thick', 'Striped', 'Royal Blue', 'Emerald', 'Burgundy', 'Navy Gold', 'Art Deco', 'Wavy Gold', 'Scalloped', 'Rope', 'Laurel Wreath', 'Shadow', 'Triple', 'Mosaic', 'Inset', 'Outset', 'Bevel'] as const
export const CERT_PATTERNS = ['None', 'Dots', 'Lines', 'Grid', 'Waves', 'Chevron', 'Stripes', 'Crosshatch', 'Confetti', 'Damask', 'Stars', 'Marble', 'Honeycomb', 'Herringbone', 'Paisley', 'Floral', 'Geometric', 'Mosaic', 'Linen', 'Parchment', 'Bubbles', 'Diagonal', 'Zigzag', 'Circles', 'Hexagons', 'Noise', 'Vintage Paper'] as const

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function readCertificateTypes(records: EduRecords): CertificateTypeRow[] {
  return (records.certificateTypes ?? []) as CertificateTypeRow[]
}
export function readCertificateTemplates(records: EduRecords): CertificateTemplateRow[] {
  return (records.certificateTemplates ?? []) as CertificateTemplateRow[]
}
export function readCertificateGenerations(records: EduRecords): CertificateGenerationRow[] {
  return (records.certificateGeneration ?? []) as CertificateGenerationRow[]
}
export function readCertificateRegisters(records: EduRecords): CertificateGenerationRow[] {
  // certificateRegister is an alias that some seeds use — merge both
  const a = (records.certificateRegister ?? []) as CertificateGenerationRow[]
  const b = (records.certificateGeneration ?? []) as CertificateGenerationRow[]
  // Prefer the newer collection, but include alias rows that aren't duplicates
  if (!a.length) return b
  if (!b.length) return a
  const ids = new Set(b.map((r) => r.id))
  return [...b, ...a.filter((r) => !ids.has(r.id))]
}
export function readCertificateBulk(rows: EduRecords): CertificateBulkRow[] {
  return (rows.certificateBulkGeneration ?? []) as CertificateBulkRow[]
}
export function readCertificateVerifications(rows: EduRecords): CertificateVerificationRow[] {
  return (rows.certificateVerification ?? []) as CertificateVerificationRow[]
}
export function readCertificateReports(rows: EduRecords): CertificateReportRow[] {
  return (rows.certificateReports ?? []) as CertificateReportRow[]
}
export function readCertificateSettings(rows: EduRecords): CertificateSettingsRow[] {
  return (rows.certificateSettings ?? []) as CertificateSettingsRow[]
}

export function certificateTypeOptions(records: EduRecords): string[] {
  return readCertificateTypes(records)
    .filter((r) => !String(r.status ?? '').toLowerCase().includes('inactive'))
    .map((r) => String(r.name ?? '').trim())
    .filter(Boolean)
}

export function certificateTemplateOptions(records: EduRecords): string[] {
  return readCertificateTemplates(records).map((r) => String(r.templateName ?? '').trim()).filter(Boolean)
}

export function nextCertificateNo(prefix: string, existing: CertificateGenerationRow[]): string {
  const p = (prefix || 'CERT').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const year = new Date().getFullYear()
  const seq = existing.length + 1
  return `${p}-${year}-${String(seq).padStart(4, '0')}`
}

export function verifyCertificateNo(certNo: string, generations: CertificateGenerationRow[]): CertificateGenerationRow | undefined {
  const key = String(certNo ?? '').trim().toLowerCase()
  if (!key) return undefined
  return generations.find((r) => String(r.certificateNo ?? '').trim().toLowerCase() === key)
}

export function certStatusTone(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  const s = String(status ?? '').trim().toLowerCase()
  if (['issued', 'valid', 'active', 'generated'].includes(s)) return 'ok'
  if (['pending', 'draft'].includes(s)) return 'warn'
  if (['revoked', 'invalid', 'expired'].includes(s)) return 'bad'
  return 'neutral'
}

/* ------------------------------- permissions */

export function canPerformCert(records: EduRecords, key: CertPermissionKey, userRoles: string[]): boolean {
  const admin = userRoles.some((r) => CERT_ADMIN_ROLES.includes(String(r).trim()))
  if (admin) return true
  // Read from idCardSettings-style permission matrix if present, else fallback to default roles
  const settingsRows = (records as Record<string, EduRow[]>)['certificateSettings'] ?? []
  // If no explicit ACL stored, use defaults
  const defaults = DEFAULT_CERT_PERMISSION_ROLES[key] ?? []
  if (!settingsRows.length) return userRoles.some((r) => defaults.includes(String(r).trim()))
  // If ACL row has a JSON field 'permissions', honor it
  try {
    const aclRaw = String((settingsRows[0] as Record<string, unknown>)['permissions'] ?? '')
    if (aclRaw) {
      const acl = JSON.parse(aclRaw) as Record<string, string[]>
      const allowed = acl[key]
      if (Array.isArray(allowed)) return userRoles.some((r) => allowed.includes(String(r).trim()))
    }
  } catch { /* ignore */ }
  return userRoles.some((r) => defaults.includes(String(r).trim()))
}

export const CERT_HOLDER_TYPE_OPTIONS = ['Student', 'Employee', 'Member'] as const
