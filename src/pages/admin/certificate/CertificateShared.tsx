/**
 * Shared plumbing for the 8 Certificate pages: branch records, roles,
 * permission checks and helper data.
 * Mirrors IdCardShared pattern.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import {
  canPerformCert,
  readCertificateTypes,
  readCertificateTemplates,
  readCertificateGenerations,
  readCertificateRegisters,
  readCertificateBulk,
  readCertificateVerifications,
  readCertificateReports,
  readCertificateSettings,
  type CertPermissionKey,
} from '../../../lib/certificates'
import {
  searchHolder as searchHolderFn,
  listHolders as listHoldersFn,
  listStudentsByClass as listStudentsByClassFn,
  autoPopulate,
  checkEligibility,
  readAuditTrail,
  type IntegrationSource,
  type IntegratedHolder,
  type AutoPopulateResult,
  type CertificateAuditEntry,
} from '../../../lib/certDataIntegration'

export function useCertificateContext() {
  const { activeBranchId, company, branches, roles } = useApp()
  const { user } = useAuth()

  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  useEffect(() => setRecords(loadEduRecords(activeBranchId)), [activeBranchId])

  const roleDef = roles.find((r) => r.id === user?.role)
  const userRoles = [String(user?.role ?? ''), String(roleDef?.name ?? '')].filter(Boolean)
  const officer = String(user?.name ?? roleDef?.name ?? user?.role ?? 'System').trim() || 'System'

  const types = useMemo(() => readCertificateTypes(records), [records])
  const templates = useMemo(() => readCertificateTemplates(records), [records])
  const generations = useMemo(() => readCertificateGenerations(records), [records])
  const registers = useMemo(() => readCertificateRegisters(records), [records])
  const bulks = useMemo(() => readCertificateBulk(records), [records])
  const verifications = useMemo(() => readCertificateVerifications(records), [records])
  const reports = useMemo(() => readCertificateReports(records), [records])
  const settings = useMemo(() => readCertificateSettings(records), [records])

  const can = useCallback(
    (key: CertPermissionKey) => canPerformCert(records, key, userRoles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, userRoles.join('|')],
  )

  const patch = useCallback(
    (next: Record<string, EduRow[]>) => {
      setRecords((current) => {
        const merged = { ...current, ...next }
        saveEduRecords(activeBranchId, merged)
        return merged
      })
    },
    [activeBranchId],
  )

  const schools = useMemo(() => ({
    name: String(company?.name ?? 'Organisation'),
    address: [company?.address, company?.stateRegion, company?.country].filter(Boolean).join(', '),
    contact: [company?.phone, company?.email].filter(Boolean).join(' · '),
    logo: String(company?.logoImage ?? company?.printHeader?.headerImage ?? ''),
  }), [company])

  const branchName = branches.find((b) => b.id === activeBranchId)?.name ?? company?.name ?? 'Branch'

  // Data integration functions
  const searchHolder = useCallback(
    (source: IntegrationSource, query: string) => searchHolderFn(records, source, query),
    [records],
  )
  const listHoldersForSource = useCallback(
    (source: IntegrationSource) => listHoldersFn(records, source),
    [records],
  )
  const listStudentsByClass = useCallback(
    (className: string) => listStudentsByClassFn(records, className),
    [records],
  )
  const auditTrail = useMemo(() => readAuditTrail(records), [records])

  return {
    activeBranchId, records, types, templates, generations, registers, bulks, verifications, reports, settings,
    school: schools, branchName, officer, userRoles, can, patch,
    // Data integration
    searchHolder, listHoldersForSource, listStudentsByClass, auditTrail,
    autoPopulate, checkEligibility,
  }
}

export const CERT_HOLDERS = [
  'University',
  'College',
  'Secondary School',
  'Basic School',
  'Student',
  'Employee',
  'Member',
  'Other Institution',
] as const

export const CERT_HOLDER_NAME_LABELS: Record<string, { label: string; placeholder: string }> = {
  University: { label: 'University Name', placeholder: 'e.g. University of Ghana' },
  College: { label: 'College Name', placeholder: 'e.g. Accra Technical College' },
  'Secondary School': { label: 'School Name', placeholder: 'e.g. Achimota Senior High School' },
  'Basic School': { label: 'School Name', placeholder: 'e.g. Airport City Basic School' },
  Student: { label: 'Student Name', placeholder: 'e.g. Ama Boateng' },
  Employee: { label: 'Employee Name', placeholder: 'e.g. Kwame Mensah' },
  Member: { label: 'Member Name', placeholder: 'e.g. Grace Acheampong' },
  'Other Institution': { label: 'Institution Name', placeholder: 'e.g. National Service Scheme' },
}

export const certStatusTone = (status: string) => {
  const s = String(status ?? '').trim().toLowerCase()
  if (['issued', 'valid', 'active', 'generated'].includes(s)) return 'lime' as const
  if (['pending', 'draft'].includes(s)) return 'amber' as const
  if (['revoked', 'invalid', 'expired'].includes(s)) return 'rose' as const
  return 'zinc' as const
}
