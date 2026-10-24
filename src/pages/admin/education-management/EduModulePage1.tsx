// @ts-nocheck
import { IssueCardIconButton } from '../../../components/IssueCardButton'
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { DataTable, type Column } from '../../../components/DataTable'
import { AlertTriangle, AlignCenter, AlignLeft, AlignRight, ArrowLeft, Banknote, Check, ClipboardCheck, LayoutGrid, List, Pencil, Plus, Printer, RotateCcw, Send, Trash2, UploadCloud, Users, X } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, MultiSelect, Textarea, Empty, SearchInput, DatePicker, StatCard, TimePicker } from '../../../components/ui'
import { Badge } from '../../../components/ui'
import { BooksCatalogGrid, LibrarySettingsCard, LibraryStatsBar } from '../LibraryUI'
import { EduAssignClassSubjectsPage } from './EduAssignClassSubjectsPage'
const EduGpsTrackingPage = lazy(() => import('./EduGpsTrackingPage').then(m => ({ default: m.EduGpsTrackingPage })))
import { EduTransportReportsPage } from './EduTransportReportsPage'
import { EduReportsPage } from './EduReportsPage'
import { EduWardensPage } from './EduWardensPage'
import { useToast } from '../../../context/ToastContext'
import { useI18n } from '../../../context/I18nContext'
import { useApp } from '../../../context/AppContext'
import { formatGhs, uid } from '../../../lib/utils'
import {
  formatTransportPickupPoints,
  loadEduRecords,
  parseTransportPickupPoints,
  saveEduRecords,
  type EduRow,
  type EduRecords,
} from '../../../lib/eduRecords'
import { activeWardenPeriod, currentHostelWardenNames, syncWardenAssignmentsFromHostel, teachingWardensForBranch } from '../../../lib/eduWardens'
import menu from '../../../data/eduMenu.json'

export type FieldDef = {
  key: string
  label: string
  type: string
  options?: string[]
  required?: boolean
  source?: string
  valueKey?: string
  displayKeys?: string[]
  filterKey?: string
  filterContains?: string
  /**
   * For a `source` field: only offer rows belonging to the academic term the
   * Academic module currently marks active. Used by Exam Name so a template
   * can't be pointed at an exam from a closed term.
   */
  filterActiveTerm?: boolean
  hideInForm?: boolean
  /** Keep the field out of the list table (it stays editable in the form). */
  hideInTable?: boolean
  /**
   * `checkboxes` – render a multiselect as always-visible checkboxes.
   * `file`      – render an image field as a compact "Select file" control.
   * `tokens`    – render a textarea with a row of insertable {placeholder} chips.
   */
  display?: 'checkboxes' | 'file' | 'tokens'
  /** Keep `options` in the authored order instead of sorting alphabetically. */
  keepOrder?: boolean
}
export type Leaf = { id: string; key: string; path: string; fields: FieldDef[] }
export type Group = { id: string; key: string; path: string; icon: string; leaves: Leaf[] }

const GROUPS = (menu as { groups: Group[] }).groups

const makeClassShort = (className: string, section: string) =>
  [className, section]
    .flatMap((part) => part.trim().split(/\s+/).filter(Boolean).map((word) => word.charAt(0)))
    .join('')
    .toLocaleUpperCase()

const formatTimeForDisplay = (value: unknown) => {
  const raw = String(value ?? '').trim()
  const twentyFourHour = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw)
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1])
    const minute = Number(twentyFourHour[2])
    if (hour <= 23 && minute <= 59) return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
  }
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw)
  if (twelveHour && Number(twelveHour[1]) >= 1 && Number(twelveHour[1]) <= 12 && Number(twelveHour[2]) <= 59) {
    return `${Number(twelveHour[1])}:${twelveHour[2]} ${twelveHour[3].toLocaleUpperCase()}`
  }
  return raw
}

type TransportRouteStop = {
  stoppageName: string
  stopTime: string
  distance: string
  routeFare: string
  latitude: string
  longitude: string
}

const emptyTransportRouteStop = (): TransportRouteStop => ({
  stoppageName: '', stopTime: '', distance: '', routeFare: '0.00', latitude: '', longitude: '',
})

const parseTransportRouteStops = (value: unknown): TransportRouteStop[] => {
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): TransportRouteStop[] => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        return [{
          stoppageName: String(row.stoppageName ?? row.name ?? '').trim(),
          stopTime: String(row.stopTime ?? row.pickupTime ?? '').trim(),
          distance: String(row.distance ?? '').trim(),
          routeFare: String(row.routeFare ?? row.fare ?? '').trim(),
          latitude: String(row.latitude ?? row.lat ?? '').trim(),
          longitude: String(row.longitude ?? row.lng ?? '').trim(),
        }]
      })
    }
  } catch { /* No saved stop rows */ }
  return []
}

const multiSelectValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map((item) => String(item ?? '').trim()).filter(Boolean))]
  } catch { /* legacy single-value field */ }
  return [raw]
}

const hostelAllocationIsActive = (row: EduRow) => String(row.status ?? '').trim().toLocaleLowerCase() !== 'checked out'
const hostelAllocationMatchesYear = (row: EduRow, yearId: string, yearName: string) => {
  const savedYearId = String(row.academicYearId ?? '').trim()
  if (savedYearId) return savedYearId === yearId
  const savedYearName = String(row.academicYear ?? '').trim() || String(row.session ?? '').trim()
  return !savedYearName || savedYearName === yearName
}
const hostelAllocationMatchesPeriod = (
  row: EduRow,
  yearId: string,
  yearName: string,
  terms: string[],
  termIds: string[] = [],
) => {
  if (!hostelAllocationMatchesYear(row, yearId, yearName)) return false
  const savedTermIds = multiSelectValues(row.termIds)
  if (savedTermIds.length && termIds.length) return savedTermIds.some((id) => termIds.includes(id))
  const savedTerms = multiSelectValues(row.terms)
  return !savedTerms.length || savedTerms.some((term) => terms.includes(term))
}
const hostelAllocationMatchesStudent = (row: EduRow, studentId: string, studentName: string) => {
  const savedStudentId = String(row.studentId ?? '').trim()
  if (studentId && savedStudentId) return savedStudentId === studentId
  return String(row.student ?? '').trim().toLocaleLowerCase() === studentName.trim().toLocaleLowerCase()
}
const transportAssignmentIsActive = (row: EduRow) => String(row.status ?? '').trim().toLocaleLowerCase() !== 'inactive'
const transportCatalogRowIsActive = (row: EduRow) => {
  const status = String(row.status ?? '').trim().toLocaleLowerCase()
  return !status || status === 'active'
}
const assignedVehicleOptionsForRoute = (records: EduRecords, routeName: string): string[] => {
  const route = routeName.trim()
  if (!route || !(records.transportRoutes ?? []).some((row) =>
    String(row.routeName ?? '').trim() === route && transportCatalogRowIsActive(row),
  )) return []
  const assignedVehicleNumbers = new Set((records.transportVehicleAssignments ?? [])
    .filter((row) => transportCatalogRowIsActive(row) && String(row.routeName ?? '').trim() === route)
    .map((row) => String(row.vehicleNo ?? '').trim())
    .filter(Boolean))
  return [...new Set((records.transportVehicles ?? [])
    .filter((row) => transportCatalogRowIsActive(row) && assignedVehicleNumbers.has(String(row.vehicleNo ?? '').trim()))
    .map((row) => String(row.vehicleNo ?? '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}
const routeRecordForName = (records: EduRecords, routeName: string): EduRow | undefined =>
  (records.transportRoutes ?? []).find((row) => String(row.routeName ?? '').trim() === routeName.trim())
const pickupPointOptionsForRoute = (records: EduRecords, routeName: string): string[] => {
  const route = routeRecordForName(records, routeName)
  if (!route) return []
  const stops = parseTransportRouteStops(route.routeStops)
  if (stops.length) return [...new Set(stops.map((stop) => stop.stoppageName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const legacy = parseTransportPickupPoints(route.pickupPoints)
  if (legacy.length) return [...new Set(legacy)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  return [...new Set((records.transportStoppage ?? [])
    .filter((row) => String(row.routeName ?? '').trim() === routeName.trim() && String(row.status ?? 'Active').trim().toLocaleLowerCase() !== 'inactive')
    .map((row) => String(row.stoppageName ?? '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}
const fareForRoute = (records: EduRecords, routeName: string): string => {
  const route = routeRecordForName(records, routeName)
  if (!route) return ''
  const stops = parseTransportRouteStops(route.routeStops)
  if (stops.length) {
    const firstFare = String(stops[0]?.routeFare ?? '').trim()
    if (firstFare) return firstFare
  }
  return String(route.fare ?? '').trim()
}
const fareForPickupPoint = (records: EduRecords, routeName: string, pickupPoint: string): string | null => {
  const point = pickupPoint.trim()
  if (!point) return null
  const route = routeRecordForName(records, routeName)
  if (!route) return null
  const stops = parseTransportRouteStops(route.routeStops)
  const matchedStop = stops.find((stop) => String(stop.stoppageName ?? '').trim() === point)
  if (matchedStop) {
    const fare = String(matchedStop.routeFare ?? '').trim()
    if (fare) return fare
  }
  const stoppage = (records.transportStoppage ?? []).find((row) => String(row.stoppageName ?? '').trim() === point)
  if (stoppage) {
    const fare = String(stoppage.routeFare ?? '').trim()
    if (fare) return fare
  }
  return null
}
const transportAssignmentMatchesStudent = (row: EduRow, studentId: string, studentName: string) => {
  const savedStudentId = String(row.studentId ?? '').trim()
  if (studentId && savedStudentId) return savedStudentId === studentId
  return String(row.student ?? '').trim().toLocaleLowerCase() === studentName.trim().toLocaleLowerCase()
}
const transportAssignmentStudentKey = (row: EduRow) => {
  const studentId = String(row.studentId ?? '').trim()
  return studentId ? `id:${studentId}` : `name:${String(row.student ?? '').trim().toLocaleLowerCase()}`
}
const daysUntil = (isoDate: string): number | null => {
  const raw = String(isoDate ?? '').trim()
  if (!raw) return null
  const target = new Date(raw)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
const licenseStatus = (expiryDate: unknown): 'expired' | 'expiring' | 'valid' | 'unknown' => {
  const days = daysUntil(String(expiryDate ?? ''))
  if (days === null) return 'unknown'
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}
const personnelLicenseAlerts = (rows: EduRow[]) => {
  let expired = 0
  let expiring = 0
  for (const row of rows) {
    const status = licenseStatus(row.licenseExpiryDate)
    if (status === 'expired') expired++
    else if (status === 'expiring') expiring++
  }
  return { expired, expiring }
}
const isTransportPersonnelLeaf = (leafId: string) => leafId === 'transportPersonnel'
// Builds the assignment-history entry logged whenever a driver or attendant is created,
// reassigned to another route/vehicle, or unassigned. Returns null when nothing relevant changed.
const personnelHistoryRow = (prev: EduRow | undefined, next: EduRow): EduRow | null => {
  const prevRoute = String(prev?.assignedRoute ?? '').trim()
  const prevVehicle = String(prev?.assignedVehicle ?? '').trim()
  const nextRoute = String(next.assignedRoute ?? '').trim()
  const nextVehicle = String(next.assignedVehicle ?? '').trim()
  if (prev && prevRoute === nextRoute && prevVehicle === nextVehicle) return null
  const hadAssignment = Boolean(prevRoute || prevVehicle)
  const hasAssignment = Boolean(nextRoute || nextVehicle)
  const action = !prev
    ? (hasAssignment ? 'Assigned' : 'Updated')
    : hadAssignment && hasAssignment
      ? 'Reassigned'
      : hasAssignment
        ? 'Assigned'
        : hadAssignment
          ? 'Unassigned'
          : 'Updated'
  const name = String(next.fullName ?? '').trim()
  return {
    id: uid(),
    date: todayISO(),
    personnelName: name,
    employeeId: String(next.employeeId ?? '').trim(),
    role: String(next.role ?? '').trim(),
    previousRoute: prevRoute,
    previousVehicle: prevVehicle,
    assignedRoute: nextRoute,
    assignedVehicle: nextVehicle,
    action,
    remarks: !prev
      ? `${name || 'Personnel'} added to Drivers & Attendants`
      : `${name || 'Personnel'} record updated`,
  }
}

const migrateSubjectCodesToShort = (rows: EduRow[]): EduRow[] => rows.map((row) => {
  const { code, ...rest } = row
  return { ...rest, short: String(row.short ?? '').trim() || String(code ?? '').trim() }
})

/* ------------------------------------------------------------------ *
 * Transport Fees — rate cards, concessions, billing posting, history  *
 * ------------------------------------------------------------------ */

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const percentOf = (amount: number, percent: number) => (amount * percent) / 100
const transportFeeIsApproved = (row: EduRow) => String(row.status ?? '').trim().toLocaleLowerCase() === 'approved'
const transportFeeIsAnnual = (row: EduRow) => String(row.feeStructure ?? '').trim().toLocaleLowerCase() === 'annual'
const transportFeeIsMonthly = (row: EduRow) => String(row.feeStructure ?? '').trim().toLocaleLowerCase() === 'monthly'

/** Whole months covered by a term (from its start/end dates); defaults to 3 when unknown. */
const monthsInTerm = (records: EduRecords, academicYear: string, termName: string): number => {
  const term = (records.termSemester ?? []).find((row) =>
    String(row.name ?? '').trim() === termName.trim()
    && (!academicYear || String(row.academicYear ?? '').trim() === academicYear.trim()))
  if (!term) return 3
  const start = new Date(String(term.startDate ?? '').trim())
  const end = new Date(String(term.endDate ?? '').trim())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 3
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  return Math.min(12, Math.max(1, months))
}

const transportFeeMultiplier = (records: EduRecords, feeRow: EduRow, termName: string): number =>
  transportFeeIsMonthly(feeRow) ? monthsInTerm(records, String(feeRow.academicYear ?? ''), termName) : 1

/** Human label for a rate card, e.g. "Accra Central Route · Kaneshie Market · Bus · Termly". */
const transportFeeLabel = (feeRow: EduRow): string => [
  String(feeRow.routeName ?? '').trim() || 'All routes',
  String(feeRow.pickupPoint ?? '').trim(),
  String(feeRow.vehicleCategory ?? '').trim(),
  String(feeRow.feeStructure ?? '').trim(),
].filter(Boolean).join(' · ')

/** Terms a rate card bills for: its chosen terms, all terms of the year, or a single annual charge. */
const transportFeeTerms = (records: EduRecords, feeRow: EduRow): string[] => {
  if (transportFeeIsAnnual(feeRow)) return ['']
  const selected = multiSelectValues(feeRow.term)
  if (selected.length) return selected
  const year = String(feeRow.academicYear ?? '').trim()
  const yearTerms = [...new Set((records.termSemester ?? [])
    .filter((row) => !year || String(row.academicYear ?? '').trim() === year)
    .map((row) => String(row.name ?? '').trim())
    .filter(Boolean))]
  return yearTerms.length ? yearTerms : ['']
}

const vehicleCategoryFor = (records: EduRecords, vehicleNo: string): string => {
  const plate = vehicleNo.trim()
  if (!plate) return ''
  const vehicle = (records.transportVehicles ?? []).find((row) => String(row.vehicleNo ?? '').trim() === plate)
  return String(vehicle?.vehicleCategory ?? '').trim()
}

/**
 * Sibling ranks (1 = eldest) among students who actually use transport and share a guardian.
 * Keyed by both `id:<studentId>` and `name:<lowercased name>` so assignments can be matched either way.
 */
const transportSiblingRanks = (records: EduRecords): Map<string, number> => {
  const assignments = (records.studentTransportAssignments ?? []).filter(transportAssignmentIsActive)
  if (!assignments.length) return new Map()
  const assignedIds = new Set(assignments.map((row) => String(row.studentId ?? '').trim()).filter(Boolean))
  const assignedNames = new Set(assignments
    .map((row) => String(row.student ?? '').trim().toLocaleLowerCase())
    .filter(Boolean))
  const families = new Map<string, EduRow[]>()
  for (const student of records.studentList ?? []) {
    const id = String(student.id ?? '').trim()
    const name = String(student.name ?? '').trim()
    if (!id && !name) continue
    if (!assignedIds.has(id) && !assignedNames.has(name.toLocaleLowerCase())) continue
    const guardian = String(student.guardian ?? '').trim().toLocaleLowerCase()
    if (!guardian) continue
    families.set(guardian, [...(families.get(guardian) ?? []), student])
  }
  const ranks = new Map<string, number>()
  for (const members of families.values()) {
    if (members.length < 2) continue
    const ordered = [...members].sort((a, b) => {
      const keyA = String(a.dateOfBirth ?? '').trim() || String(a.admissionNo ?? '').trim() || String(a.name ?? '')
      const keyB = String(b.dateOfBirth ?? '').trim() || String(b.admissionNo ?? '').trim() || String(b.name ?? '')
      return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' })
    })
    ordered.forEach((student, index) => {
      const id = String(student.id ?? '').trim()
      if (id) ranks.set(`id:${id}`, index + 1)
      const name = String(student.name ?? '').trim().toLocaleLowerCase()
      if (name) ranks.set(`name:${name}`, index + 1)
    })
  }
  return ranks
}

const siblingRankFor = (ranks: Map<string, number>, studentId: string, studentName: string): number => {
  const byId = studentId.trim() ? ranks.get(`id:${studentId.trim()}`) : undefined
  if (byId) return byId
  const byName = studentName.trim() ? ranks.get(`name:${studentName.trim().toLocaleLowerCase()}`) : undefined
  return byName ?? 1
}

const approvedFeeAdjustmentsFor = (records: EduRecords, studentName: string, academicYear: string, term: string): EduRow[] =>
  (records.transportFeeAdjustments ?? []).filter((row) => {
    if (String(row.status ?? '').trim().toLocaleLowerCase() !== 'approved') return false
    if (String(row.student ?? '').trim().toLocaleLowerCase() !== studentName.trim().toLocaleLowerCase()) return false
    const year = String(row.academicYear ?? '').trim()
    if (year && academicYear && year !== academicYear) return false
    const rowTerm = String(row.term ?? '').trim()
    if (rowTerm && term && rowTerm !== term) return false
    return true
  })

const applyFeeAdjustments = (amount: number, rows: EduRow[]): number => rows.reduce((acc, row) => {
  const type = String(row.adjustmentType ?? '').trim().toLocaleLowerCase()
  const value = Number(row.value ?? 0)
  if (!Number.isFinite(value)) return acc
  if (type === 'waiver') return 0
  if (type === 'discount %' || type === 'sibling concession') return roundMoney(acc - percentOf(acc, value))
  if (type === 'fixed discount') return roundMoney(Math.max(0, acc - value))
  if (type === 'surcharge') return roundMoney(acc + value)
  return acc
}, amount)

export type TransportFeeBreakdown = {
  gross: number
  discount: number
  siblingRank: number
  siblingPercent: number
  siblingDiscount: number
  adjustmentDelta: number
  net: number
}

/** Full charge calculation for one student under one rate card for one term. */
const transportFeeBreakdown = (
  records: EduRecords,
  feeRow: EduRow,
  student: { id?: string; name: string },
  termName: string,
  ranks: Map<string, number> = transportSiblingRanks(records),
): TransportFeeBreakdown => {
  const base = Number(feeRow.amount ?? 0)
  const gross = Number.isFinite(base) ? roundMoney(base * transportFeeMultiplier(records, feeRow, termName)) : 0
  const discountPercent = Number(feeRow.discountPercent ?? 0)
  const afterDiscount = roundMoney(gross - percentOf(gross, Number.isFinite(discountPercent) ? discountPercent : 0))
  const rank = siblingRankFor(ranks, String(student.id ?? ''), student.name)
  const siblingPercent = rank === 2
    ? Number(feeRow.siblingSecondPercent ?? 0) || 0
    : rank >= 3
      ? Number(feeRow.siblingThirdPercent ?? 0) || 0
      : 0
  const afterSibling = roundMoney(afterDiscount - percentOf(afterDiscount, siblingPercent))
  const adjustments = approvedFeeAdjustmentsFor(records, student.name, String(feeRow.academicYear ?? ''), termName)
  const adjusted = applyFeeAdjustments(afterSibling, adjustments)
  const net = roundMoney(Math.max(0, adjusted))
  return {
    gross,
    discount: roundMoney(gross - afterDiscount),
    siblingRank: rank,
    siblingPercent,
    siblingDiscount: roundMoney(afterDiscount - afterSibling),
    adjustmentDelta: roundMoney(adjusted - afterSibling),
    net,
  }
}

/** Does a student's transport assignment fall under this rate card? Blank dimensions act as "any". */
const transportFeeMatchesAssignment = (records: EduRecords, feeRow: EduRow, assignment: EduRow): boolean => {
  if (!transportAssignmentIsActive(assignment)) return false
  const route = String(feeRow.routeName ?? '').trim()
  if (route && String(assignment.routeName ?? '').trim() !== route) return false
  const pickup = String(feeRow.pickupPoint ?? '').trim()
  if (pickup && String(assignment.pickupPoint ?? '').trim() !== pickup) return false
  const category = String(feeRow.vehicleCategory ?? '').trim()
  if (category && vehicleCategoryFor(records, String(assignment.vehicleNo ?? '')) !== category) return false
  return true
}

/**
 * Fee Adjustments (student discounts, surcharges, concessions) are edited from the
 * Adjustments tab of the Transport Fees menu, so their field list is defined here.
 */
const TRANSPORT_FEE_ADJUSTMENT_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'student', label: 'Student', type: 'select', source: 'studentList', valueKey: 'name', required: true },
  { key: 'academicYear', label: 'Academic Year', type: 'select', source: 'academicYear', valueKey: 'name' },
  { key: 'term', label: 'Term / Semester', type: 'select', source: 'termSemester', valueKey: 'name' },
  { key: 'adjustmentType', label: 'Adjustment type', type: 'select', options: ['Discount %', 'Fixed Discount', 'Surcharge', 'Sibling Concession', 'Waiver'], required: true },
  { key: 'value', label: 'Value', type: 'number', required: true },
  { key: 'reason', label: 'Reason', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'], required: true },
  { key: 'remarks', label: 'Remarks', type: 'text' },
]

/** Assignment history is the second tab of the Drivers & Attendants menu. */
const TRANSPORT_PERSONNEL_HISTORY_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'personnelName', label: 'Personnel Name', type: 'text', required: true },
  { key: 'employeeId', label: 'Employee ID', type: 'text' },
  { key: 'role', label: 'Role', type: 'select', options: ['Driver', 'Attendant'], required: true },
  { key: 'previousRoute', label: 'Previous Route', type: 'text' },
  { key: 'previousVehicle', label: 'Previous Vehicle', type: 'text' },
  { key: 'assignedRoute', label: 'New Route', type: 'text' },
  { key: 'assignedVehicle', label: 'New Vehicle', type: 'text' },
  { key: 'action', label: 'Action', type: 'select', options: ['Assigned', 'Reassigned', 'Unassigned', 'Updated'] },
  { key: 'remarks', label: 'Remarks', type: 'text' },
]

/** Fee change history is the third tab of the Transport Fees menu. */
const TRANSPORT_FEE_HISTORY_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'feeRef', label: 'Fee rule', type: 'text', required: true },
  { key: 'action', label: 'Action', type: 'select', options: ['Created', 'Updated', 'Submitted', 'Approved', 'Rejected', 'Adjustment', 'Posted to Billing', 'Deleted'], required: true },
  { key: 'fieldChanged', label: 'Field changed', type: 'text' },
  { key: 'previousValue', label: 'Previous value', type: 'text' },
  { key: 'newValue', label: 'New value', type: 'text' },
  { key: 'amountBefore', label: 'Amount before', type: 'number' },
  { key: 'amountAfter', label: 'Amount after', type: 'number' },
  { key: 'changedBy', label: 'Changed by', type: 'text' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
]

/* ------------------------------------------------------------------ *
 * Transport daily attendance                                          *
 * ------------------------------------------------------------------ */

const TRANSPORT_TRIPS = ['Morning Pickup', 'Afternoon Drop-off', 'Special Trip']
const TRANSPORT_ATTENDANCE_STATUSES = ['Picked Up', 'Dropped Off', 'Absent', 'Late Pickup', 'Exception']
const nowTimeValue = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
const attendanceStatusTone = (status: string): 'lime' | 'sky' | 'rose' | 'amber' | 'violet' | 'zinc' => {
  const value = status.trim().toLocaleLowerCase()
  if (value === 'picked up') return 'lime'
  if (value === 'dropped off') return 'sky'
  if (value === 'absent') return 'rose'
  if (value === 'late pickup') return 'amber'
  if (value === 'exception') return 'violet'
  return 'zinc'
}
/** One attendance row per student per trip per day. */
const attendanceRowKey = (date: string, trip: string, studentId: string, studentName: string) =>
  [date.trim(), trip.trim(), studentId.trim() || studentName.trim().toLocaleLowerCase()].join('|')
const attendanceRowKeyOf = (row: EduRow) => attendanceRowKey(
  String(row.date ?? ''),
  String(row.trip ?? ''),
  String(row.studentId ?? ''),
  String(row.student ?? ''),
)

export type ExpectedTransportStudent = {
  key: string
  studentId: string
  studentName: string
  className: string
  rollNo: string
  admissionNo: string
  routeName: string
  vehicleNo: string
  pickupPoint: string
}

/** Students with an active transport assignment, optionally narrowed to a Route / Vehicle. */
const expectedTransportStudents = (records: EduRecords, filters: { routeName?: string; vehicleNo?: string } = {}): ExpectedTransportStudent[] => {
  const route = String(filters.routeName ?? '').trim()
  const vehicle = String(filters.vehicleNo ?? '').trim()
  const students = records.studentList ?? []
  const seen = new Set<string>()
  const rows: ExpectedTransportStudent[] = []
  for (const assignment of records.studentTransportAssignments ?? []) {
    if (!transportAssignmentIsActive(assignment)) continue
    const routeName = String(assignment.routeName ?? '').trim()
    if (route && routeName !== route) continue
    const vehicleNo = String(assignment.vehicleNo ?? '').trim()
    if (vehicle && vehicleNo !== vehicle) continue
    const studentId = String(assignment.studentId ?? '').trim()
    const studentName = String(assignment.student ?? '').trim()
    if (!studentName) continue
    const key = studentId ? `id:${studentId}` : `name:${studentName.toLocaleLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const student = students.find((row) => String(row.id ?? '').trim() === studentId)
      || students.find((row) => String(row.name ?? '').trim().toLocaleLowerCase() === studentName.toLocaleLowerCase())
    rows.push({
      key,
      studentId,
      studentName,
      className: String(assignment.className ?? student?.className ?? '').trim(),
      rollNo: String(student?.rollNo ?? '').trim(),
      admissionNo: String(student?.admissionNo ?? '').trim(),
      routeName,
      vehicleNo,
      pickupPoint: String(assignment.pickupPoint ?? '').trim(),
    })
  }
  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' }))
}

const attendanceRecordFor = (
  records: EduRecords,
  student: { studentId: string; studentName: string },
  date: string,
  trip: string,
): EduRow | undefined => (records.transportAttendance ?? []).find((row) =>
  attendanceRowKeyOf(row) === attendanceRowKey(date, trip, student.studentId, student.studentName))

const transportAttendanceSummary = (
  records: EduRecords,
  date: string,
  trip: string,
  routeName = '',
  vehicleNo = '',
) => {
  const expected = expectedTransportStudents(records, { routeName, vehicleNo })
  const counts = { expected: expected.length, pickedUp: 0, droppedOff: 0, absent: 0, latePickup: 0, exception: 0, notRecorded: 0 }
  const alerts: (ExpectedTransportStudent & { status: string })[] = []
  for (const student of expected) {
    const record = attendanceRecordFor(records, { studentId: student.studentId, studentName: student.studentName }, date, trip)
    const status = String(record?.status ?? '').trim()
    if (!status) {
      counts.notRecorded++
      alerts.push({ ...student, status: 'Not recorded' })
      continue
    }
    const value = status.toLocaleLowerCase()
    if (value === 'picked up') counts.pickedUp++
    else if (value === 'dropped off') counts.droppedOff++
    else if (value === 'late pickup') counts.latePickup++
    else if (value === 'exception') counts.exception++
    else {
      counts.absent++
      alerts.push({ ...student, status })
    }
  }
  return { ...counts, alerts }
}

/** Rate-card fields whose changes are written to Transport → Fee History. */
const FEE_TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: 'academicYear', label: 'Academic Year' },
  { key: 'term', label: 'Terms' },
  { key: 'routeName', label: 'Route' },
  { key: 'pickupPoint', label: 'Pickup point' },
  { key: 'vehicleCategory', label: 'Vehicle Category' },
  { key: 'feeStructure', label: 'Fee Structure' },
  { key: 'amount', label: 'Amount' },
  { key: 'discountPercent', label: 'Discount %' },
  { key: 'siblingSecondPercent', label: '2nd Sibling %' },
  { key: 'siblingThirdPercent', label: '3rd+ Sibling %' },
  { key: 'effectiveDate', label: 'Effective date' },
  { key: 'status', label: 'Status' },
]

/** Most specific approved rate card for a Route + Pickup point in the active year/term. */
const defaultTransportFeeFor = (records: EduRecords, routeName: string, pickupPoint: string): string => {
  const route = routeName.trim()
  if (!route) return ''
  const activeYear = (records.academicYear ?? []).find((row) => String(row.status ?? '').trim().toLocaleLowerCase() === 'active')
    || (records.academicYear ?? [])[0]
  const yearName = String(activeYear?.name ?? '').trim()
  const activeTerms = new Set((records.termSemester ?? [])
    .filter((row) => (!yearName || String(row.academicYear ?? '').trim() === yearName)
      && String(row.status ?? '').trim().toLocaleLowerCase() === 'active')
    .map((row) => String(row.name ?? '').trim())
    .filter(Boolean))
  const pickup = pickupPoint.trim()
  const candidates = (records.transportFees ?? []).filter((row) => {
    if (!transportFeeIsApproved(row)) return false
    const rowRoute = String(row.routeName ?? '').trim()
    if (rowRoute && rowRoute !== route) return false
    const rowPickup = String(row.pickupPoint ?? '').trim()
    if (rowPickup && pickup && rowPickup !== pickup) return false
    const rowYear = String(row.academicYear ?? '').trim()
    if (rowYear && yearName && rowYear !== yearName) return false
    const terms = multiSelectValues(row.term)
    if (terms.length && activeTerms.size && !terms.some((term) => activeTerms.has(term))) return false
    return true
  })
  if (!candidates.length) return ''
  const score = (row: EduRow) => (String(row.pickupPoint ?? '').trim() ? 2 : 0) + (String(row.routeName ?? '').trim() ? 1 : 0)
  const best = [...candidates].sort((a, b) => score(b) - score(a))[0]
  const termName = [...activeTerms][0] ?? ''
  const breakdown = transportFeeBreakdown(records, best, { name: '' }, termName, new Map())
  return breakdown.net > 0 ? breakdown.net.toFixed(2) : ''
}

import {
  buildLibraryMembers, memberStateOf, withAllMemberState, applyMemberPatch, applyAllMemberPatch,
  memberNameOptions, filterMemberRows, splitMemberStore, EXTERNAL_MEMBER_PREFIX,
  isOverdueLoan, isActiveLoan, todayISO, makeLoanFromRequest, settingsFrom, overdueFine, canIssueBook, computeLibraryStats, snapshotTitle, finesByMember, type MembershipState,
} from '../../../lib/library'
export {
  buildLibraryMembers, memberStateOf, withMemberState, withAllMemberState, applyMemberPatch, applyAllMemberPatch,
  memberNameOptions, filterMemberRows, splitMemberStore, EXTERNAL_MEMBER_PREFIX, type MembershipState,
} from '../../../lib/library'

export function buildMemberColumns(opts: {
  fields: FieldDef[]
  stateFor: (r: EduRow) => MembershipState
  onMember: (id: string, member: 'yes' | 'no') => void
  onStatus: (id: string, status: 'Active' | 'Inactive') => void
  allMembers: boolean
  onAllMembers: (member: 'yes' | 'no') => void
  finesFor?: (r: EduRow) => number
  /** Render a leading SL column numbered by on-screen position. */
  serialNumber?: boolean
}): Column<EduRow>[] {
  const { fields, stateFor, onMember, onStatus, allMembers, onAllMembers, finesFor, serialNumber } = opts
  return [
    // Leading SL (serial) column — mirrors buildLeafColumns so every list
    // that opts in numbers its rows the same way.
    ...(serialNumber ? [{
      key: '__serialNumber',
      header: 'SL',
      align: 'center' as const,
      headerClassName: 'w-12',
      render: (_r: EduRow, index: number) => (index >= 0 ? String(index + 1) : '—'),
    }] : []),
    ...fields.map((f) => ({
      key: f.key,
      header: f.label,
      sortValue: (r: EduRow) => String(r[f.key] ?? ''),
      render: (r: EduRow) => (String(r[f.key] ?? '').trim() ? String(r[f.key]) : <span className="text-mist">—</span>),
    })),
    {
      key: '__member',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            className="size-4 accent-lime"
            checked={allMembers}
            onChange={(e) => onAllMembers(e.target.checked ? 'yes' : 'no')}
            aria-label="Check all library members"
          />
          Member
        </span>
      ),
      align: 'center' as const,
      sortValue: (r: EduRow) => (stateFor(r).member === 'yes' ? 1 : 0),
      render: (r: EduRow) => (
        <input
          type="checkbox"
          className="size-4 accent-lime"
          checked={stateFor(r).member === 'yes'}
          onChange={(e) => onMember(r.id, e.target.checked ? 'yes' : 'no')}
          aria-label={`Library membership for ${r.name ?? ''}`}
        />
      ),
    },
    {
      key: '__status',
      header: 'Membership Status',
      sortValue: (r: EduRow) => stateFor(r).status,
      render: (r: EduRow) => (
        <Select value={stateFor(r).status} onChange={(e) => onStatus(r.id, e.target.value as 'Active' | 'Inactive')} aria-label={`Membership status for ${r.name ?? ''}`}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      ),
    },
    ...(finesFor
      ? [
          {
            key: '__fines',
            header: 'Outstanding Fines',
            sortValue: (r: EduRow) => finesFor(r),
            render: (r: EduRow) => {
              const v = finesFor(r)
              return v > 0 ? <span className="font-semibold text-rose-500">{formatGhs(v)}</span> : <span className="text-mist">—</span>
            },
          },
        ]
      : []),
  ]
}

/** DataTable columns for a leaf's fields, with optional status badges and an actions column. */
export function buildLeafColumns(
  leaf: { id?: string; fields: FieldDef[] },
  opts?: {
    actions?: (r: EduRow) => ReactNode
    badgeFor?: (r: EduRow, f: FieldDef) => ReactNode | undefined
    /** Render a leading SL column numbered by on-screen position. */
    serialNumber?: boolean
  },
): Column<EduRow>[] {
  const firstKey = leaf.fields[0]?.key
  return [
    ...(opts?.serialNumber ? [{
      key: '__serialNumber',
      header: 'SL',
      align: 'center' as const,
      headerClassName: 'w-12',
      render: (_r: EduRow, index: number) => (index >= 0 ? String(index + 1) : '—'),
    }] : []),
    ...leaf.fields
      .filter((f) => !(leaf.id === 'transportStoppage' && f.key === 'routeName') && !f.hideInTable)
      .map((f) => ({
      key: f.key,
      header: <span className="font-semibold text-inherit">{f.label}</span>,
      sortValue: (r: EduRow) => (f.type === 'number'
        ? Number(r[f.key] ?? 0)
        : f.type === 'multiselect'
          ? multiSelectValues(r[f.key]).join(', ')
          : leaf.id === 'transportRoutes' && f.key === 'startPlace'
            ? String(r.startPlace ?? '').trim() || parseTransportPickupPoints(r.pickupPoints)[0] || ''
            : leaf.id === 'transportRoutes' && f.key === 'stopPlace'
              ? String(r.stopPlace ?? '').trim() || parseTransportPickupPoints(r.pickupPoints).slice(-1)[0] || ''
              : leaf.id === 'transportRoutes' && f.key === 'pickupPoints'
                ? formatTransportPickupPoints(r[f.key])
                : String(r[f.key] ?? '')),
      align: (f.type === 'number' ? 'right' : undefined) as 'right' | undefined,
      render: (r: EduRow) => {
        const badge = opts?.badgeFor?.(r, f)
        if (badge) return badge
        if (f.type === 'image') {
          return String(r[f.key] ?? '').startsWith('data:') ? (
            <img src={String(r[f.key])} alt="" className="h-9 w-7 rounded object-cover" />
          ) : (
            <span className="text-mist">—</span>
          )
        }
        const v = f.type === 'multiselect'
          ? multiSelectValues(r[f.key]).join(', ')
          : f.type === 'time'
            ? formatTimeForDisplay(r[f.key])
            : leaf.id === 'transportRoutes' && f.key === 'startPlace'
              ? String(r.startPlace ?? '').trim() || parseTransportPickupPoints(r.pickupPoints)[0] || ''
              : leaf.id === 'transportRoutes' && f.key === 'stopPlace'
                ? String(r.stopPlace ?? '').trim() || parseTransportPickupPoints(r.pickupPoints).slice(-1)[0] || ''
                : leaf.id === 'transportRoutes' && f.key === 'pickupPoints'
                  ? formatTransportPickupPoints(r[f.key])
                  : String(r[f.key] ?? '').trim()
        return <span className={f.type === 'number' ? 'font-mono' : f.key === firstKey ? 'font-semibold' : ''}>{v || '—'}</span>
      },
    })),
    ...(opts?.actions
      ? [{ key: '__actions', header: '', align: 'right' as const, render: opts.actions }]
      : []),
  ]
}

/**
 * The Term/Semester rows the Academic module currently marks Active. The active
 * academic year narrows it down; if none is active the newest year is used, so
 * a school that never closed a year still gets a sensible answer.
 */
const activeTermNames = (records: EduRecords): string[] => {
  const years = records.academicYear ?? []
  const activeYear = years.find((row) => String(row.status ?? '').trim().toLocaleLowerCase() === 'active') || years[0]
  const yearName = String(activeYear?.name ?? '').trim()
  const terms = (records.termSemester ?? []).filter((row) =>
    String(row.status ?? '').trim().toLocaleLowerCase() === 'active'
      && (!yearName || String(row.academicYear ?? '').trim() === yearName),
  )
  const fallback = terms.length
    ? terms
    : (records.termSemester ?? []).filter((row) => !yearName || String(row.academicYear ?? '').trim() === yearName)
  return [...new Set(fallback.map((row) => String(row.name ?? '').trim()).filter(Boolean))]
}

/**
 * Side-by-side form layouts, keyed by `group/leaf`. Fields listed here share a
 * row on `sm` and up and stack below it; anything unlisted spans the full width.
 * Row pairing follows the field order in eduMenu.json, so two sixes sit
 * together and an eight is followed by a four.
 *
 * The classes are spelled out in full on purpose — Tailwind only scans source
 * for literal strings, so `sm:col-span-${n}` would never be generated.
 */
const FORM_FIELD_SPANS: Record<string, Record<string, string>> = {
  'studentAccommodation/hostelList': {
    hostelName: 'sm:col-span-8',
    location: 'sm:col-span-8',
    hostelType: 'sm:col-span-4',
    capacity: 'sm:col-span-4',
  },
  'studentAccommodation/studentHostelAllocation': {
    hostelName: 'sm:col-span-8',
    roomNumber: 'sm:col-span-4',
    academicYear: 'sm:col-span-6',
    terms: 'sm:col-span-6',
    allocationDate: 'sm:col-span-6',
    status: 'sm:col-span-6',
  },
  'transport/transportStoppage': {
    stoppageName: 'sm:col-span-8',
    routeFare: 'sm:col-span-4',
    pickupTime: 'sm:col-span-6',
    stopOrder: 'sm:col-span-6',
  },
  'transport/transportRoutes': {
    departureTime: 'sm:col-span-6',
    returnTime: 'sm:col-span-6',
    fare: 'sm:col-span-6',
    status: 'sm:col-span-6',
  },
  // Exam Type with Term, and Publish with Publish Result.
  'examinations/examSetup': {
    examType: 'sm:col-span-6',
    term: 'sm:col-span-6',
    publish: 'sm:col-span-6',
    publishResult: 'sm:col-span-6',
  },
  // Marksheet Template: 4 of 12 columns puts three fields on a row, collapsing
  // to one per row below the `sm` breakpoint. The content editors and the
  // option checkboxes stay full width — they need the room.
  'examinations/marksheetTemplate': {
    examName: 'sm:col-span-4',
    templateName: 'sm:col-span-4',
    pageLayout: 'sm:col-span-4',
    photoStyle: 'sm:col-span-4',
    topSpace: 'sm:col-span-4',
    bottomSpace: 'sm:col-span-4',
    rightSpace: 'sm:col-span-4',
    leftSpace: 'sm:col-span-4',
    leftSignature: 'sm:col-span-4',
    middleSignature: 'sm:col-span-4',
    rightSignature: 'sm:col-span-4',
    logoImage: 'sm:col-span-4',
    backgroundImage: 'sm:col-span-4',
    headerContent: 'sm:col-span-12',
    footerContent: 'sm:col-span-12',
    reportOptions: 'sm:col-span-12',
  },
  'certificate/templates': {
    templateName: 'sm:col-span-6',
    certificateType: 'sm:col-span-6',
    pageLayout: 'sm:col-span-4',
    paperSize: 'sm:col-span-4',
    orientation: 'sm:col-span-4',
    marginFilter: 'sm:col-span-4',
    borderStyle: 'sm:col-span-4',
    pattern: 'sm:col-span-4',
    backgroundColor: 'sm:col-span-6',
    backgroundImage: 'sm:col-span-6',
    certificateData: 'sm:col-span-12',
  },
  'certificate/generation': {
    certificateNo: 'sm:col-span-4',
    student: 'sm:col-span-4',
    certificateType: 'sm:col-span-4',
    template: 'sm:col-span-4',
    issueDate: 'sm:col-span-4',
    expiryDate: 'sm:col-span-4',
    status: 'sm:col-span-4',
    remarks: 'sm:col-span-8',
  },
  'certificate/bulk-generation': {
    batchName: 'sm:col-span-6',
    certificateType: 'sm:col-span-6',
    template: 'sm:col-span-6',
    className: 'sm:col-span-6',
    totalStudents: 'sm:col-span-4',
    issueDate: 'sm:col-span-4',
    status: 'sm:col-span-4',
  },
  'certificate/verification': {
    certificateNo: 'sm:col-span-6',
    student: 'sm:col-span-6',
    certificateType: 'sm:col-span-4',
    issueDate: 'sm:col-span-4',
    status: 'sm:col-span-4',
  },
  'certificate/reports': {
    title: 'sm:col-span-6',
    reportType: 'sm:col-span-6',
    fromDate: 'sm:col-span-4',
    toDate: 'sm:col-span-4',
    certificateType: 'sm:col-span-4',
  },
  'certificate/settings': {
    settingName: 'sm:col-span-6',
    certificateType: 'sm:col-span-6',
    autoNumbering: 'sm:col-span-4',
    serialPrefix: 'sm:col-span-4',
    qrCode: 'sm:col-span-4',
    digitalSignature: 'sm:col-span-4',
    status: 'sm:col-span-4',
  },
}

/**
 * The Publish / Publish Result switch from the Exam Setup list. The knob is
 * deliberately larger than the track and sits flush right when on, matching
 * the switch in the reference screenshot.
 */
function PublishToggle({ on, label, onChange }: {
  on: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative inline-flex h-[18px] w-[46px] flex-none items-center rounded-full transition-colors"
      style={{ backgroundColor: on ? '#96bbd1' : 'rgb(120 120 128 / 0.25)' }}
    >
      <span
        aria-hidden
        className="absolute top-1/2 size-[26px] -translate-y-1/2 rounded-full shadow-sm transition-all"
        style={{ backgroundColor: on ? '#3c8dbc' : '#9a9aa2', left: on ? 'calc(100% - 26px)' : '0px' }}
      />
    </button>
  )
}

/** Sample rows for the Marksheet Template preview — placeholders, not live marks. */
/** Subjects shown on the sample sheet. */
const MARKSHEET_PREVIEW_SUBJECTS = [
  'Mathematics', 'English Language', 'Integrated Science', 'Social Studies',
  'Information & Communication Technology',
]
/** One mark column on the sheet: its name and the marks it is scored out of. */
type MarkPart = { name: string; max: number }

/** Columns used when no exam — or an exam with no distribution — is chosen. */
const MARKSHEET_PREVIEW_PARTS: MarkPart[] = [
  { name: 'Class Work', max: 20 }, { name: 'Home Work', max: 20 }, { name: 'Exams', max: 60 },
]
/** How well the sample pupil does in each subject, as a fraction of the max. */
const MARKSHEET_PREVIEW_SCORES = [0.90, 0.85, 0.78, 0.78, 0.95]

/**
 * Turn component names into mark columns, reading each one's Max Marks from the
 * Mark Distribution register so a component recorded as 50 really is scored out
 * of 50. Anything with no figure recorded falls back to an even share of 100,
 * so a column is never left without a maximum.
 */
const resolveMarkParts = (names: string[], distribution: EduRow[]): MarkPart[] => {
  const evenShare = Math.max(1, Math.round(100 / Math.max(1, names.length)))
  return names.map((name) => {
    const match = distribution.find((row) => String(row.name ?? '').trim() === String(name).trim())
    const configured = Number(String(match?.maxMarks ?? '').trim())
    return { name, max: Number.isFinite(configured) && configured > 0 ? configured : evenShare }
  })
}

/** Grades are earned on a percentage, so an exam out of 60 or 200 still reads right. */
const gradeForTotal = (total: number, max: number) => {
  const pct = max > 0 ? (total / max) * 100 : 0
  return pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F'
}

/**
 * Build the sample marks for the sheet. The columns and their maxima come from
 * the selected exam's Mark Distribution, so an "SBA (50%)" column is scored out
 * of 50 rather than an even share of 100, and the total is out of whatever the
 * chosen components add up to.
 */
const buildMarksheetRows = (components: MarkPart[]) => {
  const maxMarks = components.reduce((sum, c) => sum + c.max, 0)
  return MARKSHEET_PREVIEW_SUBJECTS.map((subject, si) => {
    const parts = components.map((component, ci) => {
      // Vary a little per component so the columns don't read as identical.
      const wobble = ci % 2 === 0 ? 0.02 : -0.03
      const score = Math.round(component.max * (MARKSHEET_PREVIEW_SCORES[si] + wobble))
      return String(Math.max(1, Math.min(component.max, score)))
    })
    const total = parts.reduce((sum, v) => sum + Number(v), 0)
    return { subject, parts, total: String(total), grade: gradeForTotal(total, maxMarks) }
  })
}

/**
 * Live preview of the sheet a Marksheet Template will print. Every student
 * detail is rendered label-above-value, and the page flips between portrait
 * and landscape with the template's Page Layout.
 */
/**
 * Image fields drawn as a single-line "Select file" control instead of the
 * tall dropzone — used where several upload slots sit in one form and the big
 * variant would push everything else below the fold.
 */
const compactImageField = (leafId: string, f: FieldDef) =>
  f.display === 'file' || (leafId === 'transportVehicles' && f.key === 'vehiclePhoto')

/**
 * Placeholders a Marksheet Template header or footer may embed. They are
 * substituted with the real values when a sheet is printed for a student.
 */
const MARKSHEET_CONTENT_TOKENS = [
  'name', 'gender', 'father_name', 'mother_name', 'student_photo', 'register_no',
  'academic_session', 'roll', 'admission_date', 'class', 'section', 'category',
  'cast', 'religion', 'blood_group', 'birthday', 'email', 'phone',
  'student_address', 'permanent_address', 'exam_name', 'left_signature',
  'middle_signature', 'right_signature', 'print_date', 'principal_comments',
  'teacher_comments', 'logo', 'institute_name', 'institute_address',
  'institute_email', 'institute_phone_no',
]

/**
 * A textarea plus a row of {token} chips. Clicking a chip drops that token in
 * at the caret, so a header or footer can be assembled without hand-typing
 * braces — and the caret lands after the inserted token for the next one.
 */
function ContentFieldWithTokens({ value, rows = 3, ariaLabel, onChange }: {
  value: string
  rows?: number
  ariaLabel: string
  onChange: (next: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const insert = (token: string) => {
    const snippet = `{${token}}`
    const start = ref.current?.selectionStart ?? value.length
    const end = ref.current?.selectionEnd ?? value.length
    onChange(`${value.slice(0, start)}${snippet}${value.slice(end)}`)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      const caret = start + snippet.length
      el.setSelectionRange(caret, caret)
    })
  }
  return (
    <div className="grid gap-2.5">
      <div className="relative">
        <Textarea
          ref={ref}
          rows={rows}
          value={value}
          aria-label={ariaLabel}
          placeholder="Type static text, or click a placeholder below to insert it"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-lime-500 focus:ring-2 focus:ring-lime-200 transition"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 p-2.5">
        {MARKSHEET_CONTENT_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insert(token)}
            title={`Insert {${token}}`}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-600 shadow-sm transition hover:border-lime-400 hover:bg-lime-50 hover:text-lime-800 hover:shadow"
          >
            {`{${token}}`}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Sample values used to resolve {tokens} in the live preview, so a template
 * reads the way it will actually print instead of showing raw braces.
 */
const MARKSHEET_TOKEN_SAMPLES: Record<string, string> = {
  name: 'Ama Owusu', gender: 'Female', father_name: 'Kwame Owusu', mother_name: 'Akosua Owusu',
  register_no: 'ADM-001', academic_session: '2026/2027', roll: '07', admission_date: '2024-09-02',
  class: 'Basic 7 A', section: 'A', category: 'General', cast: '—', religion: 'Christian',
  blood_group: 'O+', birthday: '2013-04-18', email: 'ama.owusu@example.edu.gh', phone: '024 555 0101',
  student_address: '12 Liberation Road, Accra', permanent_address: '12 Liberation Road, Accra',
  exam_name: 'First Term Examination', term: 'Term 1', print_date: '—',
  principal_comments: 'Excellent conduct — keep it up.', teacher_comments: 'A very promising term.',
  institute_address: 'Accra, Greater Accra', institute_email: 'info@example.edu.gh',
  institute_phone_no: '030 222 4455',
}

/** Tokens the preview draws as an image or a placeholder box rather than text. */
const MARKSHEET_BOX_TOKENS = ['logo', 'student_photo', 'left_signature', 'middle_signature', 'right_signature']

const StudentDetailsRow = ({ samples, photoShape, photoPx, label, value }: { samples: Record<string, string>; photoShape: string | null; photoPx: number; label: React.CSSProperties; value: React.CSSProperties }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flex: 1 }}>
      {[['STUDENT NAME', samples.name], ['ADMISSION NO', samples.register_no], ['CLASS', samples.class], ['TERM', samples.term ?? 'Term 1'], ['EXAM', samples.exam_name]]
        .map(([l, v]) => (
          <div key={l}><div style={label}>{l}</div><div style={value}>{v}</div></div>
        ))}
    </div>
    {photoShape ? (
      <div style={{ width: photoPx, height: photoPx, flex: 'none', background: '#e7e7e0', border: '1px solid #cfcfc6', borderRadius: photoShape === 'round' ? '50%' : 3 }} />
    ) : null}
  </div>
)

function MarksheetPreview({
  templateName, pageLayout, backgroundImage, schoolName, photoStyle,
  topSpace, bottomSpace, rightSpace, leftSpace,
  headerContent, middleContent, footerContent, reportOptions, parts, examName,
  logoImage, leftSignature, middleSignature, rightSignature,
  showHeader = true, showMiddle = true, showFooter = true,
  headerAlignments, middleAlignments, footerAlignments,
}: {
  templateName: string
  pageLayout: string
  backgroundImage: string
  schoolName: string
  /** Mark columns and their maxima, from the selected exam's Mark Distribution. */
  parts?: MarkPart[]
  /** The chosen exam, so `{exam_name}` in the header names the exam being previewed. */
  examName?: string
  photoStyle?: string
  topSpace?: string
  bottomSpace?: string
  rightSpace?: string
  leftSpace?: string
  headerContent?: string
  middleContent?: string
  footerContent?: string
  reportOptions?: string
  logoImage?: string
  leftSignature?: string
  middleSignature?: string
  rightSignature?: string
  /** False when the template's Header section is closed, so no header renders at all. */
  showHeader?: boolean
  /** False when Middle is closed. */
  showMiddle?: boolean
  /** False when the template's Footer section is closed, so no footer renders at all. */
  showFooter?: boolean
  headerAlignments?: string
  middleAlignments?: string
  footerAlignments?: string
}) {
  const landscape = String(pageLayout ?? '').trim().toLocaleLowerCase() === 'landscape'
  // A4 at 72dpi, drawn at full size then scaled down so the text stays crisp.
  const designW = landscape ? 842 : 595
  const designH = landscape ? 595 : 842
  /**
   * The design is measured in A4's point dimensions, but a printed page is laid
   * out in CSS pixels at 96 per inch against a 72-per-inch page — so the sheet
   * has to be scaled by 96/72 to fill A4. Taking the smaller of the two ratios
   * keeps it inside the page on both axes, so it can never spill onto a second
   * blank sheet.
   */
  const printScale = Math.min(
    (landscape ? 1122.52 : 793.7) / designW,
    (landscape ? 793.7 : 1122.52) / designH,
  )
  // Zoom: 100% draws the sheet at the size that fills the preview column, so
  // the control reads as "how much bigger than fitted am I looking".
  const [zoom, setZoom] = useState(1)
  const fitScale = landscape ? 0.36 : 0.5
  const scale = fitScale * zoom
  const setZoomClamped = (next: number) => setZoom(Math.min(2, Math.max(0.5, next)))
  const zoomBy = (delta: number) => setZoom((z) => Math.min(2, Math.max(0.5, z + delta)))

  // Print the sheet at its real A4 size. The browser's own dialog does the
  // work, so "Save as PDF" produces a true-scale page rather than a
  // screenshot of the scaled-down preview.
  const printSheet = () => {
    const previous = document.title
    const name = String(templateName ?? '').trim() || 'Marksheet Template'
    document.title = `${name} — Marksheet`
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }
  const bg = String(backgroundImage ?? '').trim()

  // Layout Spacing drives the sheet's own margins, clamped so a stray value
  // cannot swallow the whole page.
  const margin = (raw: unknown, fallback: number) => {
    const n = Number(String(raw ?? '').trim())
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 90) : fallback
  }
  const pad = {
    top: margin(topSpace, 28), bottom: margin(bottomSpace, 28),
    right: margin(rightSpace, 28), left: margin(leftSpace, 28),
  }

  // Report Options decide which blocks appear at all — ticking one shows its
  // block, clearing it hides the block again.
  const picked = multiSelectValues(reportOptions).map((v) => String(v).trim().toLocaleLowerCase())
  const has = (name: string) => picked.includes(name.toLocaleLowerCase())

  // Photo Style reads "Square - 320": shape plus a nominal pixel size.
  const photo = /^(square|round)\s*-\s*(\d+)$/i.exec(String(photoStyle ?? '').trim())
  const photoShape = (photo?.[1] ?? '').toLocaleLowerCase()
  const photoPx = photo ? Math.max(18, Math.round(Number(photo[2]) / 8)) : 0

  const boxImage: Record<string, string> = {
    logo: String(logoImage ?? ''),
    left_signature: String(leftSignature ?? ''),
    middle_signature: String(middleSignature ?? ''),
    right_signature: String(rightSignature ?? ''),
  }
  const samples: Record<string, string> = {
    ...MARKSHEET_TOKEN_SAMPLES,
    institute_name: String(schoolName ?? '').trim() || 'School',
    // The columns already follow the selected exam, so the name in the header
    // has to be that exam's too — not a fixed sample.
    ...(String(examName ?? '').trim() ? { exam_name: String(examName).trim() } : {}),
  }

  const label: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.4, color: '#6b7280', marginBottom: 2,
  }
  const value: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#16325c' }
  const cell: React.CSSProperties = {
    border: '1px solid #d7d7d0', padding: '4px 6px', fontSize: 10, color: '#16325c',
  }

  /** A {placeholder} that stands for an image: the logo, the photo, a signature. */
  const renderBoxToken = (token: string, key: string) => {
    if (token === 'student_photo') {
      if (!photoShape) return null
      return <div key={key} style={{ width: photoPx, height: photoPx, background: '#e7e7e0',
        borderRadius: photoShape === 'round' ? '50%' : 3, border: '1px solid #cfcfc6' }} />
    }
    const src = boxImage[token] ?? ''
    const h = token === 'logo' ? 34 : 24
    return src.startsWith('data:')
      ? <img key={key} src={src} alt={token} style={{ height: h, objectFit: 'contain' }} />
      : <div key={key} style={{ height: h, minWidth: token === 'logo' ? 46 : 62, display: 'inline-block',
          border: '1px dashed #c9c9c0', borderRadius: 3, fontSize: 7, color: '#9ca3af',
          textAlign: 'center', lineHeight: `${h}px` }}>{token.replace(/_/g, ' ')}</div>
  }

  /** Substitute the real values for any {token} that resolves to text. */
  const resolveLineText = (text: string) =>
    text.replace(/\{([a-z_]+)\}/gi, (whole, t) => samples[String(t).toLocaleLowerCase()] ?? whole)

  const parseAlign = (raw: unknown): ('left'|'center'|'right')[] => {
    try {
      const arr = JSON.parse(String(raw ?? '[]'))
      return Array.isArray(arr) ? arr.map((v) => (['left','center','right'].includes(String(v)) ? String(v) as any : 'left')) : []
    } catch { return [] }
  }
  const headerAligns = parseAlign(headerAlignments)
  const middleAligns = parseAlign(middleAlignments)
  const footerAligns = parseAlign(footerAlignments)

  const textLine = (text: string, key: string, align: 'left'|'center'|'right' = 'left') =>
    <div key={key} style={{ fontSize: 10, minHeight: 12, color: '#16325c', textAlign: align }}>{resolveLineText(text) || ' '}</div>

  /**
   * One line of Header/Footer content. A line that is exactly one image
   * placeholder becomes that image. A line that MIXES placeholders and words
   * ("{left_signature}   {right_signature}") renders each placeholder as its
   * image inline, so a footer can set several holders side by side rather than
   * printing the braces as text. Anything else is text with tokens resolved.
   */
  const renderContentLine = (line: string, key: number, align: 'left'|'center'|'right' = 'left') => {
    const text = String(line ?? '').trim()
    const only = /^\{([a-z_]+)\}$/i.exec(text)
    const token = only?.[1]?.toLocaleLowerCase() ?? ''
    if (token === 'student_details') {
      return <div key={key} style={{ textAlign: align }}><StudentDetailsRow samples={samples} photoShape={photoShape} photoPx={photoPx} label={label} value={value} /></div>
    }
    if (token && (token === 'student_photo' || MARKSHEET_BOX_TOKENS.includes(token))) {
      return <div key={key} style={{ textAlign: align }}>{renderBoxToken(token, String(key))}</div>
    }
    if (token) return textLine(text, String(key), align)

    const holders = [...text.matchAll(/\{[a-z_]+\}/gi)]
    const isHolder = (raw: string) => MARKSHEET_BOX_TOKENS.includes(raw.slice(1, -1).toLocaleLowerCase())
    if (holders.some((m) => isHolder(m[0]))) {
      const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
      const parts = text.split(/\{[a-z_]+\}/i)
      return (
        <div key={key} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', justifyContent: justify }}>
          {parts.map((part, i) => (
            <Fragment key={i}>
              {part.trim() ? <span style={{ fontSize: 10, color: '#16325c' }}>{resolveLineText(part.trim())}</span> : null}
              {holders[i]
                ? (isHolder(holders[i][0])
                    ? renderBoxToken(holders[i][0].slice(1, -1).toLocaleLowerCase(), `box-${i}`)
                    : <span style={{ fontSize: 10, color: '#16325c' }}>{resolveLineText(holders[i][0])}</span>)
                : null}
            </Fragment>
          ))}
        </div>
      )
    }
    return textLine(text, String(key), align)
  }

  const contentLines = (raw: unknown) =>
    String(raw ?? '').split('\n').filter((l, i, a) => a.length > 1 || l.trim())
  const headerLines = contentLines(headerContent)
  const middleLines = contentLines(middleContent)
  const footerLines = contentLines(footerContent)

  /**
   * Footer lines are grouped into columns: a blank line starts a new column and
   * the lines within a column stack vertically. That is what puts a signature's
   * caption underneath its holder — "{left_signature}" followed by "Class
   * Teacher" reads as a signed line with the role beneath it, instead of the
   * two ending up side by side.
   */
  const footerGroups = (() => {
    const groups: string[][] = []
    let current: string[] = []
    for (const line of footerLines) {
      if (!String(line ?? '').trim()) {
        if (current.length) { groups.push(current); current = [] }
        continue
      }
      current.push(line)
    }
    if (current.length) groups.push(current)
    return groups
  })()
  /**
   * True for a line carrying an image placeholder. A line may hold one token or
   * several side by side ("{left_signature}   {middle_signature}"), so this
   * looks for any placeholder rather than requiring the line to be exactly one.
   */
  const isBoxLine = (line: string) =>
    MARKSHEET_BOX_TOKENS.some((token) => String(line ?? '').includes(`{${token}}`))
  // Signature holders spread across the sheet; anything else (a "Printed …" line)
  // sits underneath rather than competing for the same row.
  const signatureGroups = footerGroups.filter((group) => group.some(isBoxLine))
  const trailingGroups = footerGroups.filter((group) => !group.some(isBoxLine))

  // Blocks toggled by Report Options.
  const summary: { label: string; value: string }[] = []
  if (has('Attendance Percentage')) summary.push({ label: 'Attendance', value: '96%' })
  if (has('Position')) summary.push({ label: 'Position', value: '3rd of 32' })
  if (has('Cumulative Average')) summary.push({ label: 'Cumulative Average', value: '82.4' })
  if (has('Class Average')) summary.push({ label: 'Class Average', value: '74.1' })
  if (has('Result')) summary.push({ label: 'Result', value: 'PASS' })

  const showSubjectPosition = has('Subject Position')
  const showGrading = has('Grading Scale')
  const showRemark = has('Remark')

  // The marks columns follow the selected exam's Mark Distribution.
  const components = parts?.filter((p) => String(p.name ?? '').trim()).length ? parts! : MARKSHEET_PREVIEW_PARTS
  const rows = buildMarksheetRows(components)
  const maxMarks = components.reduce((sum, c) => sum + c.max, 0)
  const totalOf = (i: number) => String(rows.reduce((s, r) => s + Number(r.parts[i] ?? 0), 0))

  // One description of the sheet, drawn twice: scaled down for the on-screen
  // preview and at true A4 size for the print output, so the two can never
  // drift apart.
  const sheetStyle: React.CSSProperties = {
    width: designW, height: designH, color: '#16325c',
    padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
    backgroundImage: bg.startsWith('data:') ? `url("${bg}")` : undefined,
    backgroundSize: 'cover', backgroundPosition: 'center',
    display: 'flex', flexDirection: 'column', gap: 8,
  }
  const sheetContent = (
    <>
          {showHeader ? (
            <>
              {/* Header — the template's own content, or the built-in default. */}
              <div style={{ borderBottom: '2px solid #16325c', paddingBottom: 6 }}>
                {headerLines.length
                  ? headerLines.map((line, i) => renderContentLine(line, i, (headerAligns[i] as any) || 'left'))
                  : (<>
                      <div style={{ fontSize: 17, fontWeight: 800, textAlign: 'center' }}>{samples.institute_name}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>Terminal Report · Mark Sheet</div>
                    </>)}
              </div>
            </>
          ) : null}

          {showMiddle ? (
            middleLines.length ? (
              <>
                {middleLines.map((line, idx) => {
                  const t = String(line ?? '').trim()
                  const m = /^\{([a-z_]+)\}$/i.exec(t)
                  const tok = m?.[1]?.toLocaleLowerCase() ?? ''
                  if (tok === 'marks_table') {
                    return (
                      <table key={idx} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                        <thead>
                          <tr>
                            <th style={{ ...cell, textAlign: 'left', background: '#f1f1ec' }}>Subject</th>
                            {components.map((p) => (
                              <th key={p.name} style={{ ...cell, background: '#f1f1ec' }}>
                                {p.name}
                                <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{p.max}</div>
                              </th>
                            ))}
                            <th style={{ ...cell, background: '#f1f1ec' }}>
                              Total
                              <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{maxMarks}</div>
                            </th>
                            <th style={{ ...cell, background: '#f1f1ec' }}>Grade</th>
                            {showSubjectPosition && <th style={{ ...cell, background: '#f1f1ec' }}>Pos</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.subject}>
                              <td style={cell}>{r.subject}</td>
                              {r.parts.map((p, j) => <td key={j} style={{ ...cell, textAlign: 'center' }}>{p}</td>)}
                              <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
                              <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r.grade}</td>
                              {showSubjectPosition && <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>}
                            </tr>
                          ))}
                          <tr>
                            <td style={{ ...cell, background: '#f1f1ec' }} />
                            {components.map((p, i) => (
                              <td key={p.name} style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                                {totalOf(i)}
                              </td>
                            ))}
                            <td style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                              {String(rows.reduce((s, r) => s + Number(r.total ?? 0), 0))}
                            </td>
                            <td style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>—</td>
                            {showSubjectPosition && <td style={{ ...cell, background: '#f1f1ec' }} />}
                          </tr>
                        </tbody>
                      </table>
                    )
                  }
                  if (tok === 'attendance') return <div key={idx}><div style={label}>Attendance</div><div style={value}>96%</div></div>
                  if (tok === 'position') return <div key={idx}><div style={label}>Position</div><div style={value}>3rd of 32</div></div>
                  if (tok === 'cumulative_average') return <div key={idx}><div style={label}>Cumulative Average</div><div style={value}>82.4</div></div>
                  if (tok === 'class_average') return <div key={idx}><div style={label}>Class Average</div><div style={value}>74.1</div></div>
                  if (tok === 'result') return <div key={idx}><div style={label}>Result</div><div style={value}>PASS</div></div>
                  if (tok === 'grading_scale') return <div key={idx} style={{ fontSize: 9, color: '#6b7280', borderTop: '1px solid #e3e3dc', paddingTop: 4 }}>Grading scale · A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D 50–59 · F below 50</div>
                  if (tok === 'remark') return <div key={idx}><div style={label}>Class Teacher&apos;s Remark</div><div style={{ ...value, fontSize: 11 }}>{samples.teacher_comments}</div></div>
                  if (tok === 'subject_position') return null
                  return renderContentLine(line, idx, (middleAligns[idx] as any) || 'left')
                })}
              </>
            ) : (
              <>
                {/* Fallback for old templates without middleContent — same as before */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flex: 1 }}>
                    {[['Student Name', samples.name], ['Admission No', samples.register_no],
                      ['Class', samples.class], ['Term', 'Term 1'], ['Exam', samples.exam_name]]
                      .map(([l, v]) => (
                        <div key={l}><div style={label}>{l}</div><div style={value}>{v}</div></div>
                      ))}
                  </div>
                  {photoShape ? (
                    <div style={{ width: photoPx, height: photoPx, flex: 'none', background: '#e7e7e0',
                      border: '1px solid #cfcfc6', borderRadius: photoShape === 'round' ? '50%' : 3 }} />
                  ) : null}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ ...cell, textAlign: 'left', background: '#f1f1ec' }}>Subject</th>
                      {components.map((p) => (
                        <th key={p.name} style={{ ...cell, background: '#f1f1ec' }}>
                          {p.name}
                          <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{p.max}</div>
                        </th>
                      ))}
                      <th style={{ ...cell, background: '#f1f1ec' }}>
                        Total
                        <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{maxMarks}</div>
                      </th>
                      <th style={{ ...cell, background: '#f1f1ec' }}>Grade</th>
                      {showSubjectPosition && <th style={{ ...cell, background: '#f1f1ec' }}>Pos</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.subject}>
                        <td style={cell}>{r.subject}</td>
                        {r.parts.map((p, j) => <td key={j} style={{ ...cell, textAlign: 'center' }}>{p}</td>)}
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r.grade}</td>
                        {showSubjectPosition && <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>}
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...cell, background: '#f1f1ec' }} />
                      {components.map((p, i) => (
                        <td key={p.name} style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                          {totalOf(i)}
                        </td>
                      ))}
                      <td style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                        {String(rows.reduce((s, r) => s + Number(r.total ?? 0), 0))}
                      </td>
                      <td style={{ ...cell, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>—</td>
                      {showSubjectPosition && <td style={{ ...cell, background: '#f1f1ec' }} />}
                    </tr>
                  </tbody>
                </table>
                {summary.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {summary.map((s) => (
                      <div key={s.label}><div style={label}>{s.label}</div><div style={value}>{s.value}</div></div>
                    ))}
                  </div>
                ) : null}
                {showGrading ? (
                  <div style={{ fontSize: 9, color: '#6b7280', borderTop: '1px solid #e3e3dc', paddingTop: 4 }}>
                    Grading scale · A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D 50–59 · F below 50
                  </div>
                ) : null}
                {showRemark ? (
                  <div>
                    <div style={label}>Class Teacher&apos;s Remark</div>
                    <div style={{ ...value, fontSize: 11 }}>{samples.teacher_comments}</div>
                  </div>
                ) : null}
              </>
            )
          ) : null}

          {showFooter ? (
            <>
              {/* Footer content, including any signature images. */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #e3e3dc', paddingTop: 6 }}>
                {footerGroups.length
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {signatureGroups.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          {signatureGroups.map((group, gi) => (
                            /* Each holder is a column: the signature on top, its caption beneath. */
                            <div key={`sig-${gi}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              {group.map((line, li) => renderContentLine(line, li, (footerAligns[li] as any) || 'left'))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {trailingGroups.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {trailingGroups.map((group, gi) => group.map((line, li) => renderContentLine(line, li, (footerAligns[li] as any) || 'left')))}
                        </div>
                      ) : null}
                    </div>
                  : (<div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <div><div style={label}>Class Teacher&apos;s Remark</div><div style={value}>&nbsp;</div></div>
                      <div><div style={label}>Head of School</div><div style={value}>&nbsp;</div></div>
                    </div>)}
              </div>
            </>
          ) : null}

          <div style={{ fontSize: 8, color: '#9ca3af' }}>
            {String(templateName ?? '').trim() || 'Untitled template'}
          </div>
    </>

  )

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-mist">
          Live preview · {landscape ? 'A4 Landscape' : 'A4 Portrait'}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            title="Reset zoom to fit"
            className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist transition hover:border-lime hover:text-inherit disabled:opacity-40"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={printSheet}
            title="Print this template at true A4 size"
            className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist transition hover:border-lime hover:text-inherit"
          >
            <Printer className="size-3" /> Print
          </button>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => zoomBy(-0.1)}
          disabled={zoom <= 0.5}
          aria-label="Zoom out"
          title="Zoom out"
          className="size-5 shrink-0 rounded border border-line text-xs font-bold leading-none text-mist transition hover:border-lime hover:text-inherit disabled:opacity-40"
        >
          −
        </button>
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoomClamped(Number(e.target.value) / 100)}
          aria-label="Preview zoom"
          className="min-w-0 flex-1 accent-lime"
        />
        <button
          type="button"
          onClick={() => zoomBy(0.1)}
          disabled={zoom >= 2}
          aria-label="Zoom in"
          title="Zoom in"
          className="size-5 shrink-0 rounded border border-line text-xs font-bold leading-none text-mist transition hover:border-lime hover:text-inherit disabled:opacity-40"
        >
          +
        </button>
        <span className="w-9 shrink-0 text-right text-[10px] font-semibold text-mist">
          {Math.round(zoom * 100)}%
        </span>
      </div>
      {/* Zooming past the column has to scroll rather than clip the sheet. */}
      <div className="max-h-[58vh] overflow-auto">
        <div
          className="mx-auto overflow-hidden rounded bg-white shadow-sm"
          style={{ width: designW * scale, height: designH * scale }}
        >
          <div
            style={{
              width: designW, height: designH,
              transform: `scale(${scale})`, transformOrigin: 'top left',
            }}
          >
            <div style={sheetStyle}>{sheetContent}</div>
          </div>
        </div>
      </div>
      {/* Print output: the same sheet, portalled to <body> so the print
          stylesheet can show it and hide everything else. The design is sized
          in A4's POINT dimensions (595 × 842) but CSS lays out in pixels at 96
          per inch while a PDF page is 72 per inch — printing it unscaled would
          render the sheet at three quarters of the page, adrift in the top-left
          corner. Scaling by 96/72 maps the design onto the real A4 box, so the
          printout is laid out exactly as the preview shows it. */}
      {createPortal(
        <div className="marksheet-print-root">
          <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
          <div
            style={{
              width: designW * printScale, height: designH * printScale, overflow: 'hidden',
            }}
          >
            <div
              style={{
                ...sheetStyle,
                transform: `scale(${printScale})`, transformOrigin: 'top left',
              }}
            >
              {sheetContent}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Drag & Drop Sheet designer
 *
 * Builds a marksheet by dragging blocks into two stacked bands — Header and
 * Footer — and ticking the report options that sit between them. The design is
 * written back into the template's own fields (Header Content, Footer Content
 * and Report Options), so a designed sheet is just an ordinary template record:
 * the normal form can reopen and edit it, and print renders it unchanged.
 * ------------------------------------------------------------------------ */

/** One line of a band: either a {token} placeholder or a piece of literal text.
 * `inline` means this block sits on the same printed line as the previous one,
 * so two or more blocks can be placed side-by-side (e.g. three signatures). */
type SheetBlock = { uid: string; token: string; text?: string; inline?: boolean; align?: 'left' | 'center' | 'right' }
type PaletteItem = { token: string; label: string; custom?: boolean; presetText?: string }
type BandKey = 'header' | 'middle' | 'footer'
/** What is being dragged: a fresh block from the palette, or one already placed. */
type DesignerDrag =
  | { from: 'palette'; item: PaletteItem }
  | { from: 'band'; band: BandKey; index: number }
  /** A closed Header/Footer section, dragged back out of the Blocks list. */
  | { from: 'section'; band: BandKey }


/* ---------------------------------------------------------------------------
 * New Marksheet Template modal matching attached reference (Examination)
 * Left: form fields (Exam Name, Template Name, Page Layout, Photo Style, Spaces,
 * Signatures, Logo, Background, Header Content with tokens, Alignments, Middle,
 * Footer, Report Options)
 * Right: Live Preview A4 Portrait/Landscape
 * ------------------------------------------------------------------------ */
const MARKSHEET_DEFAULT_HEADER = '{logo}\n{institute_name}\n{institute_address} · {institute_phone_no} · {institute_email}\n{exam_name}'
const MARKSHEET_DEFAULT_MIDDLE = '{student_details}\n{marks_table}\n{attendance}\n{grading_scale}\n{teacher_comments}\n{principal_comments}'
const MARKSHEET_DEFAULT_FOOTER = '{left_signature}\nClass Teacher\n\n{middle_signature}\nHead of School\n\n{right_signature}\nPrincipal\n\nPrinted {print_date}'

/* ---------------------------------------------------------------------------
 * Redesigned Marksheet Template Builder — clean, based on PDF reference
 * Cleared old modals and rebuilt with better UX:
 * - Top: Template Name, Exam Name, Page Layout
 * - Main: Blocks palette (search, drag), Accordion editor (Header/Middle/Footer/Report Options), Live Preview
 * - Bottom: Save (lime) + Cancel
 * ------------------------------------------------------------------------ */

const DESIGNER_PALETTE: PaletteItem[] = [
  { token: '{logo}', label: 'Logo' },
  { token: '{institute_name}', label: 'Institute Name' },
  { token: '{institute_address}', label: 'Institute Address' },
  { token: '{institute_phone_no}', label: 'Institute Phone' },
  { token: '{institute_email}', label: 'Institute Email' },
  { token: '{exam_name}', label: 'Exam Title' },
  { token: '{academic_session}', label: 'Academic Session' },
  { token: '{student_photo}', label: 'Student Photo' },
  { token: '{name}', label: 'Student Name' },
  { token: '{register_no}', label: 'Admission No' },
  { token: '{class}', label: 'Class' },
  { token: '{section}', label: 'Section' },
  { token: '{term}', label: 'Term' },
  { token: '{student_details}', label: 'Student Details Row' },
  { token: '{marks_table}', label: 'Marks Table' },
  { token: '{attendance}', label: 'Attendance' },
  { token: '{grading_scale}', label: 'Grading Scale' },
  { token: '{position}', label: 'Position' },
  { token: '{cumulative_average}', label: 'Cumulative Average' },
  { token: '{class_average}', label: 'Class Average' },
  { token: '{subject_position}', label: 'Subject Position' },
  { token: '{remark}', label: 'Remark' },
  { token: '{result}', label: 'Result' },
  { token: '{teacher_comments}', label: "Teacher's Comments" },
  { token: '{principal_comments}', label: "Principal's Comments" },
  { token: '{left_signature}', label: 'Left Signature' },
  { token: '{middle_signature}', label: 'Middle Signature' },
  { token: '{right_signature}', label: 'Right Signature' },
  { token: '{print_date}', label: 'Print Date' },
  { token: '', label: 'Class Teacher', custom: true, presetText: 'Class Teacher' },
  { token: '', label: 'Head of School', custom: true, presetText: 'Head of School' },
  { token: '', label: 'Principal', custom: true, presetText: 'Principal' },
  { token: '', label: 'Separator (·)', custom: true, presetText: '·' },
  { token: '', label: 'Blank Line', custom: true, presetText: '__BLANK__' },
  { token: '', label: 'Text', custom: true },
]

const blockLine = (block: SheetBlock) => block.token || block.text || ''
const isEmptyBlock = (block: SheetBlock) => !block.token && !String(block.text ?? '').trim()

const serialiseBlocks = (blocks: SheetBlock[]) => {
  if (!blocks.length) return ''
  const lines: string[] = []
  let current: string[] = []
  for (const block of blocks) {
    if (isEmptyBlock(block)) {
      if (current.length) { lines.push(current.join('   ')); current = [] }
      lines.push('')
      continue
    }
    const line = blockLine(block)
    if (!current.length || !block.inline) {
      if (current.length) lines.push(current.join('   '))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) lines.push(current.join('   '))
  return lines.join('\n')
}

const parseBlocks = (value: string): SheetBlock[] => {
  const raw = String(value ?? '')
  if (raw.trim() === '') return []
  const out: SheetBlock[] = []
  const rawLines = raw.split('\n')
  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      out.push({ uid: uid(), token: '', text: '', align: 'left' })
      continue
    }
    const parts = rawLine.split(/(\{[a-z_]+\})/gi).filter(Boolean)
    let firstInLine = true
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const onlyToken = trimmed.match(/^\{[a-z_]+\}$/i)?.[0]
      if (onlyToken) {
        out.push({ uid: uid(), token: onlyToken, text: '', inline: !firstInLine, align: 'left' })
        firstInLine = false
      } else {
        out.push({ uid: uid(), token: '', text: trimmed, inline: !firstInLine, align: 'left' })
        firstInLine = false
      }
    }
  }
  return out
}

const insertAt = <T,>(list: T[], index: number, item: T): T[] => {
  const next = [...list]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

function MarksheetDesignerModal({
  open, initial, schoolName, branchName, examNames, partsForExam, reportOptionChoices, onClose, onSave,
}: {
  open: boolean
  initial?: EduRow | null
  schoolName: string
  branchName: string
  examNames: string[]
  partsForExam: (examName: string) => MarkPart[]
  reportOptionChoices: string[]
  onClose: () => void
  onSave: (row: EduRow) => void
}) {
  const [templateName, setTemplateName] = useState('')
  const [landscape, setLandscape] = useState(false)
  const [examName, setExamName] = useState('')
  const [header, setHeader] = useState<SheetBlock[]>([])
  const [middle, setMiddle] = useState<SheetBlock[]>([])
  const [footer, setFooter] = useState<SheetBlock[]>([])
  const [reportOptions, setReportOptions] = useState<string[]>([])
  const [drag, setDrag] = useState<DesignerDrag | null>(null)
  const [hoverBand, setHoverBand] = useState<BandKey | null>(null)
  const [openBands, setOpenBands] = useState<Record<BandKey, boolean>>({ header: true, middle: true, footer: true })
  const [blockSearch, setBlockSearch] = useState('')
  const [activeAccordion, setActiveAccordion] = useState<BandKey | 'reportOptions'>('header')

  const applyAlignments = (blocks: SheetBlock[], rawAlign: unknown): SheetBlock[] => {
    try {
      const arr = JSON.parse(String(rawAlign ?? '[]'))
      if (!Array.isArray(arr)) return blocks
      return blocks.map((b, i) => ({ ...b, align: (arr[i] as any) || b.align || 'left' }))
    } catch { return blocks }
  }

  useEffect(() => {
    if (!open) return
    if (!initial) {
      setTemplateName('')
      setLandscape(false)
      setExamName(examNames[0] ?? '')
      setHeader(parseBlocks(MARKSHEET_DEFAULT_HEADER))
      setMiddle(parseBlocks(MARKSHEET_DEFAULT_MIDDLE))
      setFooter(parseBlocks(MARKSHEET_DEFAULT_FOOTER))
      setOpenBands({ header: true, middle: true, footer: true } as Record<BandKey, boolean>)
      setReportOptions(['Attendance Percentage'])
      return
    }
    setTemplateName(String(initial.templateName ?? ''))
    setLandscape(String(initial.pageLayout ?? '').trim().toLocaleLowerCase() === 'landscape')
    setExamName(String(initial.examName ?? examNames[0] ?? ''))
    const nextHeader = applyAlignments(parseBlocks(String(initial.headerContent ?? '')), (initial as any).headerAlignments)
    const nextMiddle = applyAlignments(parseBlocks(String((initial as any).middleContent ?? MARKSHEET_DEFAULT_MIDDLE)), (initial as any).middleAlignments)
    const nextFooter = applyAlignments(parseBlocks(String(initial.footerContent ?? '')), (initial as any).footerAlignments)
    setHeader(nextHeader)
    setMiddle(nextMiddle)
    setFooter(nextFooter)
    setOpenBands({ header: nextHeader.length > 0, middle: nextMiddle.length > 0, footer: nextFooter.length > 0 } as Record<BandKey, boolean>)
    try {
      const parsed: unknown = JSON.parse(String(initial.reportOptions ?? '[]'))
      setReportOptions(Array.isArray(parsed) ? parsed.map(String) : [])
    } catch { setReportOptions([]) }
  }, [open, initial, examNames])

  const bands: Record<BandKey, SheetBlock[]> = { header, middle, footer }
  const setBand = (band: BandKey, next: SheetBlock[]) => {
    if (band === 'header') setHeader(next)
    else if (band === 'middle') setMiddle(next)
    else setFooter(next)
  }
  const openBand = (band: BandKey) => setOpenBands((map) => (map[band] ? map : { ...map, [band]: true }))

  const applyDrop = (band: BandKey, index: number, forceInline?: boolean) => {
    const inFlight = drag
    setDrag(null)
    setHoverBand(null)
    if (!inFlight) return
    if (inFlight.from === 'section') { openBand(inFlight.band); return }
    openBand(band)
    if (inFlight.from === 'palette') {
      const { item } = inFlight
      const prev = bands[band][index - 1]
      const shouldInline = forceInline ? true : (index > 0 && prev && !isEmptyBlock(prev))
      const isBlank = item.label === 'Blank Line' || item.presetText === '__BLANK__'
      const isSeparator = item.label.includes('Separator')
      setBand(band, insertAt(bands[band], index, {
        uid: uid(),
        token: isBlank ? '' : item.token,
        text: isBlank ? '' : (item.custom ? (item.presetText ?? 'Your text here') : ''),
        inline: isBlank ? false : (isSeparator ? true : shouldInline),
      }))
      return
    }
    const source = bands[inFlight.band]
    const moving = source[inFlight.index]
    if (!moving) return
    if (inFlight.band === band) {
      const rest = source.filter((_, i) => i !== inFlight.index)
      setBand(band, insertAt(rest, inFlight.index < index ? index - 1 : index, moving))
    } else {
      setBand(inFlight.band, source.filter((_, i) => i !== inFlight.index))
      setBand(band, insertAt(bands[band], index, moving))
    }
  }

  const toggleReportOption = (option: string) =>
    setReportOptions((list) => list.includes(option) ? list.filter((o) => o !== option) : [...list, option])

  const save = () => {
    if (!templateName.trim()) { alert('Template Name required'); return }
    if (!examName.trim()) { alert('Exam Name required'); return }
    onSave({
      id: initial?.id ?? uid(),
      branch: branchName,
      examName,
      templateName: templateName.trim(),
      pageLayout: landscape ? 'Landscape' : 'Portrait',
      photoStyle: 'Square - 320',
      topSpace: '20', bottomSpace: '20', rightSpace: '15', leftSpace: '15',
      leftSignature: '', middleSignature: '', rightSignature: '',
      logoImage: '', backgroundImage: '',
      headerContent: openBands.header ? serialiseBlocks(header) : '',
      middleContent: openBands.middle !== false ? serialiseBlocks(middle) : '',
      footerContent: openBands.footer ? serialiseBlocks(footer) : '',
      headerAlignments: JSON.stringify(header.map(b => b.align || 'left')),
      middleAlignments: JSON.stringify(middle.map(b => b.align || 'left')),
      footerAlignments: JSON.stringify(footer.map(b => b.align || 'left')),
      reportOptions: JSON.stringify(reportOptions),
      createdAt: new Date().toISOString().slice(0,10),
    } as any)
  }

  const closedBands = (['header', 'middle', 'footer'] as BandKey[]).filter((band) => !openBands[band])
  const filteredPalette = DESIGNER_PALETTE.filter((item) => {
    const q = blockSearch.trim().toLowerCase()
    if (!q) return true
    return item.label.toLowerCase().includes(q) || item.token.toLowerCase().includes(q) || (item.presetText ?? '').toLowerCase().includes(q)
  })

  const smallLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#6b7280' }

  const bandEditor = (band: BandKey, title: string, emptyHint: string) => {
    const blocks = bands[band]
    const rows: { blocks: { block: SheetBlock; index: number }[]; isEmpty: boolean; endIndex: number }[] = []
    let current: { block: SheetBlock; index: number }[] = []
    const flush = () => {
      if (current.length) {
        const isEmpty = current.length === 1 && isEmptyBlock(current[0].block)
        const endIndex = current[current.length - 1].index + 1
        rows.push({ blocks: current, isEmpty, endIndex })
        current = []
      }
    }
    blocks.forEach((block, idx) => {
      if (isEmptyBlock(block)) {
        flush()
        rows.push({ blocks: [{ block, index: idx }], isEmpty: true, endIndex: idx + 1 })
        return
      }
      if (!current.length || !block.inline) {
        flush()
        current = [{ block, index: idx }]
      } else {
        current.push({ block, index: idx })
      }
    })
    flush()

    const toggleInline = (i: number) => {
      if (i === 0) return
      setBand(band, blocks.map((b, j) => (j === i ? { ...b, inline: !b.inline } : b)))
    }

    const renderBlock = (block: SheetBlock, i: number) => {
      const isSep = block.text === '·' || blockLine(block) === '·'
      const fullLabel = blockLine(block) || block.text || ''
      const align = block.align || 'left'
      const setAlign = (a: 'left' | 'center' | 'right') => {
        setBand(band, blocks.map((b, j) => (j === i ? { ...b, align: a } : b)))
      }
      return (
        <div
          key={block.uid}
          draggable
          title={fullLabel}
          onDragStart={() => setDrag({ from: 'band', band, index: i })}
          onDragEnd={() => { setDrag(null); setHoverBand(null) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoverBand(band) }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); applyDrop(band, i) }}
          className={`group/block flex max-w-full cursor-grab items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm transition active:cursor-grabbing hover:shadow ${isSep ? 'shrink-0 border-zinc-200 bg-zinc-50 text-zinc-500' : 'min-w-0 max-w-[260px] shrink border-zinc-200 bg-white text-zinc-800'}`}
        >
          <span className="shrink-0 text-[10px] text-zinc-400 group-hover/block:text-zinc-600">⋮⋮</span>
          {block.token ? (
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium">{block.token}</span>
          ) : (
            <input
              value={block.text ?? ''}
              aria-label={`${title} text line ${i + 1}`}
              onChange={(e) => setBand(band, blocks.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)))}
              className="min-w-0 flex-1 truncate rounded-full border border-zinc-200 bg-transparent px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          )}
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
            {([
              { k: 'left' as const, Icon: AlignLeft },
              { k: 'center' as const, Icon: AlignCenter },
              { k: 'right' as const, Icon: AlignRight },
            ]).map(({ k, Icon }) => (
              <button key={k} type="button" title={`Align ${k}`} onClick={() => setAlign(k)} className={`flex size-5 items-center justify-center rounded-full transition ${align === k ? 'bg-white text-black shadow' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Icon className="size-3" />
              </button>
            ))}
          </span>
          <button type="button" disabled={i === 0} onClick={() => toggleInline(i)} className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide transition ${i === 0 ? 'opacity-30 bg-zinc-100 text-zinc-400' : block.inline ? 'bg-lime-400 text-black shadow-sm hover:bg-lime-300' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {block.inline ? 'Inline' : 'New line'}
          </button>
          <button type="button" title="Remove" onClick={() => setBand(band, blocks.filter((_, j) => j !== i))} className="flex size-4 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] text-zinc-500 transition hover:bg-rose-500 hover:text-white">×</button>
        </div>
      )
    }

    return (
      <div
        data-band={band}
        onDragOver={(e) => { e.preventDefault(); setHoverBand(band) }}
        onDragLeave={() => setHoverBand((b) => (b === band ? null : b))}
        onDrop={(e) => { e.preventDefault(); applyDrop(band, blocks.length) }}
        className={`rounded-xl border bg-white p-3 shadow-sm transition ${hoverBand === band ? 'border-lime-400 bg-lime-50/50 shadow-md ring-2 ring-lime-200' : 'border-zinc-200'}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">{blocks.length} {blocks.length === 1 ? 'item' : 'items'}</span>
            <button type="button" onClick={() => setOpenBands((map) => ({ ...map, [band]: false }))} className="flex size-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-rose-500 hover:text-white">×</button>
          </span>
        </div>
        {blocks.length ? (
          <div className="flex flex-col gap-2">
            {rows.map((row, rIdx) => (
              row.isEmpty ? (
                <div key={`empty-${rIdx}`} className="flex items-center gap-1">
                  <div className="h-px flex-1 bg-zinc-200" />
                  <span className="text-[9px] uppercase tracking-wide text-zinc-400">blank line — separates columns</span>
                  <div className="h-px flex-1 bg-zinc-200" />
                  <button type="button" onClick={() => { const idx = row.blocks[0].index; setBand(band, blocks.filter((_, j) => j !== idx)) }} className="px-1 text-zinc-400 hover:text-rose-600">×</button>
                </div>
              ) : (
                <div key={`row-${rIdx}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoverBand(band) }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); applyDrop(band, row.endIndex, true) }} className={`group/row relative flex flex-col gap-2 rounded-xl border p-2.5 shadow-sm transition-all ${hoverBand === band ? 'border-lime-400 bg-lime-50/80 shadow-md' : row.blocks.length > 1 ? 'border-lime-200 bg-gradient-to-br from-lime-50/60 to-white' : 'border-dashed border-zinc-300 bg-white'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.blocks.map(({ block, index }) => renderBlock(block, index))}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${row.blocks.length > 1 ? 'bg-lime-100 text-lime-800' : 'bg-zinc-100 text-zinc-600'}`}>{row.blocks.length} {row.blocks.length > 1 ? 'inline' : 'item — drop here for inline'}</span>
                    <div className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-lime-300 bg-lime-50 px-3 py-1 text-[11px] font-bold text-lime-700 shadow-sm transition hover:border-lime-500 hover:bg-lime-100">+ inline</div>
                  </div>
                </div>
              )
            ))}
            <button type="button" onClick={() => { const empty: SheetBlock = { uid: uid(), token: '', text: '' }; setBand(band, [...blocks, empty]) }} className="rounded border border-dashed border-zinc-300 px-2 py-1 text-[10px] text-zinc-500 hover:border-lime-400 hover:text-lime-700">+ blank line</button>
          </div>
        ) : (
          <p className="py-2 text-[11px] italic text-zinc-400">{emptyHint}</p>
        )}
      </div>
    )
  }

  const bandPlaceholder = (band: BandKey, title: string) => (
    <div data-band={band} onDragOver={(e) => { e.preventDefault(); setHoverBand(band) }} onDragLeave={() => setHoverBand((b) => (b === band ? null : b))} onDrop={(e) => { e.preventDefault(); applyDrop(band, 0) }} className={`rounded-lg border border-dashed p-3 text-center transition ${hoverBand === band ? 'border-lime-400 bg-lime-50' : 'border-zinc-300'}`}>
      <button type="button" onClick={() => openBand(band)} className="text-[11px] text-zinc-500 transition hover:text-lime-600">{title} closed — click, or drop the {title} block here, to restore</button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Design — ${String(initial.templateName ?? 'template')}` : 'Marksheet Template Designer'} size="full">
      <div className="space-y-4">
        {/* Top bar */}
        <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-600">Template Name *</span>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Basic 7 Report Card" className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-lime-500 focus:ring-2 focus:ring-lime-200" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-600">Exam Name *</span>
            <select value={examName} onChange={(e) => setExamName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-lime-500 focus:ring-2 focus:ring-lime-200">
              <option value="">Select...</option>
              {examNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-600">Page Layout</span>
            <select value={landscape ? 'Landscape' : 'Portrait'} onChange={(e) => setLandscape(e.target.value === 'Landscape')} className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm shadow-sm">
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[200px_320px_1fr] items-start">
          {/* Blocks palette */}
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm self-start sticky top-2">
            <p style={smallLabel}>Blocks</p>
            <p className="mb-2 text-[10px] text-zinc-500">Drag onto a band →</p>
            <div className="mb-3">
              <input value={blockSearch} onChange={(e) => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-zinc-400 focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-200" />
            </div>
            {closedBands.length ? (
              <div className="mb-3 border-b border-zinc-200 pb-3">
                <p style={smallLabel}>Sections</p>
                <p className="mb-1 text-[10px] text-zinc-500">Closed — drag back to restore</p>
                <div className="flex flex-col gap-1">
                  {closedBands.map((band) => (
                    <div key={band} draggable onDragStart={() => setDrag({ from: 'section', band })} onDragEnd={() => { setDrag(null); setHoverBand(null) }} className="cursor-grab rounded-xl border border-dashed border-lime-300 bg-lime-50 px-3 py-2 text-xs font-semibold transition hover:border-lime-500 active:cursor-grabbing">
                      {band === 'header' ? 'Header' : band === 'middle' ? 'Middle (Body)' : 'Footer'} section
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 max-h-[52vh] overflow-y-auto pr-1">
              {filteredPalette.length ? filteredPalette.map((item) => (
                <div
                  key={item.label}
                  draggable
                  onDragStart={() => setDrag({ from: 'palette', item })}
                  onDragEnd={() => { setDrag(null); setHoverBand(null) }}
                  onClick={() => {
                    const target = hoverBand ?? 'header'
                    const isBlank = item.label === 'Blank Line' || item.presetText === '__BLANK__'
                    const newBlock: SheetBlock = { uid: uid(), token: isBlank ? '' : item.token, text: isBlank ? '' : (item.custom ? (item.presetText ?? 'Your text here') : ''), inline: false }
                    setBand(target, [...bands[target], newBlock])
                    if (!openBands[target]) setOpenBands((m) => ({ ...m, [target]: true }))
                  }}
                  className="cursor-grab rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-xs font-medium shadow-sm transition hover:border-lime-400 hover:bg-lime-50 hover:shadow active:cursor-grabbing"
                >
                  {item.label}
                </div>
              )) : (
                <p className="py-2 text-[11px] italic text-zinc-400">No blocks match “{blockSearch}”</p>
              )}
            </div>
          </div>

          {/* Accordion */}
          <div id="marksheet-accordion" className="accordion flex max-h-[72vh] flex-col overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-200 bg-white shadow-sm self-start sticky top-2">
            {([
              { key: 'header' as const, title: 'Header', hint: 'Drag blocks here for the sheet header.' },
              { key: 'middle' as const, title: 'Middle (Body)', hint: 'Drag blocks here for the middle — Photo, Student details, Marks table, Remarks, Signatures.' },
              { key: 'footer' as const, title: 'Footer', hint: 'Drag blocks here for the sheet footer.' },
            ]).map(({ key, title, hint }) => {
              const isActive = activeAccordion === key
              const isClosed = !openBands[key]
              return (
                <div key={key} className="accordion-item">
                  <h2 className="accordion-header m-0">
                    <button type="button" onClick={() => setActiveAccordion(isActive ? null as any : key)} aria-expanded={isActive} aria-controls={`collapse-${key}`} className={`accordion-button flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-bold transition ${isActive ? 'bg-lime-50 text-lime-900' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold transition ${isActive ? 'rotate-180 bg-lime-200' : ''}`}>⌄</span>
                        {title}
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isClosed ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>{bands[key].length} {isClosed ? '· closed' : ''}</span>
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); setOpenBands((m) => ({ ...m, [key]: !m[key] })) }} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isClosed ? 'bg-lime-400 text-black' : 'bg-zinc-100 text-zinc-500 hover:bg-rose-100 hover:text-rose-600'}`}>{isClosed ? 'Restore' : '×'}</span>
                    </button>
                  </h2>
                  <div id={`collapse-${key}`} className={`accordion-collapse ${isActive ? 'block' : 'hidden'}`}>
                    <div className="accordion-body bg-zinc-50/50 p-3">
                      {isClosed ? bandPlaceholder(key, title) : bandEditor(key, title, hint)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="accordion-item">
              <h2 className="accordion-header m-0">
                <button type="button" onClick={() => setActiveAccordion(activeAccordion === 'reportOptions' ? null as any : 'reportOptions')} aria-expanded={activeAccordion === 'reportOptions'} className={`accordion-button flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-bold transition ${activeAccordion === 'reportOptions' ? 'bg-lime-50 text-lime-900' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold transition ${activeAccordion === 'reportOptions' ? 'rotate-180 bg-lime-200' : ''}`}>⌄</span>
                    Report Options
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{reportOptions.length} selected</span>
                  </span>
                </button>
              </h2>
              <div className={`accordion-collapse ${activeAccordion === 'reportOptions' ? 'block' : 'hidden'}`}>
                <div className="accordion-body bg-zinc-50/50 p-4">
                  <p style={smallLabel}>Report Options</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reportOptionChoices.map((option) => (
                      <label key={option} className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition hover:border-lime-300 hover:bg-lime-50">
                        <input type="checkbox" checked={reportOptions.includes(option)} onChange={() => toggleReportOption(option)} className="size-4 rounded border-zinc-300 text-lime-600 focus:ring-lime-500" />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="min-w-0">
            <MarksheetPreview
              templateName={templateName.trim() || 'Untitled template'}
              pageLayout={landscape ? 'Landscape' : 'Portrait'}
              backgroundImage=""
              schoolName={schoolName}
              photoStyle="Square - 320"
              topSpace="20" bottomSpace="20" rightSpace="15" leftSpace="15"
              headerContent={openBands.header ? serialiseBlocks(header) : ''}
              middleContent={openBands.middle !== false ? serialiseBlocks(middle) : ''}
              footerContent={openBands.footer ? serialiseBlocks(footer) : ''}
              headerAlignments={JSON.stringify(header.map(b => b.align || 'left'))}
              middleAlignments={JSON.stringify(middle.map(b => b.align || 'left'))}
              footerAlignments={JSON.stringify(footer.map(b => b.align || 'left'))}
              showHeader={openBands.header}
              showMiddle={openBands.middle !== false}
              showFooter={openBands.footer}
              reportOptions={JSON.stringify(reportOptions)}
              examName={examName}
              parts={partsForExam(examName)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <Button type="button" size="sm" variant="outline" className="rounded-xl px-6" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" className="rounded-xl bg-lime-400 px-8 font-bold text-black shadow hover:bg-lime-300" onClick={save}>{initial ? 'Update Template' : 'Save Template'}</Button>
        </div>
      </div>
    </Modal>
  )
}

type CertElementType = 'logo' | 'image' | 'badge' | 'heading' | 'text' | 'student_name' | 'course' | 'date' | 'signature' | 'rectangle' | 'circle' | 'border' | 'line'
type CertElement = {
  id: string
  type: CertElementType
  x: number
  y: number
  w: number
  h: number
  content: string
  style: {
    fontFamily: string
    fontSize: number
    color: string
    textAlign: 'left' | 'center' | 'right'
    fontWeight: string
    fontStyle: string
    backgroundColor?: string
    borderWidth?: number
    borderColor?: string
    borderRadius?: number
  }
}
const GOOGLE_FONTS = ['Inter','Manrope','Sora','Montserrat','Playfair Display','Poppins','Roboto','Open Sans','Lato','Nunito']
const CERT_PALETTE: { type: CertElementType; label: string; defaultContent: string }[] = [
  { type: 'heading', label: 'Heading', defaultContent: 'Certificate of Achievement' },
  { type: 'text', label: 'Text', defaultContent: 'This is to certify that' },
  { type: 'student_name', label: 'Student Name', defaultContent: 'Ama Owusu' },
  { type: 'text', label: 'Employee Name', defaultContent: 'Kwame Mensah' },
  { type: 'text', label: 'Member Name', defaultContent: 'Abena Osei' },
  { type: 'text', label: 'Holder Name', defaultContent: '{holder_name}' },
  { type: 'course', label: 'Course / Exam', defaultContent: 'First Term Examination' },
  { type: 'text', label: 'Department', defaultContent: 'Human Resources' },
  { type: 'text', label: 'Designation', defaultContent: 'Senior Manager' },
  { type: 'text', label: 'Admission No', defaultContent: 'ADM-2024-001' },
  { type: 'text', label: 'Employee ID', defaultContent: 'EMP-2024-045' },
  { type: 'text', label: 'Membership No', defaultContent: 'MBR-2024-012' },
  { type: 'text', label: 'Certificate No', defaultContent: 'CERT-2024-0001' },
  { type: 'date', label: 'Issue Date', defaultContent: 'Issue Date: 2024-05-15' },
  { type: 'date', label: 'Expiry Date', defaultContent: 'Expiry Date: 2025-05-15' },
  { type: 'date', label: 'Date', defaultContent: 'Date: 2024-05-15' },
  { type: 'signature', label: 'Signature', defaultContent: 'Principal' },
  { type: 'text', label: 'Organization', defaultContent: 'FitPro Academy' },
  { type: 'logo', label: 'Logo', defaultContent: '' },
  { type: 'image', label: 'Image', defaultContent: '' },
  { type: 'badge', label: 'Badge', defaultContent: '' },
  { type: 'line', label: 'Line', defaultContent: '' },
  { type: 'rectangle', label: 'Rectangle', defaultContent: '' },
  { type: 'circle', label: 'Circle', defaultContent: '' },
  { type: 'border', label: 'Border Frame', defaultContent: '' },
]



const getDefaultCertificateElements = (paperW: number, paperH: number, marginPx: number = 57): CertElement[] => {
  const uid = () => Math.random().toString(36).slice(2,9)
  const innerW = Math.max(100, paperW - marginPx*2)
  const innerH = Math.max(100, paperH - marginPx*2)
  const centerX = (w: number) => innerW/2 - w/2
  // More visible: larger fonts, bolder, higher contrast, bigger spacing
  const contentHeight = 420
  const startY = Math.max(24, (innerH - contentHeight)/2 - 30)
  return [
    {
      id: uid(),
      type: 'logo',
      content: '',
      x: centerX(100),
      y: startY,
      w: 100,
      h: 56,
      style: { fontFamily: 'Poppins', fontSize: 13, color: '#4a5568', textAlign: 'center', fontWeight: '600', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'heading',
      content: 'Certificate of Achievement',
      x: centerX(460),
      y: startY + 72,
      w: 460,
      h: 40,
      style: { fontFamily: 'Playfair Display', fontSize: 28, color: '#0f2a4d', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(400),
      y: startY + 124,
      w: 400,
      h: 4,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#b7791f', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#b7791f' }
    },
    {
      id: uid(),
      type: 'text',
      content: 'This is to certify that',
      x: centerX(360),
      y: startY + 142,
      w: 360,
      h: 22,
      style: { fontFamily: 'Inter', fontSize: 15, color: '#2d3748', textAlign: 'center', fontWeight: '500', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'student_name',
      content: 'Ama Owusu',
      x: centerX(360),
      y: startY + 170,
      w: 360,
      h: 36,
      style: { fontFamily: 'Poppins', fontSize: 26, color: '#b7791f', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(320),
      y: startY + 216,
      w: 320,
      h: 3,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#b7791f', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#b7791f' }
    },
    {
      id: uid(),
      type: 'text',
      content: 'has successfully completed the course with distinction',
      x: centerX(480),
      y: startY + 236,
      w: 480,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 13, color: '#2d3748', textAlign: 'center', fontWeight: '500', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'course',
      content: 'First Term Examination',
      x: centerX(400),
      y: startY + 268,
      w: 400,
      h: 28,
      style: { fontFamily: 'Poppins', fontSize: 18, color: '#0f172a', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(420),
      y: startY + 310,
      w: 420,
      h: 2,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1e293b', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#1e293b' }
    },
    {
      id: uid(),
      type: 'date',
      content: 'Date: 2024-05-15',
      x: 32,
      y: innerH - 72,
      w: 220,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 12, color: '#334155', textAlign: 'left', fontWeight: '600', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'signature',
      content: 'Principal',
      x: innerW - 220 - 32,
      y: innerH - 72,
      w: 220,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 12, color: '#1e293b', textAlign: 'right', fontWeight: '700', fontStyle: 'normal' }
    },
  ]
}


function CertificateBuilderModal({ open, onClose, initial, onSave, branchName, branchId, companyName }: { open: boolean; onClose: () => void; initial: any; onSave: (t: any) => void; branchName?: string; branchId?: string; companyName?: string }) {
  const [elements, setElements] = useState<CertElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [holderType, setHolderType] = useState<'Student' | 'Employee' | 'Member' | 'All'>('All')
  const [certificateType, setCertificateType] = useState('Achievement')
  const [bgColor, setBgColor] = useState('#FFFEF0')
  const [bgImage, setBgImage] = useState('')
  const [bgPattern, setBgPattern] = useState<'none' | 'dots' | 'lines' | 'grid' | 'waves' | 'chevron' | 'stripes' | 'crosshatch' | 'confetti' | 'damask' | 'stars' | 'marble'>('none')
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'ornate' | 'vintage' | 'elegant' | 'classic' | 'modern' | 'gold' | 'silver' | 'floral' | 'thick' | 'striped'>('striped')
  const [orientation, setOrientation] = useState<'Landscape' | 'Portrait'>('Portrait')
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom'>('A4')
  const [marginFilter, setMarginFilter] = useState<'None' | 'Small' | 'Medium' | 'Large' | 'Extra Large'>('Medium')
  const [zoomFilter, setZoomFilter] = useState(100)
  const [showGuides, setShowGuides] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: 'br' | 'r' | 'b' | 'l'; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const leftColRef = useRef<HTMLDivElement | null>(null)
  const [previewMaxH, setPreviewMaxH] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const [elementSearch, setElementSearch] = useState('')
  const selected = elements.find(e => e.id === selectedId) || null
  useEffect(() => {
    if (initial && (initial as any).certificateData) {
      try {
        const data = JSON.parse(String((initial as any).certificateData))
        setElements(data.elements || [])
        setBgColor(data.bgColor || '#FFFEF0')
        setBgImage(data.bgImage || '')
        setBgPattern(data.bgPattern || 'none')
        setBorderStyle(data.borderStyle || 'ornate')
        setOrientation(data.orientation || (initial as any).orientation || (initial as any).pageLayout || 'Portrait')
        setPaperSize(data.paperSize || (initial as any).paperSize || 'A4')
        setMarginFilter(data.marginFilter || (initial as any).marginFilter || 'Medium')
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
      } catch {
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
      }
    } else if (initial) {
      setTemplateName((initial as any).name || (initial as any).templateName || '')
      setHolderType((initial as any).holderType || 'All')
      setCertificateType((initial as any).certificateType || 'Achievement')
      setOrientation((initial as any).orientation || (initial as any).pageLayout || 'Portrait')
      setPaperSize((initial as any).paperSize || 'A4')
      setMarginFilter((initial as any).marginFilter || 'Medium')
      try {
        const d = JSON.parse(String((initial as any).certificateData || '{}'))
        if (d.elements) setElements(d.elements)
      } catch {}
    } else {
      // Default preview with elements as seen in attached reference
      const paper = getPaperDims()
      const m = getMargin()
      setElements(getDefaultCertificateElements(paper.w, paper.h, m.px))
      setBgColor('#FFFEF0')
      setBorderStyle('striped')
      setBgPattern('none')
      setMarginFilter('Medium')
      setHolderType('All')
      setCertificateType('Achievement')
    }
    if (open) {
      setTimeout(() => {
        if (leftColRef.current) {
          const h = leftColRef.current.offsetHeight
          setPreviewMaxH(h > 0 ? h : null)
        }
      }, 100)
    }
  }, [initial, open])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const el = elements.find(x => x.id === dragging.id)
        if (!el || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const scale = getEffectiveScale()
        const x = (e.clientX - rect.left) / scale - dragging.offsetX
        const y = (e.clientY - rect.top) / scale - dragging.offsetY
        setElements(prev => prev.map(it => it.id === dragging.id ? { ...it, x, y } : it))
      }
      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaY = e.clientY - resizing.startY
        const scale = getEffectiveScale()
        setElements(prev => prev.map(it => {
          if (it.id !== resizing.id) return it
          let newW = resizing.startW
          let newH = resizing.startH
          if (resizing.handle === 'r' || resizing.handle === 'br' || resizing.handle === 'l') {
            newW = Math.max(40, resizing.startW + (resizing.handle === 'l' ? -deltaX : deltaX) / scale)
          }
          if (resizing.handle === 'b' || resizing.handle === 'br') {
            newH = Math.max(20, resizing.startH + deltaY / scale)
          }
          if (resizing.handle === 'l') {
            const newX = it.x + (resizing.startW - newW)
            return { ...it, w: newW, h: newH, x: newX }
          }
          return { ...it, w: newW, h: newH }
        }))
      }
    }
    const onUp = () => { setDragging(null); setResizing(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, resizing, elements])

  // Auto-center elements when margin changes (white space around border)
  useEffect(() => {
    const m = getMargin()
    const paper = getPaperDims()
    const innerW = Math.max(100, paper.w - m.px*2)
    setElements(prev => prev.map(el => ({
      ...el,
      x: innerW/2 - el.w/2,
      style: { ...el.style, textAlign: 'center' as const }
    })))
  }, [marginFilter, paperSize, orientation])

  // Auto-fit preview to show fully screen with board and content on tablet/computer
  useEffect(() => {
    // Delay to ensure container is rendered
    const t = setTimeout(() => fitToScreen(), 150)
    return () => clearTimeout(t)
  }, [paperSize, orientation, marginFilter, previewMaxH])

  // Also fit on initial mount for default preview
  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 300)
    return () => clearTimeout(t)
  }, [])
  const uid = () => Math.random().toString(36).slice(2,9)
  const getPaperDims = () => {
    const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }
    const base = sizes[paperSize] || sizes.A4
    return orientation === 'Portrait' ? base : { w: base.h, h: base.w }
  }
  const getMargin = () => {
    const map: Record<string, { mm: number; px: number }> = { None: { mm: 0, px: 0 }, Small: { mm: 10, px: 38 }, Medium: { mm: 15, px: 57 }, Large: { mm: 20, px: 76 }, 'Extra Large': { mm: 25, px: 95 } }
    return map[marginFilter] || map.Medium
  }
  const getEffectiveScale = () => zoomFilter / 100
  const fitToScreen = () => {
    const paper = getPaperDims()
    const container = previewScrollRef.current
    if (!container) {
      setZoomFilter(100)
      return
    }
    // Available space inside the gray preview area (minus padding)
    const availableW = container.clientWidth - 48
    const availableH = (previewMaxH ? Math.min(previewMaxH, 700) : 600) - 32
    const scaleW = availableW / paper.w
    const scaleH = availableH / paper.h
    // Fit fully with some breathing room, clamp 30-100 for default fit (allow up to 200 via slider)
    const fitScale = Math.min(scaleW, scaleH) * 0.92
    const zoom = Math.max(30, Math.min(100, Math.round(fitScale * 100)))
    setZoomFilter(zoom)
  }
  const addElement = (type: CertElement['type'], defaultContent?: string) => {
    const paper = getPaperDims()
    const newEl: CertElement = {
      id: uid(), type, content: defaultContent || type,
      x: paper.w/2 - 100, y: paper.h/2 - 20 + elements.length*24,
      w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200,
      h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const addElementAt = (type: CertElement['type'], content: string, clientX: number, clientY: number) => {
    if (!canvasRef.current) { addElement(type, content); return }
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = getEffectiveScale()
    const x = (clientX - rect.left) / scale
    const y = (clientY - rect.top) / scale
    const newEl: CertElement = {
      id: uid(), type, content: content || type,
      x: x - 50, y: y - 16,
      w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200,
      h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' }
    }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const updateSelected = (patch: any) => {
    if (!selected) return
    setElements(prev => prev.map(el => {
      if (el.id !== selected.id) return el
      if (patch.style) return { ...el, style: { ...el.style, ...patch.style } }
      if (patch.content !== undefined) return { ...el, content: patch.content }
      return { ...el, ...patch }
    }))
  }
  const deleteSelected = (id: string) => { setElements(prev => prev.filter(e => e.id !== id)); setSelectedId(null) }
  const handleMouseDown = (e: React.MouseEvent, el: CertElement) => {
    e.preventDefault(); e.stopPropagation(); setSelectedId(el.id)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    const scale = getEffectiveScale()
    setDragging({ id: el.id, offsetX: (e.clientX - canvasRect.left)/scale - el.x, offsetY: (e.clientY - canvasRect.top)/scale - el.y })
  }
  const save = () => {
    if (!templateName.trim()) { alert('Template name required'); return }
    const data = { elements, bgColor, bgImage, bgPattern, borderStyle, orientation, paperSize, marginFilter, holderType, certificateType }
    onSave({
      id: (initial as any)?.id || uid(),
      name: templateName,
      templateName,
      holderType,
      certificateType,
      pageLayout: orientation,
      orientation,
      paperSize,
      marginFilter,
      borderStyle,
      pattern: bgPattern,
      backgroundColor: bgColor,
      backgroundImage: bgImage,
      bgColor,
      bgImage,
      bgPattern,
      branch: branchName || (initial as any)?.branch || '',
      branchId: branchId || (initial as any)?.branchId || '',
      company: companyName || (initial as any)?.company || '',
      schoolName: companyName || (initial as any)?.schoolName || '',
      certificateData: JSON.stringify(data),
      createdAt: (initial as any)?.createdAt || new Date().toISOString().slice(0,10)
    })
  }
  const handlePrint = () => { window.print() }
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Certificate Template' : 'New Certificate Template'} size="full">
      <div className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line/60 bg-muted/20 p-3">
          <label className="flex min-w-[200px] flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Template Name *</span><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Achievement Certificate" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Holder Type *</span><select value={holderType} onChange={e => setHolderType(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="All">All</option><option value="Student">Student</option><option value="Employee">Employee</option><option value="Member">Member</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Certificate Type *</span><input value={certificateType} onChange={e => setCertificateType(e.target.value)} placeholder="Achievement" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background</span><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-16 rounded border border-line shadow-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Border Style</span><select value={borderStyle} onChange={e => setBorderStyle(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="striped">Striped Gold (as attached)</option><option value="solid">Solid Gold</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="groove">Groove</option><option value="ridge">Ridge</option><option value="ornate">Ornate Striped</option><option value="vintage">Vintage</option><option value="elegant">Elegant Thin</option><option value="classic">Classic Thick Double</option><option value="modern">Modern Black</option><option value="gold">Gold Frame</option><option value="silver">Silver Frame</option><option value="floral">Floral</option><option value="thick">Thick</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Pattern</span><select value={bgPattern} onChange={e => setBgPattern(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="dots">Dots</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="waves">Waves</option><option value="chevron">Chevron</option><option value="stripes">Stripes</option><option value="crosshatch">Crosshatch</option><option value="confetti">Confetti</option><option value="damask">Damask</option><option value="stars">Stars</option><option value="marble">Marble</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span><div className="flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm hover:border-lime"><UploadCloud className="size-4" /><span>{bgImage ? 'Change' : 'Upload'}</span><input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBgImage(String(reader.result || '')); reader.readAsDataURL(file); e.target.value = '' }} /></label>{bgImage && <button type="button" onClick={() => setBgImage('')} className="rounded-lg border border-line px-2 py-1 text-[11px]">Clear</button>}</div></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Orientation</span><select value={orientation} onChange={e => setOrientation(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="Portrait">Portrait</option><option value="Landscape">Landscape</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Paper Size</span><select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Custom">Custom</option></select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Margin</span><select value={marginFilter} onChange={e => setMarginFilter(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="None">None (0mm)</option><option value="Small">Small (10mm)</option><option value="Medium">Medium (15mm)</option><option value="Large">Large (20mm)</option><option value="Extra Large">Extra Large (25mm)</option></select></label>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div ref={leftColRef} className="lg:col-span-2 w-full self-start">
            <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
              <p className="mb-2 text-[11px] text-mist">Drag to certificate or click to add</p>
              <div className="mb-3">
                <input
                  value={elementSearch}
                  onChange={e => setElementSearch(e.target.value)}
                  placeholder="Search elements..."
                  className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {CERT_PALETTE.filter(item => item.label.toLowerCase().includes(elementSearch.toLowerCase())).map(item => (
                  <button
                    key={item.type+item.label}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, content: item.defaultContent }))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addElement(item.type, item.defaultContent)}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-lime hover:bg-lime/5 active:cursor-grabbing dark:bg-white/[0.04] dark:border-white/10"
                  >
                    <span className="text-[12px] leading-none opacity-40">⋮⋮</span>
                    <span className="flex-1">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex min-w-0 flex-col gap-3 self-start">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => fitToScreen()}>Fit View</Button>
                <Button type="button" size="sm" variant={showGuides ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => setShowGuides(v => !v)}>{showGuides ? 'Guides On' : 'Guides Off'}</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={handlePrint}><Printer className="mr-1 size-3" />Print</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { if (elements.length && confirm(`Clear all ${elements.length} element(s) from canvas?`)) { setElements([]); setSelectedId(null) } }}><Trash2 className="mr-1 size-3" />Clear All</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => { const paper = getPaperDims(); const m = getMargin(); setElements(getDefaultCertificateElements(paper.w, paper.h, m.px)) }}>Load Sample</Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-mist">Zoom</span>
                <input type="range" min={50} max={200} value={zoomFilter} onChange={e => setZoomFilter(Number(e.target.value))} className="h-1 w-24 accent-lime-600" />
                <span className="min-w-[3ch] text-[11px] font-bold text-foreground">{zoomFilter}%</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-zinc-100 p-4 shadow-inner dark:bg-zinc-900/50">
              <div
                ref={previewScrollRef}
                className={`flex min-h-0 w-full justify-center overflow-auto ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                style={previewMaxH ? { maxHeight: previewMaxH, minHeight: 420 } : { minHeight: 560 }}
                onMouseDown={e => {
                  // Only start panning if clicking on the scroll container background, not on an element
                  const target = e.target as HTMLElement
                  if (target.closest('[data-element]')) return
                  if (dragging || resizing) return
                  setIsPanning(true)
                  setPanStart({
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: previewScrollRef.current?.scrollLeft || 0,
                    scrollTop: previewScrollRef.current?.scrollTop || 0,
                  })
                  e.preventDefault()
                }}
                onMouseMove={e => {
                  if (!isPanning || !previewScrollRef.current) return
                  const dx = e.clientX - panStart.x
                  const dy = e.clientY - panStart.y
                  previewScrollRef.current.scrollLeft = panStart.scrollLeft - dx
                  previewScrollRef.current.scrollTop = panStart.scrollTop - dy
                }}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
              >
                <div style={{ width: getPaperDims().w * getEffectiveScale(), height: getPaperDims().h * getEffectiveScale(), flexShrink: 0 }} className="relative bg-white shadow-2xl rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: getPaperDims().w,
                      height: getPaperDims().h,
                      transform: `scale(${getEffectiveScale()})`,
                      transformOrigin: 'top left',
                      backgroundColor: '#ffffff',
                      padding: getMargin().px,
                    }}
                    className="relative overflow-hidden"
                  >
                    <div
                      ref={canvasRef}
                      className="relative h-full w-full overflow-hidden rounded-sm"
                      style={{
                        backgroundColor: bgColor,
                        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        width: '100%',
                        height: '100%',
                      }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                    onDrop={e => {
                      e.preventDefault()
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                        if (data?.type) addElementAt(data.type, data.content || '', e.clientX, e.clientY)
                      } catch {}
                    }}
                    onClick={() => setSelectedId(null)}
                  >
                    {borderStyle !== 'none' && (
                      borderStyle === 'striped' || borderStyle === 'ornate' ? (
                        <div className="pointer-events-none absolute inset-0 z-0 p-2" style={{ background: 'repeating-linear-gradient(45deg, #d69e2e, #d69e2e 10px, #8c5a00 10px, #8c5a00 20px)' }}>
                          <div className="h-full w-full" style={{ backgroundColor: bgColor }} />
                        </div>
                      ) : (
                        <div className="pointer-events-none absolute inset-0 z-0" style={{ border: borderStyle==='solid' ? '4px solid #d69e2e' : borderStyle==='double' ? '8px double #d69e2e' : borderStyle==='dashed' ? '4px dashed #d69e2e' : borderStyle==='dotted' ? '4px dotted #d69e2e' : borderStyle==='thick' ? '16px solid #d69e2e' : borderStyle==='elegant' ? '2px solid #d69e2e' : '4px solid #d69e2e' }} />
                      )
                    )}
                    {/* Guidelines - show when Guides On and dragging */}
                    {showGuides && dragging && (() => {
                      const dragged = elements.find(e => e.id === dragging.id)
                      if (!dragged) return null
                      const m = getMargin()
                      const paper = getPaperDims()
                      const innerW = Math.max(100, paper.w - m.px*2)
                      const innerH = Math.max(100, paper.h - m.px*2)
                      const threshold = 6
                      const guides: { type: 'v' | 'h'; pos: number; color: string }[] = []
                      const dLeft = dragged.x
                      const dCenterX = dragged.x + dragged.w/2
                      const dRight = dragged.x + dragged.w
                      const dTop = dragged.y
                      const dCenterY = dragged.y + dragged.h/2
                      const dBottom = dragged.y + dragged.h

                      const cCenterX = innerW/2
                      const cCenterY = innerH/2
                      if (Math.abs(dCenterX - cCenterX) < threshold) guides.push({ type: 'v', pos: cCenterX, color: 'bg-lime-500' })
                      if (Math.abs(dCenterY - cCenterY) < threshold) guides.push({ type: 'h', pos: cCenterY, color: 'bg-lime-500' })
                      if (Math.abs(dLeft - 0) < threshold) guides.push({ type: 'v', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dRight - innerW) < threshold) guides.push({ type: 'v', pos: innerW, color: 'bg-amber-500' })
                      if (Math.abs(dTop - 0) < threshold) guides.push({ type: 'h', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dBottom - innerH) < threshold) guides.push({ type: 'h', pos: innerH, color: 'bg-amber-500' })

                      elements.forEach(other => {
                        if (other.id === dragged.id) return
                        const oLeft = other.x
                        const oCenterX = other.x + other.w/2
                        const oRight = other.x + other.w
                        const oTop = other.y
                        const oCenterY = other.y + other.h/2
                        const oBottom = other.y + other.h
                        if (Math.abs(dLeft - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-500' })
                        if (Math.abs(dCenterX - oCenterX) < threshold) guides.push({ type: 'v', pos: oCenterX, color: 'bg-sky-500' })
                        if (Math.abs(dRight - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-500' })
                        if (Math.abs(dTop - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-500' })
                        if (Math.abs(dCenterY - oCenterY) < threshold) guides.push({ type: 'h', pos: oCenterY, color: 'bg-sky-500' })
                        if (Math.abs(dBottom - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-500' })
                      })

                      const uniq = new Map<string, typeof guides[0]>()
                      guides.forEach(g => {
                        const key = `${g.type}-${Math.round(g.pos)}`
                        if (!uniq.has(key)) uniq.set(key, g)
                      })

                      return (
                        <div className="pointer-events-none absolute inset-0 z-20">
                          {Array.from(uniq.values()).map((g, i) => (
                            g.type === 'v' ? (
                              <div key={`v-${i}`} className={`absolute top-0 h-full w-px ${g.color} opacity-80`} style={{ left: g.pos }} />
                            ) : (
                              <div key={`h-${i}`} className={`absolute left-0 w-full h-px ${g.color} opacity-80`} style={{ top: g.pos }} />
                            )
                          ))}
                        </div>
                      )
                    })()}

                    {elements.map(el => {
                      const isSelected = selectedId === el.id
                      return (
                        <div
                          data-element
                          key={el.id}
                          onMouseDown={e => handleMouseDown(e, el)}
                          onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                          onDoubleClick={e => { e.stopPropagation(); if (el.type !== 'logo' && el.type !== 'image' && el.type !== 'badge' && el.type !== 'rectangle' && el.type !== 'circle' && el.type !== 'border' && el.type !== 'line') setEditingId(el.id) }}
                          className={`group absolute cursor-grab select-none rounded p-1 transition active:cursor-grabbing ${isSelected ? 'z-10 ring-2 ring-lime-500 ring-offset-1' : 'hover:z-10 hover:ring-1 hover:ring-lime-300'}`}
                          style={{
                            left: el.x,
                            top: el.y,
                            width: el.w,
                            height: el.h,
                            fontFamily: el.style.fontFamily,
                            fontSize: el.style.fontSize,
                            color: el.style.color,
                            textAlign: el.style.textAlign,
                            fontWeight: el.style.fontWeight,
                            fontStyle: el.style.fontStyle,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            overflow: 'visible',
                          }}
                        >
                          {editingId === el.id ? <textarea autoFocus value={el.content} onChange={e => setElements(prev => prev.map(x => x.id === el.id ? { ...x, content: e.target.value } : x))} onBlur={() => setEditingId(null)} className="h-full w-full resize-none rounded border border-lime-500 bg-white p-1 text-xs outline-none" /> : el.type === 'logo' || el.type === 'image' || el.type === 'badge' ? (el.content ? <img src={el.content} alt="" className="pointer-events-none h-full w-full object-contain" /> : <div className="pointer-events-none flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[10px]"> {el.type} </div>) : <span className="pointer-events-none w-full whitespace-nowrap font-semibold drop-shadow-sm" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{el.content}</span>}
                          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setElements(prev => prev.filter(x => x.id !== el.id)); if (isSelected) setSelectedId(null) }} className={`absolute right-0 top-0 z-30 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-600 text-white shadow ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><X className="size-3" /></button>
                          {isSelected && (
                            <>
                              <div className="pointer-events-none absolute inset-0 rounded border-2 border-lime-500/50" />
                              {(el.type === 'logo' || el.type === 'image' || el.type === 'badge' || el.type === 'rectangle' || el.type === 'circle' || el.type === 'line') && (
                                <>
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'r', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute right-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize width"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'b', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 left-1/2 z-30 h-2 w-6 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize height"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'br', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 right-0 z-30 size-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm bg-lime-600 shadow ring-1 ring-white hover:bg-lime-700"
                                    title="Drag to resize"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'l', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute left-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize from left"
                                  />
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-line/60 bg-muted/20 px-3 py-2 text-[11px] text-mist">
              <span className="font-bold text-foreground">{elements.length} elements</span> · Paper {paperSize} {orientation} · Margin {marginFilter} · Drag to reposition, double-click text to edit
            </div>
          </div>

          <div className="lg:col-span-2 w-full self-start">
            <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden sticky top-4">
              <div className="flex items-center justify-between border-b border-line bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">Properties</p>
                {selected ? <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[9px] font-bold uppercase text-lime-800">{selected.type}</span> : <span className="text-[10px] text-mist">No selection</span>}
              </div>
              <div className="p-3">
                {selected ? (
                  <div className="space-y-3">
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Content</span><textarea value={selected.content} onChange={e => updateSelected({ content: e.target.value })} rows={2} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime" /></label>
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Family</span><select value={selected.style.fontFamily} onChange={e => updateSelected({ style: { fontFamily: e.target.value } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">{GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Size</span><input type="number" value={selected.style.fontSize} onChange={e => updateSelected({ style: { fontSize: Number(e.target.value) } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm" /></label><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Color</span><input type="color" value={selected.style.color} onChange={e => updateSelected({ style: { color: e.target.value } })} className="h-9 w-full rounded-lg border border-line shadow-sm" /></label></div>
                    <div className="flex gap-1.5">{(['left','center','right'] as const).map(a => <button key={a} onClick={() => updateSelected({ style: { textAlign: a } })} className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-medium transition ${selected.style.textAlign === a ? 'border-lime bg-lime text-lime-ink shadow-sm' : 'border-line bg-card text-mist hover:border-lime/50 hover:text-foreground'}`}>{a}</button>)}</div>
                    <div className="flex gap-2 pt-1"><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => selected && deleteSelected(selected.id)}><Trash2 className="size-3" /> Delete</Button><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => { const copy = { ...selected, id: uid(), x: selected.x+20, y: selected.y+20 }; setElements(prev => [...prev, copy]); setSelectedId(copy.id) }}>Duplicate</Button></div>
                  </div>
                ) : <div className="rounded-xl border border-dashed border-line bg-muted/20 p-6 text-center"><div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-muted"><span className="text-lg">⚙️</span></div><p className="text-[11px] font-medium leading-snug text-foreground">No element selected</p><p className="mt-1 text-[11px] leading-snug text-mist">Select an element on the canvas to edit its text, font, size, color, and alignment. Drag elements to reposition.</p></div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
<Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" size="sm" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button></div>
      </div>
    </Modal>
  )
}

function CertificateTemplateForm({ initial, onSave, onBack, branchName, branchId, companyName }: { initial: any; onSave: (t: any) => void; onBack: () => void; branchName?: string; branchId?: string; companyName?: string }) {
  const [elements, setElements] = useState<CertElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [holderType, setHolderType] = useState<'Student' | 'Employee' | 'Member' | 'All'>('All')
  const [certificateType, setCertificateType] = useState('Achievement')
  const [bgColor, setBgColor] = useState('#FFFEF0')
  const [bgImage, setBgImage] = useState('')
  const [bgPattern, setBgPattern] = useState<'none' | 'dots' | 'lines' | 'grid' | 'waves' | 'chevron' | 'stripes' | 'crosshatch' | 'confetti' | 'damask' | 'stars' | 'marble'>('none')
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'ornate' | 'vintage' | 'elegant' | 'classic' | 'modern' | 'gold' | 'silver' | 'floral' | 'thick' | 'striped'>('striped')
  const [orientation, setOrientation] = useState<'Landscape' | 'Portrait'>('Portrait')
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom'>('A4')
  const [marginFilter, setMarginFilter] = useState<'None' | 'Small' | 'Medium' | 'Large' | 'Extra Large'>('Medium')
  const [zoomFilter, setZoomFilter] = useState(100)
  const [showGuides, setShowGuides] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: 'br' | 'r' | 'b' | 'l'; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const leftColRef = useRef<HTMLDivElement | null>(null)
  const [previewMaxH, setPreviewMaxH] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const [elementSearch, setElementSearch] = useState('')
  const selected = elements.find(e => e.id === selectedId) || null
  useEffect(() => {
    if (initial && (initial as any).certificateData) {
      try {
        const data = JSON.parse(String((initial as any).certificateData))
        setElements(data.elements || [])
        setBgColor(data.bgColor || '#FFFEF0')
        setBgImage(data.bgImage || '')
        setBgPattern(data.bgPattern || 'none')
        setBorderStyle(data.borderStyle || 'ornate')
        setOrientation(data.orientation || (initial as any).orientation || (initial as any).pageLayout || 'Portrait')
        setPaperSize(data.paperSize || (initial as any).paperSize || 'A4')
        setMarginFilter(data.marginFilter || (initial as any).marginFilter || 'Medium')
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
      } catch {
        setTemplateName((initial as any).name || (initial as any).templateName || '')
        setHolderType((initial as any).holderType || 'All')
        setCertificateType((initial as any).certificateType || 'Achievement')
        setOrientation((initial as any).orientation || (initial as any).pageLayout || 'Portrait')
        setPaperSize((initial as any).paperSize || 'A4')
        setMarginFilter((initial as any).marginFilter || 'Medium')
      }
    } else if (initial) {
      setTemplateName((initial as any).name || (initial as any).templateName || '')
      setHolderType((initial as any).holderType || 'All')
      setCertificateType((initial as any).certificateType || 'Achievement')
      setOrientation((initial as any).orientation || (initial as any).pageLayout || 'Portrait')
      setPaperSize((initial as any).paperSize || 'A4')
      setMarginFilter((initial as any).marginFilter || 'Medium')
      try {
        const data = JSON.parse(String((initial as any).certificateData || '{}'))
        if (data.elements) setElements(data.elements)
      } catch {}
    } else {
      // Default preview with elements as seen in attached reference
      const paper = getPaperDims()
      const m = getMargin()
      setElements(getDefaultCertificateElements(paper.w, paper.h, m.px))
      setBgColor('#FFFEF0')
      setBorderStyle('striped')
      setBgPattern('none')
      setMarginFilter('Medium')
      setHolderType('All')
      setCertificateType('Achievement')
    }
  }, [initial])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const el = elements.find(x => x.id === dragging.id)
        if (!el || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const scale = getEffectiveScale()
        const x = (e.clientX - rect.left) / scale - dragging.offsetX
        const y = (e.clientY - rect.top) / scale - dragging.offsetY
        setElements(prev => prev.map(it => it.id === dragging.id ? { ...it, x, y } : it))
      }
      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaY = e.clientY - resizing.startY
        const scale = getEffectiveScale()
        setElements(prev => prev.map(it => {
          if (it.id !== resizing.id) return it
          let newW = resizing.startW
          let newH = resizing.startH
          if (resizing.handle === 'r' || resizing.handle === 'br' || resizing.handle === 'l') newW = Math.max(40, resizing.startW + (resizing.handle === 'l' ? -deltaX : deltaX) / scale)
          if (resizing.handle === 'b' || resizing.handle === 'br') newH = Math.max(20, resizing.startH + deltaY / scale)
          if (resizing.handle === 'l') { const newX = it.x + (resizing.startW - newW); return { ...it, w: newW, h: newH, x: newX } }
          return { ...it, w: newW, h: newH }
        }))
      }
    }
    const onUp = () => { setDragging(null); setResizing(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, resizing, elements])

  // Auto-center elements when margin changes (white space around border)
  useEffect(() => {
    const m = getMargin()
    const paper = getPaperDims()
    const innerW = Math.max(100, paper.w - m.px*2)
    setElements(prev => prev.map(el => ({
      ...el,
      x: innerW/2 - el.w/2,
      style: { ...el.style, textAlign: 'center' as const }
    })))
  }, [marginFilter, paperSize, orientation])

  // Auto-fit preview to show fully screen with board and content on tablet/computer
  useEffect(() => {
    // Delay to ensure container is rendered
    const t = setTimeout(() => fitToScreen(), 150)
    return () => clearTimeout(t)
  }, [paperSize, orientation, marginFilter, previewMaxH])

  // Also fit on initial mount for default preview
  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 300)
    return () => clearTimeout(t)
  }, [])
  const uid = () => Math.random().toString(36).slice(2,9)
  const getPaperDims = () => {
    const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }
    const base = sizes[paperSize] || sizes.A4
    return orientation === 'Portrait' ? base : { w: base.h, h: base.w }
  }
  const getMargin = () => {
    const map: Record<string, { mm: number; px: number }> = { None: { mm: 0, px: 0 }, Small: { mm: 10, px: 38 }, Medium: { mm: 15, px: 57 }, Large: { mm: 20, px: 76 }, 'Extra Large': { mm: 25, px: 95 } }
    return map[marginFilter] || map.Medium
  }
  const getEffectiveScale = () => zoomFilter / 100
  const fitToScreen = () => {
    const paper = getPaperDims()
    const container = previewScrollRef.current
    if (!container) {
      setZoomFilter(100)
      return
    }
    // Available space inside the gray preview area (minus padding)
    const availableW = container.clientWidth - 48
    const availableH = (previewMaxH ? Math.min(previewMaxH, 700) : 600) - 32
    const scaleW = availableW / paper.w
    const scaleH = availableH / paper.h
    // Fit fully with some breathing room, clamp 30-100 for default fit (allow up to 200 via slider)
    const fitScale = Math.min(scaleW, scaleH) * 0.92
    const zoom = Math.max(30, Math.min(100, Math.round(fitScale * 100)))
    setZoomFilter(zoom)
  }
  const addElement = (type: CertElement['type'], defaultContent?: string) => {
    const paper = getPaperDims()
    const newEl: CertElement = { id: uid(), type, content: defaultContent || type, x: paper.w/2 - 100, y: paper.h/2 - 20 + elements.length*24, w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200, h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32, style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const addElementAt = (type: CertElement['type'], content: string, clientX: number, clientY: number) => {
    if (!canvasRef.current) { addElement(type, content); return }
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = getEffectiveScale()
    const x = (clientX - rect.left) / scale
    const y = (clientY - rect.top) / scale
    const newEl: CertElement = { id: uid(), type, content: content || type, x: x - 50, y: y - 16, w: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 200, h: type === 'logo' || type === 'image' || type === 'badge' ? 80 : 32, style: { fontFamily: 'Poppins', fontSize: 16, color: '#1a202c', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } }
    setElements(prev => [...prev, newEl]); setSelectedId(newEl.id)
  }
  const updateSelected = (patch: any) => {
    if (!selected) return
    setElements(prev => prev.map(el => {
      if (el.id !== selected.id) return el
      if (patch.style) return { ...el, style: { ...el.style, ...patch.style } }
      if (patch.content !== undefined) return { ...el, content: patch.content }
      return { ...el, ...patch }
    }))
  }
  const deleteSelected = (id: string) => { setElements(prev => prev.filter(e => e.id !== id)); setSelectedId(null) }
  const handleMouseDown = (e: React.MouseEvent, el: CertElement) => {
    e.preventDefault(); e.stopPropagation(); setSelectedId(el.id)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    const scale = getEffectiveScale()
    setDragging({ id: el.id, offsetX: (e.clientX - canvasRect.left)/scale - el.x, offsetY: (e.clientY - canvasRect.top)/scale - el.y })
  }
  const save = () => {
    if (!templateName.trim()) { alert('Template name required'); return }
    const data = { elements, bgColor, bgImage, bgPattern, borderStyle, orientation, paperSize, marginFilter, holderType, certificateType }
    onSave({
      id: (initial as any)?.id || uid(),
      name: templateName,
      templateName,
      holderType,
      certificateType,
      pageLayout: orientation,
      orientation,
      paperSize,
      marginFilter,
      borderStyle,
      pattern: bgPattern,
      backgroundColor: bgColor,
      backgroundImage: bgImage,
      bgColor,
      bgImage,
      bgPattern,
      branch: branchName || (initial as any)?.branch || '',
      branchId: branchId || (initial as any)?.branchId || '',
      company: companyName || (initial as any)?.company || '',
      schoolName: companyName || (initial as any)?.schoolName || '',
      certificateData: JSON.stringify(data),
      createdAt: (initial as any)?.createdAt || new Date().toISOString().slice(0,10)
    })
  }
  const handlePrint = () => { window.print() }
  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 bg-muted/30 -m-4 mb-4 p-4 rounded-t-xl">
        <div className="flex items-center gap-3"><Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onBack}><ArrowLeft className="size-4" /> Back to Templates</Button><span className="rounded-full bg-lime/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-lime-800">Certificate Builder</span></div>
        <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onBack}>Cancel</Button><Button type="button" size="sm" className="rounded-full shadow" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button></div>
      </div>
              <div className="grid grid-cols-12 gap-3 rounded-lg border border-line/60 bg-muted/10 p-3">
          <label className="col-span-12 lg:col-span-4 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Template Name *</span><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Achievement Certificate" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="col-span-6 lg:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Holder Type *</span><select value={holderType} onChange={e => setHolderType(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="All">All</option><option value="Student">Student</option><option value="Employee">Employee</option><option value="Member">Member</option></select></label>
          <label className="col-span-6 lg:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Certificate Type *</span><input value={certificateType} onChange={e => setCertificateType(e.target.value)} placeholder="Achievement" className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm" /></label>
          <label className="col-span-4 lg:col-span-1 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Orientation</span><select value={orientation} onChange={e => setOrientation(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="Portrait">Portrait</option><option value="Landscape">Landscape</option></select></label>
          <label className="col-span-4 lg:col-span-1 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Paper Size</span><select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Custom">Custom</option></select></label>
          <label className="col-span-4 lg:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Margin</span><select value={marginFilter} onChange={e => setMarginFilter(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="None">None (0mm)</option><option value="Small">Small (10mm)</option><option value="Medium">Medium (15mm)</option><option value="Large">Large (20mm)</option><option value="Extra Large">Extra Large (25mm)</option></select></label>
          <label className="col-span-6 lg:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Color</span><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-full rounded-lg border border-line shadow-sm" /></label>
          <label className="col-span-6 lg:col-span-3 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Border Style</span><select value={borderStyle} onChange={e => setBorderStyle(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="striped">Striped Gold (as attached)</option><option value="solid">Solid Gold</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="groove">Groove</option><option value="ridge">Ridge</option><option value="ornate">Ornate Striped</option><option value="vintage">Vintage</option><option value="elegant">Elegant Thin</option><option value="classic">Classic Thick Double</option><option value="modern">Modern Black</option><option value="gold">Gold Frame</option><option value="silver">Silver Frame</option><option value="floral">Floral</option><option value="thick">Thick</option></select></label>
          <label className="col-span-6 lg:col-span-3 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Pattern</span><select value={bgPattern} onChange={e => setBgPattern(e.target.value as any)} className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm"><option value="none">None</option><option value="dots">Dots</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="waves">Waves</option><option value="chevron">Chevron</option><option value="stripes">Stripes</option><option value="crosshatch">Crosshatch</option><option value="confetti">Confetti</option><option value="damask">Damask</option><option value="stars">Stars</option><option value="marble">Marble</option></select></label>
          <label className="col-span-6 lg:col-span-4 flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span><div className="flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm hover:border-lime"><UploadCloud className="size-4" /><span>{bgImage ? 'Change' : 'Upload'}</span><input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBgImage(String(reader.result || '')); reader.readAsDataURL(file); e.target.value = '' }} /></label>{bgImage && <button type="button" onClick={() => setBgImage('')} className="rounded-lg border border-line px-2 py-1 text-[11px]">Clear</button>}</div></label>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div ref={leftColRef} className="lg:col-span-2 w-full self-start">
            <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
              <p className="mb-2 text-[11px] text-mist">Drag to certificate or click to add</p>
              <div className="mb-3">
                <input
                  value={elementSearch}
                  onChange={e => setElementSearch(e.target.value)}
                  placeholder="Search elements..."
                  className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {CERT_PALETTE.filter(item => item.label.toLowerCase().includes(elementSearch.toLowerCase())).map(item => (
                  <button
                    key={item.type+item.label}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, content: item.defaultContent }))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addElement(item.type, item.defaultContent)}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-lime hover:bg-lime/5 active:cursor-grabbing dark:bg-white/[0.04] dark:border-white/10"
                  >
                    <span className="text-[12px] leading-none opacity-40">⋮⋮</span>
                    <span className="flex-1">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex min-w-0 flex-col gap-3 self-start">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => fitToScreen()}>Fit View</Button>
                <Button type="button" size="sm" variant={showGuides ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => setShowGuides(v => !v)}>{showGuides ? 'Guides On' : 'Guides Off'}</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={handlePrint}><Printer className="mr-1 size-3" />Print</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { if (elements.length && confirm(`Clear all ${elements.length} element(s) from canvas?`)) { setElements([]); setSelectedId(null) } }}><Trash2 className="mr-1 size-3" />Clear All</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-[11px] font-medium" onClick={() => { const paper = getPaperDims(); const m = getMargin(); setElements(getDefaultCertificateElements(paper.w, paper.h, m.px)) }}>Load Sample</Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-mist">Zoom</span>
                <input type="range" min={50} max={200} value={zoomFilter} onChange={e => setZoomFilter(Number(e.target.value))} className="h-1 w-24 accent-lime-600" />
                <span className="min-w-[3ch] text-[11px] font-bold text-foreground">{zoomFilter}%</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-zinc-100 p-4 shadow-inner dark:bg-zinc-900/50">
              <div
                ref={previewScrollRef}
                className={`flex min-h-0 w-full justify-center overflow-auto ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                style={previewMaxH ? { maxHeight: previewMaxH, minHeight: 420 } : { minHeight: 560 }}
                onMouseDown={e => {
                  // Only start panning if clicking on the scroll container background, not on an element
                  const target = e.target as HTMLElement
                  if (target.closest('[data-element]')) return
                  if (dragging || resizing) return
                  setIsPanning(true)
                  setPanStart({
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: previewScrollRef.current?.scrollLeft || 0,
                    scrollTop: previewScrollRef.current?.scrollTop || 0,
                  })
                  e.preventDefault()
                }}
                onMouseMove={e => {
                  if (!isPanning || !previewScrollRef.current) return
                  const dx = e.clientX - panStart.x
                  const dy = e.clientY - panStart.y
                  previewScrollRef.current.scrollLeft = panStart.scrollLeft - dx
                  previewScrollRef.current.scrollTop = panStart.scrollTop - dy
                }}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
              >
                <div style={{ width: getPaperDims().w * getEffectiveScale(), height: getPaperDims().h * getEffectiveScale(), flexShrink: 0 }} className="relative bg-white shadow-2xl rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: getPaperDims().w,
                      height: getPaperDims().h,
                      transform: `scale(${getEffectiveScale()})`,
                      transformOrigin: 'top left',
                      backgroundColor: '#ffffff',
                      padding: getMargin().px,
                    }}
                    className="relative overflow-hidden"
                  >
                    <div
                      ref={canvasRef}
                      className="relative h-full w-full overflow-hidden rounded-sm"
                      style={{
                        backgroundColor: bgColor,
                        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        width: '100%',
                        height: '100%',
                      }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                    onDrop={e => {
                      e.preventDefault()
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                        if (data?.type) addElementAt(data.type, data.content || '', e.clientX, e.clientY)
                      } catch {}
                    }}
                    onClick={() => setSelectedId(null)}
                  >
                    {borderStyle !== 'none' && (
                      borderStyle === 'striped' || borderStyle === 'ornate' ? (
                        <div className="pointer-events-none absolute inset-0 z-0 p-2" style={{ background: 'repeating-linear-gradient(45deg, #d69e2e, #d69e2e 10px, #8c5a00 10px, #8c5a00 20px)' }}>
                          <div className="h-full w-full" style={{ backgroundColor: bgColor }} />
                        </div>
                      ) : (
                        <div className="pointer-events-none absolute inset-0 z-0" style={{ border: borderStyle==='solid' ? '4px solid #d69e2e' : borderStyle==='double' ? '8px double #d69e2e' : borderStyle==='dashed' ? '4px dashed #d69e2e' : borderStyle==='dotted' ? '4px dotted #d69e2e' : borderStyle==='thick' ? '16px solid #d69e2e' : borderStyle==='elegant' ? '2px solid #d69e2e' : '4px solid #d69e2e' }} />
                      )
                    )}
                    {/* Guidelines - show when Guides On and dragging */}
                    {showGuides && dragging && (() => {
                      const dragged = elements.find(e => e.id === dragging.id)
                      if (!dragged) return null
                      const m = getMargin()
                      const paper = getPaperDims()
                      const innerW = Math.max(100, paper.w - m.px*2)
                      const innerH = Math.max(100, paper.h - m.px*2)
                      const threshold = 6
                      const guides: { type: 'v' | 'h'; pos: number; color: string }[] = []
                      const dLeft = dragged.x
                      const dCenterX = dragged.x + dragged.w/2
                      const dRight = dragged.x + dragged.w
                      const dTop = dragged.y
                      const dCenterY = dragged.y + dragged.h/2
                      const dBottom = dragged.y + dragged.h

                      const cCenterX = innerW/2
                      const cCenterY = innerH/2
                      if (Math.abs(dCenterX - cCenterX) < threshold) guides.push({ type: 'v', pos: cCenterX, color: 'bg-lime-500' })
                      if (Math.abs(dCenterY - cCenterY) < threshold) guides.push({ type: 'h', pos: cCenterY, color: 'bg-lime-500' })
                      if (Math.abs(dLeft - 0) < threshold) guides.push({ type: 'v', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dRight - innerW) < threshold) guides.push({ type: 'v', pos: innerW, color: 'bg-amber-500' })
                      if (Math.abs(dTop - 0) < threshold) guides.push({ type: 'h', pos: 0, color: 'bg-amber-500' })
                      if (Math.abs(dBottom - innerH) < threshold) guides.push({ type: 'h', pos: innerH, color: 'bg-amber-500' })

                      elements.forEach(other => {
                        if (other.id === dragged.id) return
                        const oLeft = other.x
                        const oCenterX = other.x + other.w/2
                        const oRight = other.x + other.w
                        const oTop = other.y
                        const oCenterY = other.y + other.h/2
                        const oBottom = other.y + other.h
                        if (Math.abs(dLeft - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-500' })
                        if (Math.abs(dCenterX - oCenterX) < threshold) guides.push({ type: 'v', pos: oCenterX, color: 'bg-sky-500' })
                        if (Math.abs(dRight - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-500' })
                        if (Math.abs(dTop - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-500' })
                        if (Math.abs(dCenterY - oCenterY) < threshold) guides.push({ type: 'h', pos: oCenterY, color: 'bg-sky-500' })
                        if (Math.abs(dBottom - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-500' })
                      })

                      const uniq = new Map<string, typeof guides[0]>()
                      guides.forEach(g => {
                        const key = `${g.type}-${Math.round(g.pos)}`
                        if (!uniq.has(key)) uniq.set(key, g)
                      })

                      return (
                        <div className="pointer-events-none absolute inset-0 z-20">
                          {Array.from(uniq.values()).map((g, i) => (
                            g.type === 'v' ? (
                              <div key={`v-${i}`} className={`absolute top-0 h-full w-px ${g.color} opacity-80`} style={{ left: g.pos }} />
                            ) : (
                              <div key={`h-${i}`} className={`absolute left-0 w-full h-px ${g.color} opacity-80`} style={{ top: g.pos }} />
                            )
                          ))}
                        </div>
                      )
                    })()}

                    {elements.map(el => {
                      const isSelected = selectedId === el.id
                      return (
                        <div
                          data-element
                          key={el.id}
                          onMouseDown={e => handleMouseDown(e, el)}
                          onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                          onDoubleClick={e => { e.stopPropagation(); if (el.type !== 'logo' && el.type !== 'image' && el.type !== 'badge' && el.type !== 'rectangle' && el.type !== 'circle' && el.type !== 'border' && el.type !== 'line') setEditingId(el.id) }}
                          className={`group absolute cursor-grab select-none rounded p-1 transition active:cursor-grabbing ${isSelected ? 'z-10 ring-2 ring-lime-500 ring-offset-1' : 'hover:z-10 hover:ring-1 hover:ring-lime-300'}`}
                          style={{
                            left: el.x,
                            top: el.y,
                            width: el.w,
                            height: el.h,
                            fontFamily: el.style.fontFamily,
                            fontSize: el.style.fontSize,
                            color: el.style.color,
                            textAlign: el.style.textAlign,
                            fontWeight: el.style.fontWeight,
                            fontStyle: el.style.fontStyle,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            overflow: 'visible',
                          }}
                        >
                          {editingId === el.id ? <textarea autoFocus value={el.content} onChange={e => setElements(prev => prev.map(x => x.id === el.id ? { ...x, content: e.target.value } : x))} onBlur={() => setEditingId(null)} className="h-full w-full resize-none rounded border border-lime-500 bg-white p-1 text-xs outline-none" /> : el.type === 'logo' || el.type === 'image' || el.type === 'badge' ? (el.content ? <img src={el.content} alt="" className="pointer-events-none h-full w-full object-contain" /> : <div className="pointer-events-none flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[10px]"> {el.type} </div>) : <span className="pointer-events-none w-full whitespace-nowrap font-semibold drop-shadow-sm" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{el.content}</span>}
                          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setElements(prev => prev.filter(x => x.id !== el.id)); if (isSelected) setSelectedId(null) }} className={`absolute right-0 top-0 z-30 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-600 text-white shadow ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><X className="size-3" /></button>
                          {isSelected && (
                            <>
                              <div className="pointer-events-none absolute inset-0 rounded border-2 border-lime-500/50" />
                              {(el.type === 'logo' || el.type === 'image' || el.type === 'badge' || el.type === 'rectangle' || el.type === 'circle' || el.type === 'line') && (
                                <>
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'r', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute right-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize width"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'b', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 left-1/2 z-30 h-2 w-6 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize height"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'br', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute bottom-0 right-0 z-30 size-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm bg-lime-600 shadow ring-1 ring-white hover:bg-lime-700"
                                    title="Drag to resize"
                                  />
                                  <div
                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'l', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                    className="absolute left-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                    title="Drag to resize from left"
                                  />
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-line/60 bg-muted/20 px-3 py-2 text-[11px] text-mist">
              <span className="font-bold text-foreground">{elements.length} elements</span> · Paper {paperSize} {orientation} · Margin {marginFilter} · Drag to reposition, double-click text to edit
            </div>
          </div>

          <div className="lg:col-span-2 w-full self-start">
            <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden sticky top-4">
              <div className="flex items-center justify-between border-b border-line bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">Properties</p>
                {selected ? <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[9px] font-bold uppercase text-lime-800">{selected.type}</span> : <span className="text-[10px] text-mist">No selection</span>}
              </div>
              <div className="p-3">
                {selected ? (
                  <div className="space-y-3">
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Content</span><textarea value={selected.content} onChange={e => updateSelected({ content: e.target.value })} rows={2} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm focus:border-lime focus:ring-1 focus:ring-lime" /></label>
                    <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Family</span><select value={selected.style.fontFamily} onChange={e => updateSelected({ style: { fontFamily: e.target.value } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">{GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Font Size</span><input type="number" value={selected.style.fontSize} onChange={e => updateSelected({ style: { fontSize: Number(e.target.value) } })} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm" /></label><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-mist">Color</span><input type="color" value={selected.style.color} onChange={e => updateSelected({ style: { color: e.target.value } })} className="h-9 w-full rounded-lg border border-line shadow-sm" /></label></div>
                    <div className="flex gap-1.5">{(['left','center','right'] as const).map(a => <button key={a} onClick={() => updateSelected({ style: { textAlign: a } })} className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-medium transition ${selected.style.textAlign === a ? 'border-lime bg-lime text-lime-ink shadow-sm' : 'border-line bg-card text-mist hover:border-lime/50 hover:text-foreground'}`}>{a}</button>)}</div>
                    <div className="flex gap-2 pt-1"><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => selected && deleteSelected(selected.id)}><Trash2 className="size-3" /> Delete</Button><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => { const copy = { ...selected, id: uid(), x: selected.x+20, y: selected.y+20 }; setElements(prev => [...prev, copy]); setSelectedId(copy.id) }}>Duplicate</Button></div>
                  </div>
                ) : <div className="rounded-xl border border-dashed border-line bg-muted/20 p-6 text-center"><div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-muted"><span className="text-lg">⚙️</span></div><p className="text-[11px] font-medium leading-snug text-foreground">No element selected</p><p className="mt-1 text-[11px] leading-snug text-mist">Select an element on the canvas to edit its text, font, size, color, and alignment. Drag elements to reposition.</p></div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
<Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onBack}>Cancel</Button><Button type="button" size="sm" className="rounded-full shadow" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button></div>
    </div>
  )
}







export function EduLeafCrud({ group, leaf, crumb }: { group: Group; leaf: Leaf; crumb: string[] }) {
  const { activeBranchId, branches, schoolName: ctxSchoolName } = useApp() as any
  const branchName = branches.find((b: any) => b.id === activeBranchId)?.name ?? 'Main Branch'
  const schoolName = ctxSchoolName ?? branchName ?? 'School'
  const { t } = useI18n()
  const { push: toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<any>(null)
  const [del, setDel] = useState<any>(null)
  const [certFormActive, setCertFormActive] = useState(false)
  const [certFormRow, setCertFormRow] = useState<any>(null)
  const [certModalOpen, setCertModalOpen] = useState(false)
  const [certModalInitial, setCertModalInitial] = useState<any>(null)
  const [marksheetOpen, setMarksheetOpen] = useState(false)
  const [marksheetInitial, setMarksheetInitial] = useState<any>(null)

  useEffect(() => { setRecords(loadEduRecords(activeBranchId)) }, [activeBranchId])
  useEffect(() => {
    setCertFormActive(false)
    setCertFormRow(null)
    setMarksheetOpen(false)
    setMarksheetInitial(null)
  }, [leaf.id])

  const rows = (records as any)[leaf.id] ?? []
  // Clear all sample data under Certificate Templates List — auto-clear on first load if sample detected
  useEffect(() => {
    if (leaf.id === 'certificateTemplates' && rows.length > 0) {
      const isSampleRow = (r: any) => {
        const id = String(r.id ?? '')
        const name = String(r.templateName ?? r.name ?? '')
        return id.startsWith('seed-') || /sample/i.test(name) || name.trim() === '' || ['Achievement Certificate','Sample Certificate','Test Template'].includes(name.trim())
      }
      // If any sample row exists, clear only sample rows, keep user-created
      const hasSample = rows.some(isSampleRow)
      if (hasSample) {
        const cleaned = rows.filter((r: any) => !isSampleRow(r))
        if (cleaned.length !== rows.length) {
          const updated = { ...records, [leaf.id]: cleaned }
          setRecords(updated as EduRecords)
          saveEduRecords(activeBranchId, updated as EduRecords)
        }
      }
    }
  }, [leaf.id, rows.length])
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r: any) => Object.values(r).some(v => String(v).toLowerCase().includes(term)))
  }, [rows, q])

  const persist = (next: any[]) => {
    const updated = { ...records, [leaf.id]: next }
    setRecords(updated as EduRecords)
    saveEduRecords(activeBranchId, updated as EduRecords)
  }

  const submit = () => {
    if (!edit) return
    // Every saving is under company and specific branch — stamp branch/company
    const stamped = { ...edit, branch: edit.branch || branchName, branchId: activeBranchId, company: (edit as any).company || schoolName, schoolName }
    const exists = rows.some((r: any) => r.id === stamped.id)
    const next = exists ? rows.map((r: any) => r.id === stamped.id ? stamped : r) : [...rows, stamped]
    persist(next)
    toast.success(exists ? 'Record updated' : 'Record created')
    setEdit(null)
  }

  // Exam names: only active-term exams (from examSetup filtered by active academic year if available)
  const examSetupRows = (records as any)['examSetup'] ?? []
  const academicYearRows = (records as any)['academicYear'] ?? []
  const activeYear = academicYearRows.find((r: any) => String(r.status ?? '').toLowerCase() === 'active')?.name ?? ''
  const examNames = useMemo(() => {
    let list = examSetupRows as any[]
    if (activeYear) {
      const filteredByYear = list.filter((r: any) => !r.academicYear || String(r.academicYear).trim() === String(activeYear).trim() || !String(r.academicYear).trim())
      if (filteredByYear.length) list = filteredByYear
    }
    const names = [...new Set(list.map((r: any) => String(r.examName ?? r.name ?? '').trim()).filter(Boolean))]
    return names.length ? names : ['First Term', 'Second Term', 'Final Term']
  }, [examSetupRows, activeYear])

  const markDistributionRows = (records as any)['markDistribution'] ?? []
  const partsForExam = useCallback((examName: string) => {
    const rows = markDistributionRows.filter((r: any) => String(r.examName ?? '').trim() === String(examName).trim())
    return rows.map((r: any) => ({
      subject: String(r.subject ?? r.name ?? '').trim(),
      weight: Number(r.weight ?? 0),
      branch: String(r.branch ?? '').trim(),
    }))
  }, [markDistributionRows])

  const reportOptionChoices = ['Attendance Percentage', 'Grade', 'Rank', 'Remark', 'Signature', 'Photo']

  const leafRowActions = (r: any) => (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => {
        if (leaf.id === 'certificateTemplates') {
          setCertFormRow(r)
          setCertFormActive(true)
          window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: true } }))
        } else if (leaf.id === 'marksheetTemplate') {
          setMarksheetInitial(r)
          setMarksheetOpen(true)
        } else {
          setEdit(r)
        }
      }}><Pencil className="size-3" /></Button>
      <Button size="sm" variant="ghost" onClick={() => setDel(r)}><Trash2 className="size-3" /></Button>
    </div>
  )

  if (leaf.id === 'certificateTemplates' && certFormActive) {
    return (
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-mist">
          <span>Administration</span>{crumb.map((c: string) => <span key={c} className="contents"><span>/</span><span>{c}</span></span>)}<span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
        </div>
        <CertificateTemplateForm
          initial={certFormRow}
          branchName={branchName}
          branchId={activeBranchId}
          companyName={schoolName}
          onSave={(t: any) => {
            const stamped = { ...t, branch: t.branch || branchName, branchId: activeBranchId, company: t.company || schoolName, schoolName }
            const exists = rows.some((r: any) => r.id === stamped.id)
            const next = exists ? rows.map((r: any) => r.id === stamped.id ? stamped : r) : [...rows, stamped]
            persist(next)
            toast.success(exists ? 'Template updated' : 'Template created')
            setCertFormActive(false)
            setCertFormRow(null)
            window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: false } }))
          }}
          onBack={() => {
            setCertFormActive(false)
            setCertFormRow(null)
            window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: false } }))
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>{crumb.map((c: string) => <span key={c} className="contents"><span>/</span><span>{c}</span></span>)}<span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
      </div>
      <PageHeader title={t(leaf.key)} desc={`${t(group.key)} · ${branchName ?? 'Branch'} — Education Management`} />
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${t(leaf.key).toLowerCase()}…`} />
          <div className="flex items-center gap-2">
            {leaf.id === 'certificateTemplates' && (
              <div className="flex items-center gap-1.5">
                {rows.length > 0 && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => {
                    if (confirm(`Clear all ${rows.length} certificate template(s) for ${branchName}? This cannot be undone.`)) {
                      persist([])
                      toast.success('All certificate templates cleared for ' + branchName)
                    }
                  }}><Trash2 className="size-3" /> Clear All</Button>
                )}
                <Button size="sm" variant="outline" className="rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => {
                  if (confirm(`Clear sample data from Certificate Templates list for all branches? This will remove sample templates across all branches.`)) {
                    try {
                      const raw = localStorage.getItem('fitpro_edu_records_v1')
                      if (raw) {
                        const all = JSON.parse(raw)
                        let cleared = 0
                        for (const bid in all) {
                          const bdata = all[bid]
                          if (bdata && Array.isArray(bdata.certificateTemplates)) {
                            cleared += bdata.certificateTemplates.length
                            bdata.certificateTemplates = []
                          }
                        }
                        localStorage.setItem('fitpro_edu_records_v1', JSON.stringify(all))
                        // Also clear current in-memory
                        const updated = { ...records, certificateTemplates: [] }
                        setRecords(updated as EduRecords)
                        saveEduRecords(activeBranchId, updated as EduRecords)
                        toast.success(`Cleared ${cleared} sample template(s) across all branches`)
                      }
                    } catch (e) {
                      persist([])
                      toast.success('Cleared certificate templates for current branch')
                    }
                  }
                }}><Trash2 className="size-3" /> Clear Sample Data</Button>
              </div>
            )}
          <Button size="sm" onClick={() => {
            if (leaf.id === 'certificateTemplates') {
              setCertFormRow(null)
              setCertFormActive(true)
              window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: true } }))
            } else if (leaf.id === 'marksheetTemplate') {
              setMarksheetInitial(null)
              setMarksheetOpen(true)
            } else {
              setEdit({ id: uid() })
            }
          }}><Plus className="size-4" /> {leaf.id === 'certificateTemplates' ? 'New Template' : leaf.id === 'marksheetTemplate' ? 'New Marksheet Template' : `Add ${t(leaf.key)}`}</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                {leaf.fields.filter((f: any) => !f.hideInTable).map((f: any) => <th key={f.key} className="px-3 py-2.5">{f.label}</th>)}
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  {leaf.fields.filter((f: any) => !f.hideInTable).map((f: any) => <td key={f.key} className="px-3 py-2">{String(r[f.key] ?? '—')}</td>)}
                  <td className="px-3 py-2 text-right">{leafRowActions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title={`No ${t(leaf.key).toLowerCase()} yet`} desc="Use Add to create the first record." />}
        </div>
      </div>

      {/* Certificate Template Modal - restored (modal version) */}
      {leaf.id === 'certificateTemplates' && (
        <CertificateBuilderModal
          open={certModalOpen}
          initial={certModalInitial}
          branchName={branchName}
          branchId={activeBranchId}
          companyName={schoolName}
          onClose={() => { setCertModalOpen(false); setCertModalInitial(null) }}
          onSave={(row: any) => {
            const stamped = { ...row, branch: row.branch || branchName, branchId: activeBranchId, company: row.company || schoolName, schoolName }
            const exists = rows.some((r: any) => r.id === stamped.id)
            const next = exists ? rows.map((r: any) => r.id === stamped.id ? stamped : r) : [...rows, stamped]
            persist(next)
            toast.success(exists ? 'Certificate template updated' : 'Certificate template created')
            setCertModalOpen(false)
            setCertModalInitial(null)
          }}
        />
      )}

      {/* Marksheet Template Designer - as per PDF reference (drag & drop with live preview) */}
      {leaf.id === 'marksheetTemplate' && (
        <MarksheetDesignerModal
          open={marksheetOpen}
          initial={marksheetInitial}
          schoolName={schoolName}
          branchName={branchName}
          examNames={examNames}
          partsForExam={partsForExam}
          reportOptionChoices={reportOptionChoices}
          onClose={() => { setMarksheetOpen(false); setMarksheetInitial(null) }}
          onSave={(row: any) => {
            const stamped = { ...row, branch: row.branch || branchName, branchId: activeBranchId, company: row.company || schoolName, schoolName }
            const exists = rows.some((r: any) => r.id === stamped.id)
            const next = exists ? rows.map((r: any) => r.id === stamped.id ? stamped : r) : [...rows, stamped]
            persist(next)
            toast.success(exists ? 'Marksheet template updated' : 'Marksheet template created')
            setMarksheetOpen(false)
            setMarksheetInitial(null)
          }}
        />
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={rows.some((r: any) => r.id === edit?.id) ? `Edit ${t(leaf.key)}` : `Add ${t(leaf.key)}`}>
        {edit && (
          <div className="grid gap-3">
            {leaf.fields.filter((f: any) => !f.hideInForm).map((f: any) => {
              // Universal certificate handling: holderName options based on holderType
              const isCertLeaf = leaf.id.startsWith('certificate')
              const isHolderName = f.key === 'holderName'
              const isHolderType = f.key === 'holderType'
              
              if (isCertLeaf && isHolderName) {
                const holderType = String(edit.holderType ?? 'Student').toLowerCase()
                let holderOptions: any[] = []
                if (holderType === 'employee' || holderType === 'staff') {
                  holderOptions = (records as any)['staffList'] ?? []
                } else if (holderType === 'member') {
                  // Members: try memberList, libraryMembers, or combine students+staff as fallback
                  holderOptions = (records as any)['memberList'] ?? (records as any)['libraryMembers'] ?? (records as any)['studentList'] ?? []
                  // Also include staff as members if no dedicated member list
                  if (!holderOptions.length) {
                    holderOptions = [...((records as any)['studentList'] ?? []), ...((records as any)['staffList'] ?? [])]
                  }
                } else {
                  holderOptions = (records as any)['studentList'] ?? []
                }
                const options = holderOptions.map((r: any) => String(r.name ?? r.title ?? '').trim()).filter(Boolean)
                return (
                  <Field key={f.key} label={f.label} required={f.required}>
                    <Select value={String(edit[f.key] ?? '')} onChange={e => setEdit({ ...edit, [f.key]: e.target.value })}>
                      <option value="">Select {String(edit.holderType ?? 'Student')}…</option>
                      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                    <p className="mt-1 text-[10px] text-mist">Showing {options.length} {String(edit.holderType ?? 'Student').toLowerCase()}s for {String(edit.holderType ?? 'Student')} type</p>
                  </Field>
                )
              }
              
              return (
                <Field key={f.key} label={f.label} required={f.required}>
                  {f.type === 'select' ? (
                    <Select value={String(edit[f.key] ?? '')} onChange={e => setEdit({ ...edit, [f.key]: e.target.value })}>
                      <option value="">Select…</option>
                      {(f.options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      {/* If source is defined, also show source options as fallback */}
                      {f.source && ((records as any)[f.source] ?? []).slice(0, 100).map((r: any) => {
                        const val = String(r[f.valueKey ?? 'name'] ?? '').trim()
                        return val ? <option key={val} value={val}>{val}</option> : null
                      })}
                    </Select>
                  ) : (
                    <Input value={String(edit[f.key] ?? '')} onChange={e => setEdit({ ...edit, [f.key]: e.target.value })} />
                  )}
                </Field>
              )
            })}
            <div className="flex gap-2"><Button className="flex-1" onClick={submit}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${t(leaf.key)}?`}>
        {del && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{String(del[leaf.fields[0].key] || 'this record')}</span>? This cannot be undone.</p>
            <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { persist(rows.filter((r: any) => r.id !== del.id)); toast.success('Record deleted'); setDel(null) }}><Trash2 className="size-4" /> Delete</Button></div>
          </>
        )}
      </Modal>
    </div>
  )
}


export function EduModulePage() {
  const { group: groupId, leaf: leafId } = useParams()
  const { t } = useI18n()
  const group = GROUPS.find((g: any) => g.path === groupId)
  const leaf = group?.leaves.find((l: any) => l.path === leafId)
  if (!group || !leaf) {
    return <Empty title="Section not found" desc="This Education Management section does not exist." />
  }
  return <EduLeafCrud group={group} leaf={leaf} crumb={['Education Management', t(group.key)]} />
}

export default EduModulePage
