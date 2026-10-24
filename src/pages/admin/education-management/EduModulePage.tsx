// @ts-nocheck
import { IssueCardIconButton } from '../../../components/IssueCardButton'
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { DataTable, type Column } from '../../../components/DataTable'
import { AlertTriangle, AlignCenter, AlignLeft, AlignRight, Banknote, Check, ClipboardCheck, LayoutGrid, List, Pencil, Plus, Printer, RotateCcw, Send, Trash2, UploadCloud, Users, X } from 'lucide-react'
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
    <div className="grid gap-2">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        aria-label={ariaLabel}
        placeholder="Type static text, or click a placeholder below to insert it"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {MARKSHEET_CONTENT_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insert(token)}
            title={`Insert {${token}}`}
            className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-mist transition hover:border-lime hover:text-inherit"
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
    <div className="rounded-xl border border-line bg-black/[0.03] p-3 dark:bg-white/[0.04]">
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
  // Caption blocks that appear under signatures — reusable text so they can be brought back when not used
  { token: '', label: 'Class Teacher', custom: true, presetText: 'Class Teacher' },
  { token: '', label: 'Head of School', custom: true, presetText: 'Head of School' },
  { token: '', label: 'Principal', custom: true, presetText: 'Principal' },
  { token: '', label: 'Separator (·)', custom: true, presetText: '·' },
  { token: '', label: 'Blank Line', custom: true, presetText: '__BLANK__' },
  { token: '', label: 'Text', custom: true },
]

/** The starter arrangement a brand-new sheet opens with. */
const DESIGNER_DEFAULT_HEADER =
  '{logo}\n{institute_name}\n{institute_address} · {institute_phone_no} · {institute_email}\n{exam_name}'
const DESIGNER_DEFAULT_MIDDLE =
  '{student_details}\n{marks_table}\n{attendance}\n{grading_scale}\n{teacher_comments}\n{principal_comments}'
const DESIGNER_DEFAULT_FOOTER =
  '{left_signature}\nClass Teacher\n\n{middle_signature}\nHead of School\n\n{right_signature}\nPrincipal\n\nPrinted {print_date}'

const blockLine = (block: SheetBlock) => block.token || block.text || ''

const isEmptyBlock = (block: SheetBlock) => !block.token && !String(block.text ?? '').trim()

/** Blocks -> the token string stored in Header / Footer Content.
 * Consecutive blocks marked `inline` are joined with three spaces on the same
 * printed line, so the designer can place two or more items side-by-side. An
 * empty block becomes a blank line, which the footer groups into columns. */
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

/**
 * Token string -> blocks, so an existing template can be reopened here.
 * A line that is exactly one token becomes that token; a line mixing several
 * tokens (e.g. "{left_signature}   {middle_signature}") is split into multiple
 * blocks marked `inline`, so they appear side-by-side in the designer and can
 * be dragged separately.
 */
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
    // Split keeping {tokens} as separate parts
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
  /** The template being rearranged, or null when designing a new one. */
  initial?: EduRow | null
  schoolName: string
  branchName: string
  examNames: string[]
  /** Mark columns for a given exam, so the preview follows the Exam Name choice. */
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
  /** A closed section leaves the sheet but keeps its blocks, so it can come back. */
  const [openBands, setOpenBands] = useState<Record<BandKey, boolean>>({ header: true, middle: true, footer: true })
  const [blockSearch, setBlockSearch] = useState('')
  /** Bootstrap 5 accordion: only one card open at a time, Header open by default. */
  const [activeAccordion, setActiveAccordion] = useState<BandKey | 'reportOptions'>('header')

  /**
   * Reload whenever the designer opens or is pointed at a different template,
   * so an existing sheet reopens with its arrangement intact. `examNames` is
   * memoised by the caller and `initial` is a stored row, so neither changes
   * identity on every render.
   */
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
      setHeader(parseBlocks(DESIGNER_DEFAULT_HEADER))
      setMiddle(parseBlocks(DESIGNER_DEFAULT_MIDDLE))
      setFooter(parseBlocks(DESIGNER_DEFAULT_FOOTER))
      setOpenBands({ header: true, middle: true, footer: true } as Record<BandKey, boolean>)
      setReportOptions(['Attendance Percentage'])
      return
    }
    setTemplateName(String(initial.templateName ?? ''))
    setLandscape(String(initial.pageLayout ?? '').trim().toLocaleLowerCase() === 'landscape')
    setExamName(String(initial.examName ?? examNames[0] ?? ''))
    const nextHeader = applyAlignments(parseBlocks(String(initial.headerContent ?? '')), (initial as any).headerAlignments)
    const nextMiddle = applyAlignments(parseBlocks(String((initial as any).middleContent ?? DESIGNER_DEFAULT_MIDDLE)), (initial as any).middleAlignments)
    const nextFooter = applyAlignments(parseBlocks(String(initial.footerContent ?? '')), (initial as any).footerAlignments)
    setHeader(nextHeader)
    setMiddle(nextMiddle)
    setFooter(nextFooter)
    // A section saved with nothing in it reopens closed, its tile waiting in Blocks.
    setOpenBands({ header: nextHeader.length > 0, middle: nextMiddle.length > 0, footer: nextFooter.length > 0 } as Record<BandKey, boolean>)
    try {
      const parsed: unknown = JSON.parse(String(initial.reportOptions ?? '[]'))
      setReportOptions(Array.isArray(parsed) ? parsed.map(String) : [])
    } catch {
      setReportOptions([])
    }
  }, [open, initial, examNames])

  const bands: Record<BandKey, SheetBlock[]> = { header, middle, footer }
  const setBand = (band: BandKey, next: SheetBlock[]) => {
    if (band === 'header') setHeader(next)
    else if (band === 'middle') setMiddle(next)
    else setFooter(next)
  }

  const openBand = (band: BandKey) =>
    setOpenBands((map) => (map[band] ? map : { ...map, [band]: true }))

  /** Drop whatever is in flight at `index` of `band`. `forceInline` is used by row drop zones to place side-by-side. */
  const applyDrop = (band: BandKey, index: number, forceInline?: boolean) => {
    const inFlight = drag
    setDrag(null)
    setHoverBand(null)
    if (!inFlight) return
    // A section tile restores its own section; any other block dropped onto a
    // closed section reopens it first, so the drop is never swallowed.
    if (inFlight.from === 'section') { openBand(inFlight.band); return }
    openBand(band)
    if (inFlight.from === 'palette') {
      const { item } = inFlight
      const prev = bands[band][index - 1]
      const shouldInline = forceInline ? true : (index > 0 && prev && !isEmptyBlock(prev))
      // Blank Line drag item creates an empty block that becomes a blank line separator
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
      // Same band: pull it out, then re-insert allowing for the gap removal made.
      const rest = source.filter((_, i) => i !== inFlight.index)
      setBand(band, insertAt(rest, inFlight.index < index ? index - 1 : index, moving))
    } else {
      setBand(inFlight.band, source.filter((_, i) => i !== inFlight.index))
      setBand(band, insertAt(bands[band], index, moving))
    }
  }

  const toggleReportOption = (option: string) =>
    setReportOptions((list) =>
      list.includes(option) ? list.filter((o) => o !== option) : [...list, option])

  const save = () => onSave({
    id: initial?.id ?? uid(),
    branch: branchName,
    examName,
    templateName: templateName.trim() || 'Untitled template',
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
    createdAt: new Date().toISOString().slice(0, 10),
  } as any)

  /** Closed sections, offered back as draggable tiles in the Blocks list. */
  const closedBands = (['header', 'middle', 'footer'] as BandKey[]).filter((band) => !openBands[band])

  const filteredPalette = DESIGNER_PALETTE.filter((item) => {
    const q = blockSearch.trim().toLowerCase()
    if (!q) return true
    return item.label.toLowerCase().includes(q) || item.token.toLowerCase().includes(q) || (item.presetText ?? '').toLowerCase().includes(q)
  })

  const smallLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.4, color: '#6b7280',
  }

  /** A drop band: the ordered, draggable list of blocks that becomes one content field.
   *  Two or more blocks can sit on the same printed line — the second and later
   *  blocks in a row are marked `inline`. The designer now makes this obvious:
   *  each row is a drop target, and a "+ inline" zone at the end of a row lets
   *  you drop a second block side-by-side without touching the tiny toggle. */
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

    const makeRowInline = (rowIdx: number) => {
      const row = rows[rowIdx]
      if (!row || row.isEmpty || row.blocks.length < 2) return
      // Make every block in row after first inline
      const indices = new Set(row.blocks.slice(1).map((x) => x.index))
      setBand(band, blocks.map((b, j) => (indices.has(j) ? { ...b, inline: true } : b)))
    }

    const makeRowNewLines = (rowIdx: number) => {
      const row = rows[rowIdx]
      if (!row || row.isEmpty) return
      const indices = new Set(row.blocks.map((x) => x.index))
      setBand(band, blocks.map((b, j) => (indices.has(j) && j !== row.blocks[0].index ? { ...b, inline: false } : b)))
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
          data-block={fullLabel || 'empty'}
          draggable
          title={fullLabel}
          onDragStart={() => setDrag({ from: 'band', band, index: i })}
          onDragEnd={() => { setDrag(null); setHoverBand(null) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoverBand(band) }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); applyDrop(band, i) }}
          className={`group/block flex max-w-full cursor-grab items-center gap-1 rounded-full border px-2 py-1 text-xs shadow-sm transition active:cursor-grabbing hover:shadow-md ${isSep ? 'shrink-0 border-zinc-200 bg-zinc-50 px-2 text-zinc-500 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-400' : 'min-w-0 max-w-[260px] shrink border-zinc-200 bg-white text-zinc-800 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100'}`}
        >
          <span className="shrink-0 cursor-grab text-[10px] text-zinc-400 group-hover/block:text-zinc-600 dark:text-zinc-500 dark:group-hover/block:text-zinc-300" aria-hidden>⋮⋮</span>
          {block.token ? (
            <span className={`min-w-0 flex-1 truncate font-mono text-[11px] font-medium ${isSep ? 'w-3 text-center text-[14px] leading-none' : 'max-w-[110px]'}`}>{block.token}</span>
          ) : (
            <input
              value={block.text ?? ''}
              aria-label={`${title} text line ${i + 1}`}
              onChange={(e) => setBand(band, blocks.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)))}
              className={`min-w-0 flex-1 truncate rounded-full border bg-transparent px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-lime ${isSep ? 'w-6 shrink-0 text-center border-transparent' : 'max-w-[90px] border-zinc-200 dark:border-white/10'}`}
            />
          )}
          {/* Alignment controls — left / center / right */}
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-white/10">
            {([
              { k: 'left' as const, Icon: AlignLeft },
              { k: 'center' as const, Icon: AlignCenter },
              { k: 'right' as const, Icon: AlignRight },
            ]).map(({ k, Icon }) => (
              <button
                key={k}
                type="button"
                title={`Align ${k}`}
                aria-label={`Align ${k}`}
                onClick={() => setAlign(k)}
                className={`flex size-5 items-center justify-center rounded-full transition ${align === k ? 'bg-white text-black shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
              >
                <Icon className="size-3" />
              </button>
            ))}
          </span>
          <button
            type="button"
            title={i === 0 ? 'First item always starts a new line' : block.inline ? 'Inline with previous — click for new line' : 'New line — click to place inline with previous'}
            aria-label={i === 0 ? 'First item new line' : block.inline ? 'Make new line' : 'Make inline'}
            disabled={i === 0}
            onClick={() => toggleInline(i)}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide transition ${i === 0 ? 'opacity-30 bg-zinc-100 text-zinc-400 dark:bg-white/5' : block.inline ? 'bg-lime-400 text-black shadow-sm hover:bg-lime-300 dark:bg-lime-400' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15'}`}
          >
            {block.inline ? 'Inline' : 'New line'}
          </button>
          <button
            type="button"
            title="Remove"
            aria-label={`Remove ${blockLine(block) || 'text block'}`}
            onClick={() => {
              setBand(band, blocks.filter((_, j) => j !== i))
            }}
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] text-zinc-500 transition hover:bg-rose-500 hover:text-white dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-rose-500"
          >×</button>
        </div>
      )
    }

    return (
      <div
        data-band={band}
        onDragOver={(e) => { e.preventDefault(); setHoverBand(band) }}
        onDragLeave={() => setHoverBand((b) => (b === band ? null : b))}
        onDrop={(e) => { e.preventDefault(); applyDrop(band, blocks.length) }}
        className={`rounded-xl border bg-white p-3 shadow-sm transition dark:bg-zinc-900 ${hoverBand === band ? 'border-lime-400 bg-lime-50/50 shadow-md ring-2 ring-lime-200 dark:border-lime-500 dark:bg-lime-950/20 dark:ring-lime-900' : 'border-zinc-200 dark:border-white/10'}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</p>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">{blocks.length} {blocks.length === 1 ? 'item' : 'items'}</span>
            <button
              type="button"
              title={`Close ${title} section`}
              aria-label={`Close ${title} section`}
              onClick={() => setOpenBands((map) => ({ ...map, [band]: false }))}
              className="flex size-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-rose-500 hover:text-white dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-rose-500"
            >×</button>
          </span>
        </div>
        {blocks.length ? (
          <div className="flex flex-col gap-2">
            {rows.map((row, rIdx) => (
              row.isEmpty ? (
                <div key={`empty-${rIdx}`} className="flex items-center gap-1">
                  <div className="h-px flex-1 bg-line/60" />
                  <span className="text-[9px] uppercase tracking-wide text-mist">blank line — separates columns</span>
                  <div className="h-px flex-1 bg-line/60" />
                  <button
                    type="button"
                    title="Remove blank line"
                    onClick={() => {
                      const idx = row.blocks[0].index
                      setBand(band, blocks.filter((_, j) => j !== idx))
                    }}
                    className="px-1 text-mist hover:text-rose-600"
                  >×</button>
                </div>
              ) : (
                <div
                  key={`row-${rIdx}`}
                  data-row={rIdx}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoverBand(band) }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); applyDrop(band, row.endIndex, true) }}
                  className={`group/row relative flex flex-col gap-2 rounded-xl border p-2.5 shadow-sm transition-all ${hoverBand === band ? 'border-lime-400 bg-lime-50/80 shadow-md dark:border-lime-500 dark:bg-lime-950/20' : row.blocks.length > 1 ? 'border-lime-200 bg-gradient-to-br from-lime-50/60 to-white dark:border-lime-900/50 dark:from-lime-950/20 dark:to-zinc-900' : 'border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {row.blocks.map(({ block, index }) => renderBlock(block, index))}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      {row.blocks.length === 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                          <span className="size-1.5 rounded-full bg-zinc-400" /> 1 item — drop here for inline
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-2.5 py-0.5 text-[10px] font-bold text-lime-800 dark:bg-lime-900/40 dark:text-lime-300">
                            <span className="size-1.5 animate-pulse rounded-full bg-lime-500" /> {row.blocks.length} inline
                          </span>
                          <button
                            type="button"
                            title="Put each item on its own line"
                            onClick={() => makeRowNewLines(rIdx)}
                            className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >Split</button>
                        </>
                      )}
                    </div>
                    <div
                      data-testid={`inline-drop-${band}-${rIdx}`}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-lime-300 bg-lime-50 px-3 py-1 text-[11px] font-bold text-lime-700 shadow-sm transition hover:border-lime-500 hover:bg-lime-100 hover:text-lime-800 group-hover/row:border-lime-400 group-hover/row:bg-lime-100 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-300 dark:hover:bg-lime-900/40"
                    >
                      <span className="text-[13px] leading-none">+</span> inline
                    </div>
                  </div>
                </div>
              )
            ))}
            <button
              type="button"
              onClick={() => {
                const empty: SheetBlock = { uid: uid(), token: '', text: '' }
                setBand(band, [...blocks, empty])
              }}
              className="rounded border border-dashed border-line px-2 py-1 text-[10px] text-mist hover:border-lime hover:text-lime-700"
            >
              + blank line
            </button>
          </div>
        ) : (
          <p className="py-2 text-[11px] italic text-mist">{emptyHint}</p>
        )}
        <p className="mt-2 text-[9px] leading-snug text-mist">Drag a block from <span className="font-semibold">Blocks</span> onto a row's <span className="rounded bg-lime/10 px-1 font-semibold text-lime-700">+ inline</span> zone to place it side-by-side. Use <span className="rounded bg-white border px-1">New line</span> / <span className="rounded bg-lime px-1 text-black">Inline</span> to flip.</p>
      </div>
    )
  }

  /** What a closed section leaves behind: the drop target that brings it back. */
  const bandPlaceholder = (band: BandKey, title: string) => (
    <div
      data-band={band}
      data-band-closed="true"
      onDragOver={(e) => { e.preventDefault(); setHoverBand(band) }}
      onDragLeave={() => setHoverBand((b) => (b === band ? null : b))}
      onDrop={(e) => { e.preventDefault(); applyDrop(band, 0) }}
      className={`rounded-lg border border-dashed p-2 text-center transition ${hoverBand === band ? 'border-lime bg-lime/5' : 'border-line'}`}
    >
      <button
        type="button"
        onClick={() => openBand(band)}
        className="text-[11px] text-mist transition hover:text-lime"
      >
        {title} closed — click, or drop the {title} block here, to restore
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Design — ${String(initial.templateName ?? 'template')}` : 'Drag & Drop Sheet'} xl>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-mist">Template Name</span>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Basic 7 Report Card"
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-mist">Exam Name</span>
            <select
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-sm"
            >
              {examNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-mist">Page Layout</span>
            <select
              value={landscape ? 'Landscape' : 'Portrait'}
              onChange={(e) => setLandscape(e.target.value === 'Landscape')}
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-sm"
            >
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[180px_260px_1fr]">
          {/* Palette */}
          <div className="rounded-lg border border-line p-2">
            <p style={smallLabel}>Blocks</p>
            <p className="mb-1 text-[10px] text-mist">Drag onto a band →</p>
            <div className="mb-2">
              <input
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
                placeholder="Search blocks…"
                aria-label="Search blocks"
                className="w-full rounded border border-line bg-transparent px-2 py-1 text-xs placeholder:text-mist/60 focus:border-lime focus:outline-none"
              />
            </div>
            {closedBands.length ? (
              <div className="mb-2 border-b border-line pb-2">
                <p style={smallLabel}>Sections</p>
                <p className="mb-1 text-[10px] text-mist">Closed — drag back to restore</p>
                <div className="flex flex-col gap-1">
                  {closedBands.map((band) => (
                    <div
                      key={band}
                      data-palette={`section:${band}`}
                      draggable
                      onDragStart={() => setDrag({ from: 'section', band })}
                      onDragEnd={() => { setDrag(null); setHoverBand(null) }}
                      className="cursor-grab rounded border border-dashed border-lime/70 bg-lime/5 px-2 py-1 text-xs font-semibold transition hover:border-lime active:cursor-grabbing"
                    >
                      {band === 'header' ? 'Header' : 'Footer'} section
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              {filteredPalette.length ? filteredPalette.map((item) => (
                <div
                  key={item.label}
                  data-palette={item.token || 'text'}
                  draggable
                  onDragStart={() => setDrag({ from: 'palette', item })}
                  onDragEnd={() => { setDrag(null); setHoverBand(null) }}
                  onClick={() => {
                    // Click to add to hovered band, or header if none hovered — easier than drag for blank line
                    const target = hoverBand ?? 'header'
                    const isBlank = item.label === 'Blank Line' || item.presetText === '__BLANK__'
                    const newBlock: SheetBlock = {
                      uid: uid(),
                      token: isBlank ? '' : item.token,
                      text: isBlank ? '' : (item.custom ? (item.presetText ?? 'Your text here') : ''),
                      inline: false,
                    }
                    setBand(target, [...bands[target], newBlock])
                    if (!openBands[target]) setOpenBands((m) => ({ ...m, [target]: true }))
                  }}
                  title="Drag to band or click to add to header"
                  className="cursor-grab rounded border border-line bg-black/[0.02] px-2 py-1 text-xs transition hover:border-lime active:cursor-grabbing dark:bg-white/[0.04]"
                >
                  {item.label}
                </div>
              )) : (
                <p className="py-2 text-[11px] italic text-mist">No blocks match “{blockSearch}”</p>
              )}
            </div>
          </div>

          {/* Bootstrap 5 accordion: Header, Middle, Footer, Report Options — only one open, Header default open */}
          <div id="marksheet-accordion" className="accordion flex max-h-[68vh] flex-col overflow-y-auto rounded-lg border border-line divide-y divide-line bg-white/[0.01]">
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
                    <button
                      type="button"
                      onClick={() => setActiveAccordion(isActive ? null as any : key)}
                      aria-expanded={isActive}
                      aria-controls={`collapse-${key}`}
                      className={`accordion-button flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-bold transition ${isActive ? 'bg-lime/10 text-lime-900 dark:bg-lime/10 dark:text-lime-100' : 'bg-white/[0.02] text-mist hover:text-inherit hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`inline-flex size-5 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold transition dark:bg-white/10 ${isActive ? 'rotate-180' : ''}`}>⌄</span>
                        {title}
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isClosed ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-black/5 text-mist dark:bg-white/10'}`}>
                          {bands[key].length} {bands[key].length === 1 ? 'item' : 'items'}{isClosed ? ' · closed' : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          onClick={(e) => { e.stopPropagation(); setOpenBands((m) => ({ ...m, [key]: !m[key] })) }}
                          title={isClosed ? 'Restore section' : 'Close section'}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isClosed ? 'bg-lime text-black' : 'bg-black/5 text-mist hover:bg-rose-500/20 hover:text-rose-600 dark:bg-white/10'}`}
                        >
                          {isClosed ? 'Restore' : '×'}
                        </span>
                      </span>
                    </button>
                  </h2>
                  <div
                    id={`collapse-${key}`}
                    className={`accordion-collapse ${isActive ? 'show visible' : ''} ${isActive ? 'block visible' : 'hidden'}`}
                    data-bs-parent="#marksheet-accordion"
                  >
                    <div className="accordion-body bg-black/[0.02] p-2 dark:bg-white/[0.02]">
                      {isClosed
                        ? bandPlaceholder(key, title)
                        : bandEditor(key, title, hint)}
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Report Options accordion card */}
            <div className="accordion-item">
              <h2 className="accordion-header m-0">
                <button
                  type="button"
                  onClick={() => setActiveAccordion(activeAccordion === 'reportOptions' ? null as any : 'reportOptions')}
                  aria-expanded={activeAccordion === 'reportOptions'}
                  aria-controls="collapse-reportOptions"
                  className={`accordion-button flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-bold transition ${activeAccordion === 'reportOptions' ? 'bg-lime/10 text-lime-900 dark:bg-lime/10 dark:text-lime-100' : 'bg-white/[0.02] text-mist hover:text-inherit hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex size-5 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold transition dark:bg-white/10 ${activeAccordion === 'reportOptions' ? 'rotate-180' : ''}`}>⌄</span>
                    Report Options
                    <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-mist dark:bg-white/10">
                      {reportOptions.length} selected
                    </span>
                  </span>
                </button>
              </h2>
              <div
                id="collapse-reportOptions"
                className={`accordion-collapse ${activeAccordion === 'reportOptions' ? 'show block visible' : 'hidden'}`}
                data-bs-parent="#marksheet-accordion"
              >
                <div className="accordion-body bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                  <p style={smallLabel}>Report Options</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                    {reportOptionChoices.map((option) => (
                      <label key={option} className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={reportOptions.includes(option)}
                          onChange={() => toggleReportOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live sheet */}
          <div>
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

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={save}>{initial ? 'Update Template' : 'Save Template'}</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * Certificate Builder — free-position drag & drop like Tutor LMS
 * https://www.youtube.com/watch?v=Nb4OB6LJ4TM
 * ------------------------------------------------------------------------ */

type CertElementType = 'logo' | 'badge' | 'heading' | 'text' | 'student_name' | 'course' | 'date' | 'signature' | 'rectangle' | 'circle' | 'border' | 'line'
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
  { type: 'course', label: 'Course / Exam', defaultContent: 'First Term Examination' },
  { type: 'date', label: 'Date', defaultContent: 'Date: 2024-05-15' },
  { type: 'signature', label: 'Signature', defaultContent: 'Principal' },
  { type: 'logo', label: 'Logo / Image', defaultContent: '' },
  { type: 'badge', label: 'Badge', defaultContent: '' },
  { type: 'line', label: 'Line', defaultContent: '' },
  { type: 'rectangle', label: 'Rectangle', defaultContent: '' },
  { type: 'circle', label: 'Circle', defaultContent: '' },
  { type: 'border', label: 'Border Frame', defaultContent: '' },
]

function CertificateBuilderModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: any; onSave: (t: any) => void }) {
  const [elements, setElements] = useState<CertElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState('')
  const [bgPattern, setBgPattern] = useState<'none' | 'dots' | 'lines' | 'grid'>('none')
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'double' | 'ornate'>('solid')
  const [orientation, setOrientation] = useState<'Landscape' | 'Portrait'>('Portrait')
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom'>('A4')
  const [zoomFilter, setZoomFilter] = useState(100)
  const [showGuides, setShowGuides] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: 'br' | 'r' | 'b' | 'l'; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const selected = elements.find(e => e.id === selectedId) || null

  useEffect(() => {
    if (!open) return
    if (initial && (initial as any).certificateData) {
      try {
        const data = JSON.parse(String((initial as any).certificateData))
        setElements(data.elements || [])
        setBgColor(data.bgColor || '#ffffff')
        setBgImage(data.bgImage || '')
        setBgPattern(data.bgPattern || 'none')
        setBorderStyle(data.borderStyle || 'solid')
        setOrientation(data.orientation || 'Portrait')
        setPaperSize(data.paperSize || 'A4')
        setZoomFilter(data.zoomFilter || 100)
        setTemplateName(String(initial.templateName || ''))
      } catch {
        // fallback
      }
    } else if (!initial) {
      // Default certificate template like Tutor LMS
      setTemplateName('')
      setBgColor('#fffef7')
      setBgImage('')
      setBgPattern('none')
      setBorderStyle('ornate')
      setOrientation('Portrait')
      setPaperSize('A4')
      setZoomFilter(100)
      setElements([
        { id: uid(), type: 'logo', x: 350, y: 30, w: 100, h: 60, content: '', style: { fontFamily: 'Manrope', fontSize: 14, color: '#000', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'heading', x: 150, y: 110, w: 500, h: 50, content: 'Certificate of Achievement', style: { fontFamily: 'Playfair Display', fontSize: 32, color: '#1a365d', textAlign: 'center', fontWeight: '700', fontStyle: 'normal' } },
        { id: uid(), type: 'line', x: 200, y: 165, w: 400, h: 4, content: '', style: { fontFamily: 'Inter', fontSize: 14, color: '#d69e2e', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'text', x: 200, y: 180, w: 400, h: 30, content: 'This is to certify that', style: { fontFamily: 'Inter', fontSize: 16, color: '#4a5568', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'student_name', x: 200, y: 220, w: 400, h: 40, content: 'Ama Owusu', style: { fontFamily: 'Sora', fontSize: 28, color: '#d69e2e', textAlign: 'center', fontWeight: '700', fontStyle: 'normal' } },
        { id: uid(), type: 'line', x: 250, y: 265, w: 300, h: 4, content: '', style: { fontFamily: 'Inter', fontSize: 14, color: '#d69e2e', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'text', x: 150, y: 280, w: 500, h: 60, content: 'has successfully completed the course with distinction', style: { fontFamily: 'Inter', fontSize: 14, color: '#4a5568', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'course', x: 200, y: 350, w: 400, h: 30, content: 'First Term Examination', style: { fontFamily: 'Montserrat', fontSize: 18, color: '#2d3748', textAlign: 'center', fontWeight: '700', fontStyle: 'normal' } },
        { id: uid(), type: 'line', x: 200, y: 390, w: 400, h: 4, content: '', style: { fontFamily: 'Inter', fontSize: 14, color: '#2d3748', textAlign: 'center', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'date', x: 100, y: 450, w: 150, h: 30, content: 'Date: 2024-05-15', style: { fontFamily: 'Inter', fontSize: 12, color: '#718096', textAlign: 'left', fontWeight: '400', fontStyle: 'normal' } },
        { id: uid(), type: 'signature', x: 550, y: 450, w: 150, h: 60, content: 'Principal', style: { fontFamily: 'Inter', fontSize: 12, color: '#2d3748', textAlign: 'right', fontWeight: '400', fontStyle: 'normal' } },
      ])
    }
  }, [open, initial])

  const addElementAt = (type: CertElementType, defaultContent: string, x: number, y: number) => {
    const newEl: CertElement = {
      id: uid(),
      type,
      x: Math.max(0, Math.min(x, (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return (orientation === 'Portrait' ? base.w : base.h) - 100 })())),
      y: Math.max(0, Math.min(y, (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return (orientation === 'Portrait' ? base.h : base.w) - 50 })())),
      w: type === 'logo' || type === 'badge' ? 100 : type === 'line' ? 400 : type === 'rectangle' || type === 'border' ? 600 : 300,
      h: type === 'logo' || type === 'badge' ? 80 : type === 'line' ? 4 : type === 'heading' ? 50 : type === 'rectangle' ? 400 : type === 'border' ? 500 : 30,
      content: defaultContent || (type === 'text' ? 'New Text' : ''),
      style: {
        fontFamily: type === 'heading' ? 'Playfair Display' : 'Inter',
        fontSize: type === 'heading' ? 28 : type === 'student_name' ? 24 : 14,
        color: type === 'heading' ? '#1a365d' : '#2d3748',
        textAlign: 'center',
        fontWeight: type === 'heading' || type === 'student_name' || type === 'course' ? '700' : '400',
        fontStyle: 'normal',
        backgroundColor: type === 'rectangle' ? '#f7fafc' : undefined,
        borderWidth: type === 'rectangle' || type === 'border' ? 2 : undefined,
        borderColor: type === 'rectangle' || type === 'border' ? '#d69e2e' : undefined,
        borderRadius: type === 'circle' ? 999 : type === 'rectangle' ? 8 : 0,
      }
    }
    setElements(prev => [...prev, newEl])
    setSelectedId(newEl.id)
  }

  const addElement = (type: CertElementType, defaultContent: string) => {
    addElementAt(type, defaultContent, 250 + Math.random()*100, 200 + Math.random()*100)
  }

  const updateSelected = (patch: Partial<CertElement> | ((el: CertElement) => Partial<CertElement>)) => {
    if (!selectedId) return
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el
      const p = typeof patch === 'function' ? patch(el) : patch
      return { ...el, ...p, style: { ...el.style, ...(p as any).style } } as CertElement
    }))
  }

  const handleMouseDown = (e: React.MouseEvent, el: CertElement) => {
    e.stopPropagation()
    setSelectedId(el.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setDragging({ id: el.id, offsetX: e.clientX - rect.left - el.x, offsetY: e.clientY - rect.top - el.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    // Resizing — for Line, Circle, Rectangle
    if (resizing) {
      const dx = e.clientX - resizing.startX
      const dy = e.clientY - resizing.startY
      let newW = resizing.startW
      let newH = resizing.startH
      if (resizing.handle === 'br') {
        newW = Math.max(20, resizing.startW + dx)
        newH = Math.max(4, resizing.startH + dy)
      } else if (resizing.handle === 'r') {
        newW = Math.max(20, resizing.startW + dx)
      } else if (resizing.handle === 'l') {
        newW = Math.max(20, resizing.startW - dx)
      } else if (resizing.handle === 'b') {
        newH = Math.max(4, resizing.startH + dy)
      }
      setElements(prev => prev.map(el => {
        if (el.id !== resizing.id) return el
        // For Circle keep aspect ratio-ish but allow free for now
        // For Line keep height small but allow width change
        if (el.type === 'line') {
          return { ...el, w: newW, h: Math.max(2, Math.min(newH, 20)) }
        }
        if (el.type === 'circle') {
          const size = Math.max(newW, newH)
          return { ...el, w: Math.max(20, size), h: Math.max(20, size) }
        }
        return { ...el, w: newW, h: newH }
      }))
      return
    }
    if (!dragging) return
    let x = e.clientX - rect.left - dragging.offsetX
    let y = e.clientY - rect.top - dragging.offsetY
    const getPaper = () => {
      const sizes: Record<string, { w: number; h: number }> = {
        A4: { w: 794, h: 1123 },
        A3: { w: 1123, h: 1587 },
        Letter: { w: 816, h: 1056 },
        Legal: { w: 816, h: 1344 },
        Custom: { w: 800, h: 600 },
      }
      const base = sizes[paperSize] || sizes.A4
      return orientation === 'Portrait' ? { w: base.w, h: base.h } : { w: base.h, h: base.w }
    }
    const { w: maxW, h: maxH } = getPaper()
    // Dynamic snap like drawing/design tools — snap to other elements, canvas center, edges
    if (showGuides) {
      const el = elements.find(e => e.id === dragging.id)
      if (el) {
        const threshold = 8
        const dW = el.w
        const dH = el.h
        // Snap candidates
        const snapX: number[] = []
        const snapY: number[] = []
        // Canvas center and edges
        snapX.push(maxW/2 - dW/2, 0, maxW - dW)
        snapY.push(maxH/2 - dH/2, 0, maxH - dH)
        // Other elements
        elements.forEach(other => {
          if (other.id === el.id) return
          snapX.push(other.x, other.x + other.w/2 - dW/2, other.x + other.w - dW, other.x + other.w, other.x - dW)
          snapY.push(other.y, other.y + other.h/2 - dH/2, other.y + other.h - dH, other.y + other.h, other.y - dH)
        })
        // Find closest snap within threshold
        for (const sx of snapX) {
          if (Math.abs(x - sx) < threshold) { x = sx; break }
        }
        for (const sy of snapY) {
          if (Math.abs(y - sy) < threshold) { y = sy; break }
        }
      }
    }
    setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x: Math.max(0, Math.min(x, maxW - el.w)), y: Math.max(0, Math.min(y, maxH - el.h)) } : el))
  }

  const handleMouseUp = () => { setDragging(null); setResizing(null) }

  const save = () => {
    const certData = JSON.stringify({ elements, bgColor, bgImage, bgPattern, borderStyle, orientation, paperSize, zoomFilter })
    onSave({
      id: initial?.id ?? uid(),
      branch: 'Certificate',
      templateName: templateName.trim() || 'Untitled Certificate',
      pageLayout: 'Landscape',
      certificateData: certData,
      headerContent: '',
      middleContent: '',
      footerContent: '',
      backgroundImage: bgImage,
      reportOptions: '[]',
      createdAt: new Date().toISOString().slice(0, 10),
    } as any)
  }

  const deleteSelected = (id?: string) => {
    const targetId = id || selectedId
    if (!targetId) return
    setElements(prev => prev.filter(e => e.id !== targetId))
    setSelectedId(null)
  }

  // Delete selected element via keyboard (Delete / Backspace) directly on certificate
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target as any)?.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setElements(prev => prev.filter(el => el.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedId])

  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Certificate Template' : 'New Certificate Template'} size="full">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Template Name</span>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Achievement Certificate" className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Color</span>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-16 rounded border border-line" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Border Style</span>
            <select value={borderStyle} onChange={e => setBorderStyle(e.target.value as any)} className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="solid">Solid Gold</option>
              <option value="double">Double</option>
              <option value="ornate">Ornate Striped</option>
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Pattern</span>
            <select value={bgPattern} onChange={e => setBgPattern(e.target.value as any)} className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="dots">Dots</option>
              <option value="lines">Lines</option>
              <option value="grid">Grid</option>
            </select>
          </label>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-black/[0.02] px-3 py-2 text-sm text-mist transition hover:border-lime hover:text-inherit dark:bg-white/[0.04]">
              <UploadCloud className="size-4" />
              <span>{bgImage ? 'Change file' : 'Select file'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => setBgImage(String(reader.result || ''))
                reader.readAsDataURL(file)
                e.target.value = ''
              }} />
            </label>
            {bgImage && (
              <div className="flex gap-1">
                <button type="button" onClick={() => setBgImage('')} className="rounded border border-line px-2 py-0.5 text-[10px] text-mist hover:border-rose-300 hover:text-rose-600">Remove background</button>
                <span className="text-[10px] text-mist">Applied to preview →</span>
              </div>
            )}
          </div>
        </div>

        {/* Orientation and Paper Size — below Border style, Pattern, Background image */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Orientation</span>
            <select value={orientation} onChange={e => setOrientation(e.target.value as any)} className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm">
              <option value="Landscape">Landscape</option>
              <option value="Portrait">Portrait</option>
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Paper Size</span>
            <select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm">
              <option value="A4">A4 (Default)</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="Custom">Custom (800×600)</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 grid-cols-12">
          {/* Elements + Properties — col-3 — Properties below Elements */}
          <div className="col-span-12 lg:col-span-3 space-y-3">
            <div className="rounded-lg border border-line p-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-mist">Elements</p>
              <p className="mb-2 text-[10px] text-mist">Drag to certificate or click to add</p>
              <div className="flex flex-col gap-1">
                {CERT_PALETTE.map(item => (
                  <button
                    key={item.type+item.label}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, content: item.defaultContent }))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addElement(item.type, item.defaultContent)}
                    className="flex cursor-grab items-center gap-2 rounded border border-line bg-black/[0.02] px-2 py-1.5 text-left text-xs transition active:cursor-grabbing hover:border-lime hover:bg-lime/5 dark:bg-white/[0.04]"
                  >
                    <span className="text-[10px] opacity-50">⋮⋮</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Properties — col-3 below Elements */}
            <div className="space-y-3">
              <div className="rounded-lg border border-line p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-mist">Properties</p>
                {selected ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-mist">Content</span>
                      <textarea value={selected.content} onChange={e => updateSelected({ content: e.target.value })} rows={2} className="w-full rounded border border-line bg-transparent px-2 py-1 text-xs" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] text-mist">Font Family (Google Fonts)</span>
                      <select value={selected.style.fontFamily} onChange={e => updateSelected({ style: { ...selected.style, fontFamily: e.target.value } })} className="w-full rounded border border-line bg-transparent px-2 py-1 text-xs">
                        {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] text-mist">Font Size</span>
                        <input type="number" value={selected.style.fontSize} onChange={e => updateSelected({ style: { ...selected.style, fontSize: Number(e.target.value) } })} className="w-full rounded border border-line bg-transparent px-2 py-1 text-xs" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] text-mist">Color</span>
                        <input type="color" value={selected.style.color} onChange={e => updateSelected({ style: { ...selected.style, color: e.target.value } })} className="h-7 w-full rounded border border-line" />
                      </label>
                    </div>
                    <div className="flex gap-1">
                      {(['left','center','right'] as const).map(a => (
                        <button key={a} onClick={() => updateSelected({ style: { ...selected.style, textAlign: a } })} className={`flex flex-1 items-center justify-center rounded border px-2 py-1 text-[11px] ${selected.style.textAlign === a ? 'border-lime bg-lime/20 text-lime-800' : 'border-line text-mist'}`}>
                          <span className="flex items-center gap-1"><AlignLeft className={a==='left'?'size-3':'hidden'} /><AlignCenter className={a==='center'?'size-3':'hidden'} /><AlignRight className={a==='right'?'size-3':'hidden'} />{a}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => updateSelected({ style: { ...selected.style, fontWeight: selected.style.fontWeight === '700' ? '400' : '700' } })} className={`flex-1 rounded border px-2 py-1 text-xs font-bold ${selected.style.fontWeight === '700' ? 'border-lime bg-lime/20' : 'border-line'}`}>B</button>
                      <button onClick={() => updateSelected({ style: { ...selected.style, fontStyle: selected.style.fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`flex-1 rounded border px-2 py-1 text-xs italic ${selected.style.fontStyle === 'italic' ? 'border-lime bg-lime/20' : 'border-line'}`}>I</button>
                    </div>
                    {selected.type === 'logo' || selected.type === 'badge' ? (
                      <div className="block space-y-2">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-mist">Background Image</span>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-black/[0.02] px-3 py-2.5 text-sm text-mist transition hover:border-lime hover:text-inherit dark:bg-white/[0.04]">
                          <UploadCloud className="size-4" />
                          <span>{selected.content ? 'Change file' : 'Select file'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = () => updateSelected({ content: String(reader.result || '') })
                            reader.readAsDataURL(file)
                            e.target.value = ''
                          }} />
                        </label>
                        <input value={selected.content} onChange={e => updateSelected({ content: e.target.value })} placeholder="Or paste image URL" className="w-full rounded border border-line bg-transparent px-2 py-1 text-[10px]" />
                        {selected.content && <img src={selected.content} alt="preview" className="h-20 w-full rounded-md object-contain" />}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => selected && deleteSelected(selected.id)}><Trash2 className="size-3" /> Delete</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { const copy = { ...selected, id: uid(), x: selected.x+20, y: selected.y+20 }; setElements(prev => [...prev, copy]); setSelectedId(copy.id) }}>Duplicate</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-mist">Select an element on canvas to edit its text, Google Fonts, size, color, alignment.</p>
                )}
              </div>

            </div>
          </div>

          {/* Canvas holder — col-9 — Live Preview fully visible on preview card */}
          <div className="col-span-12 lg:col-span-9 space-y-3">
            {/* Live Preview header — like attached image */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-2 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide">LIVE PREVIEW - {paperSize} {orientation.toUpperCase()}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setZoomFilter(100)} className="rounded border border-line px-2 py-0.5 text-[10px] hover:border-lime">Fit</button>
                  <button type="button" onClick={() => setShowGuides(v => !v)} className={`rounded border px-2 py-0.5 text-[10px] ${showGuides ? 'border-lime bg-lime/20 text-lime-800' : 'border-line hover:border-lime'}`}>Guides</button>
                  <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded border border-line bg-black/[0.02] px-2 py-0.5 text-[10px] hover:border-lime dark:bg-white/[0.05]">
                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                    Print
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setZoomFilter(z => Math.max(50, z-10))} className="grid size-6 place-items-center rounded border border-line text-[12px] hover:border-lime">−</button>
                <div className="relative h-2 w-[160px] rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div className="absolute left-0 top-0 h-2 rounded-full bg-lime-500" style={{ width: `${((zoomFilter-50)/100)*100}%` }} />
                  <input type="range" min={50} max={150} step={5} value={zoomFilter} onChange={e => setZoomFilter(Number(e.target.value))} className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent accent-zinc-800 dark:accent-white" />
                </div>
                <button type="button" onClick={() => setZoomFilter(z => Math.min(150, z+10))} className="grid size-6 place-items-center rounded border border-line text-[12px] hover:border-lime">+</button>
                <span className="min-w-[36px] text-right text-[11px] font-bold">{zoomFilter}%</span>
              </div>
            </div>

            {/* Canvas — fully visible on preview card — responsive */}
            <div className="overflow-auto rounded-lg border border-line bg-zinc-100 p-2 dark:bg-zinc-900 lg:p-4">
              <div className="flex justify-center">
                <div
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={() => setSelectedId(null)}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                  onDrop={e => {
                    e.preventDefault()
                    try {
                      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}')
                      if (!data.type) return
                      const rect = canvasRef.current?.getBoundingClientRect()
                      if (!rect) return
                      const x = e.clientX - rect.left - 50
                      const y = e.clientY - rect.top - 15
                      addElementAt(data.type as CertElementType, data.content || '', x, y)
                    } catch {}
                  }}
                  className="relative mx-auto overflow-hidden rounded-lg bg-white shadow-lg"
                  style={{
                    width: (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return orientation === 'Portrait' ? base.w : base.h })(),
                    height: (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return orientation === 'Portrait' ? base.h : base.w })(),
                    maxWidth: '100%',
                    aspectRatio: `${(() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; const w = orientation === 'Portrait' ? base.w : base.h; const h = orientation === 'Portrait' ? base.h : base.w; return `${w} / ${h}` })()}`,
                    transform: `scale(${zoomFilter/100})`,
                    transformOrigin: 'top center',
                    backgroundColor: bgColor,
                    backgroundImage: bgImage ? `url(${bgImage})` : bgPattern === 'dots' ? 'radial-gradient(#00000020 1px, transparent 1px)' : bgPattern === 'lines' ? 'repeating-linear-gradient(45deg, #00000008, #00000008 10px, transparent 10px, transparent 20px)' : bgPattern === 'grid' ? 'linear-gradient(#00000010 1px, transparent 1px), linear-gradient(90deg, #00000010 1px, transparent 1px)' : undefined,
                    backgroundSize: bgImage ? 'cover' : bgPattern === 'dots' ? '20px 20px' : bgPattern === 'grid' ? '20px 20px' : undefined,
                    backgroundPosition: bgImage ? 'center' : undefined,
                    backgroundRepeat: bgImage ? 'no-repeat' : undefined,
                    border: borderStyle === 'none' ? 'none' : borderStyle === 'solid' ? '4px solid #d69e2e' : borderStyle === 'double' ? '8px double #d69e2e' : '12px solid transparent',
                    borderImage: borderStyle === 'ornate' ? 'repeating-linear-gradient(45deg, #d69e2e, #d69e2e 10px, #b7791f 10px, #b7791f 20px) 12' : undefined,
                  }}
                >
                  {/* Dynamic guide lines — like drawing/design tools (Figma) — show only when aligning */}
                  {showGuides && (
                    <>
                      {/* Faint static center reference when not dragging */}
                      {!dragging && (
                        <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
                          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-zinc-400/30" />
                          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-zinc-400/30" />
                        </div>
                      )}
                      {/* Dynamic guides when dragging */}
                      {dragging && (() => {
                        const dragged = elements.find(e => e.id === dragging.id)
                        if (!dragged) return null
                        const paperW = (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return orientation === 'Portrait' ? base.w : base.h })()
                        const paperH = (() => { const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }; const base = sizes[paperSize] || sizes.A4; return orientation === 'Portrait' ? base.h : base.w })()
                        const threshold = 6
                        const guides: { type: 'v' | 'h'; pos: number; color: string }[] = []
                        const dLeft = dragged.x
                        const dCenterX = dragged.x + dragged.w/2
                        const dRight = dragged.x + dragged.w
                        const dTop = dragged.y
                        const dCenterY = dragged.y + dragged.h/2
                        const dBottom = dragged.y + dragged.h

                        // Canvas center
                        const cCenterX = paperW/2
                        const cCenterY = paperH/2
                        if (Math.abs(dCenterX - cCenterX) < threshold) guides.push({ type: 'v', pos: cCenterX, color: 'bg-lime-500' })
                        if (Math.abs(dCenterY - cCenterY) < threshold) guides.push({ type: 'h', pos: cCenterY, color: 'bg-lime-500' })
                        // Canvas edges
                        if (Math.abs(dLeft - 0) < threshold) guides.push({ type: 'v', pos: 0, color: 'bg-amber-500' })
                        if (Math.abs(dRight - paperW) < threshold) guides.push({ type: 'v', pos: paperW, color: 'bg-amber-500' })
                        if (Math.abs(dTop - 0) < threshold) guides.push({ type: 'h', pos: 0, color: 'bg-amber-500' })
                        if (Math.abs(dBottom - paperH) < threshold) guides.push({ type: 'h', pos: paperH, color: 'bg-amber-500' })

                        // Other elements alignment
                        elements.forEach(other => {
                          if (other.id === dragged.id) return
                          const oLeft = other.x
                          const oCenterX = other.x + other.w/2
                          const oRight = other.x + other.w
                          const oTop = other.y
                          const oCenterY = other.y + other.h/2
                          const oBottom = other.y + other.h

                          // Vertical alignments
                          if (Math.abs(dLeft - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-500' })
                          if (Math.abs(dCenterX - oCenterX) < threshold) guides.push({ type: 'v', pos: oCenterX, color: 'bg-sky-500' })
                          if (Math.abs(dRight - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-500' })
                          if (Math.abs(dLeft - oRight) < threshold) guides.push({ type: 'v', pos: oRight, color: 'bg-sky-400' })
                          if (Math.abs(dRight - oLeft) < threshold) guides.push({ type: 'v', pos: oLeft, color: 'bg-sky-400' })

                          // Horizontal alignments
                          if (Math.abs(dTop - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-500' })
                          if (Math.abs(dCenterY - oCenterY) < threshold) guides.push({ type: 'h', pos: oCenterY, color: 'bg-sky-500' })
                          if (Math.abs(dBottom - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-500' })
                          if (Math.abs(dTop - oBottom) < threshold) guides.push({ type: 'h', pos: oBottom, color: 'bg-sky-400' })
                          if (Math.abs(dBottom - oTop) < threshold) guides.push({ type: 'h', pos: oTop, color: 'bg-sky-400' })
                        })

                        // Deduplicate by pos
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
                            {/* Distance labels when snapping */}
                            {Array.from(uniq.values()).slice(0,3).map((g, i) => (
                              <div key={`label-${i}`} className={`absolute rounded px-1 py-0 text-[8px] font-bold text-white ${g.color}`} style={g.type === 'v' ? { left: g.pos + 4, top: 4 } : { left: 4, top: g.pos + 4 }}>
                                {g.type === 'v' ? `${Math.round(g.pos)}px` : `${Math.round(g.pos)}px`}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </>
                  )}
                  {elements.map(el => {
                    const isSelected = selectedId === el.id
                    return (
                    <div
                      key={el.id}
                      onMouseDown={e => handleMouseDown(e, el)}
                      onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                      onDoubleClick={e => { e.stopPropagation(); if (el.type !== 'logo' && el.type !== 'badge' && el.type !== 'rectangle' && el.type !== 'circle' && el.type !== 'border') setEditingId(el.id) }}
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
                        backgroundColor: el.style.backgroundColor,
                        borderWidth: el.style.borderWidth,
                        borderColor: el.style.borderColor,
                        borderStyle: el.style.borderWidth ? 'solid' : undefined,
                        borderRadius: el.style.borderRadius,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        overflow: 'visible',
                      }}
                    >
                      {editingId === el.id ? (
                        <textarea
                          autoFocus
                          value={el.content}
                          onChange={e => setElements(prev => prev.map(x => x.id === el.id ? { ...x, content: e.target.value } : x))}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingId(null) } if (e.key === 'Escape') setEditingId(null) }}
                          onMouseDown={e => e.stopPropagation()}
                          className="h-full w-full resize-none rounded border border-lime-500 bg-white p-1 text-xs outline-none"
                          style={{ fontFamily: el.style.fontFamily, fontSize: Math.min(el.style.fontSize, 14), color: el.style.color, textAlign: el.style.textAlign }}
                        />
                      ) : el.type === 'logo' || el.type === 'badge' ? (
                        el.content ? <img src={el.content} alt="" className="pointer-events-none h-full w-full object-contain" /> : <div className="pointer-events-none flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-[10px] text-zinc-500 dark:border-white/10 dark:bg-zinc-800">Logo</div>
                      ) : el.type === 'line' ? (
                        <div className="pointer-events-none h-full w-full flex items-center">
                          <div className="h-0.5 w-full bg-current opacity-80" style={{ backgroundColor: el.style.color || '#d69e2e' }} />
                        </div>
                      ) : el.type === 'rectangle' ? (
                        <div className="pointer-events-none h-full w-full" style={{ backgroundColor: el.style.backgroundColor || '#f7fafc', borderWidth: el.style.borderWidth, borderColor: el.style.borderColor, borderRadius: el.style.borderRadius }} />
                      ) : el.type === 'circle' ? (
                        <div className="pointer-events-none h-full w-full rounded-full" style={{ backgroundColor: el.style.backgroundColor || '#f7fafc', borderWidth: el.style.borderWidth, borderColor: el.style.borderColor }} />
                      ) : el.type === 'border' ? (
                        <div className="pointer-events-none h-full w-full rounded-lg border-4 border-dashed border-amber-500/50" />
                      ) : (
                        <span className="pointer-events-none w-full truncate">{el.content}</span>
                      )}
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setElements(prev => prev.filter(x => x.id !== el.id)); if (isSelected) setSelectedId(null) }}
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                        className={`absolute right-0 top-0 z-30 grid size-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-600 text-white shadow-xl ring-2 ring-white transition hover:bg-rose-700 hover:scale-110 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title="Delete element"
                      >
                        <X className="size-4" strokeWidth={3} />
                      </button>
                      {isSelected && (
                        <>
                          <div className="pointer-events-none absolute inset-0 rounded border-2 border-lime-500/50" />
                          {(el.type === 'line' || el.type === 'circle' || el.type === 'rectangle') && (
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
                              {el.type === 'line' && (
                                <div
                                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing({ id: el.id, handle: 'l', startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h }) }}
                                  className="absolute left-0 top-1/2 z-30 h-6 w-2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded bg-lime-500 shadow ring-1 ring-white hover:bg-lime-600"
                                  title="Drag to resize from left"
                                />
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )})}
                  {selected && (
                    <div
                      className="absolute z-40 flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 shadow-xl"
                      style={{ left: Math.min(selected.x, 600), top: Math.max(0, selected.y - 36) }}
                    >
                      <span className="max-w-[150px] truncate text-[10px] font-bold text-mist">{selected.type}: {String(selected.content).slice(0,20)}</span>
                      <button type="button" onClick={() => deleteSelected(selected.id)} className="flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700">
                        <Trash2 className="size-3" /> Delete
                      </button>
                      <span className="text-[9px] text-mist">Del</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={save}>{initial ? 'Update Certificate' : 'Save Certificate'}</Button>
        </div>
      </div>
    </Modal>
  )
}
export function EduLeafCrud({ group, leaf: menuLeaf, crumb }: { group: Group; leaf: Leaf; crumb: string[] }) {
  const [feesTab, setFeesTab] = useState<'rules' | 'adjustments' | 'history'>('rules')
  const [personnelTab, setPersonnelTab] = useState<'roster' | 'history'>('roster')
  // Fee Adjustments + Fee History, and the personnel Assignment History, live inside their parent
  // menus: switching the tab swaps the leaf the page edits, so every tab reuses the same CRUD,
  // approval and history machinery.
  const leaf: Leaf = menuLeaf.id === 'transportFees' && feesTab === 'adjustments'
    ? { id: 'transportFeeAdjustments', key: 'nav.eduTransportFeeAdjustments', path: menuLeaf.path, fields: TRANSPORT_FEE_ADJUSTMENT_FIELDS }
    : menuLeaf.id === 'transportFees' && feesTab === 'history'
      ? { id: 'transportFeeHistory', key: 'nav.eduTransportFeeHistory', path: menuLeaf.path, fields: TRANSPORT_FEE_HISTORY_FIELDS }
      : menuLeaf.id === 'transportPersonnel' && personnelTab === 'history'
        ? { id: 'transportPersonnelHistory', key: 'nav.eduTransportPersonnelHistory', path: menuLeaf.path, fields: TRANSPORT_PERSONNEL_HISTORY_FIELDS }
        : menuLeaf
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches, staff, users, sessionUser } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name
  const recordLabel = leaf.id === 'classList' ? 'Class'
    : leaf.id === 'transportRoutes' ? 'Route'
      : leaf.id === 'transportFeeAdjustments' ? 'Adjustment'
        : leaf.id === 'transportFeeHistory' || leaf.id === 'transportPersonnelHistory' ? 'History entry'
          : leaf.id === 'transportFees' ? 'Fee'
            : t(leaf.key)
  const editorLabel = leaf.id === 'subjectList' ? 'Subject' : recordLabel
  const sideBySideAllocationPeriod = group.id === 'studentAccommodation' && leaf.id === 'studentHostelAllocation'
  const sideBySideTransportVehicle = group.id === 'transport' && leaf.id === 'transportVehicles'
  const sideBySideSpans = FORM_FIELD_SPANS[`${group.id}/${leaf.id}`] ?? null
  // The Marksheet Template modal carries a live preview, so its form and the
  // preview sit side by side on wide screens — stacked in a single column the
  // dialog outgrows a laptop viewport and the Save button falls below the fold.
  const marksheetTwoColumn = leaf.id === 'marksheetTemplate'
  const allocationFormFields = sideBySideAllocationPeriod
    ? leaf.fields.filter((field) => !field.hideInForm && !['allocationDate', 'status'].includes(field.key))
      .concat(leaf.fields.filter((field) => !field.hideInForm && ['allocationDate', 'status'].includes(field.key)))
    : leaf.fields.filter((field) => !field.hideInForm)

  // Columns for the record list. Fields flagged `hideInTable` are edited in
  // the form but would only add noise (or very wide cells) to the table.
  const tableFields = leaf.fields.filter((field) => !field.hideInTable)


  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId, branchName))
  /**
   * Mark columns for an exam, read from its Mark Distribution. Shared by the
   * Edit form and the Drag & Drop designer so both previews stay in step.
   */
  const partsForExam = useCallback((name: string) => {
    const chosen = String(name ?? '').trim()
    if (!chosen) return []
    const exam = (records.examSetup ?? []).find(
      (row) => String(row.examName ?? '').trim() === chosen)
    return resolveMarkParts(multiSelectValues(exam?.markDistribution), records.markDistribution ?? [])
  }, [records])


  // Branch-related: switching the active branch loads that branch's records.
  useEffect(() => {
    const loaded = loadEduRecords(activeBranchId, branchName)
    const subjectRows = loaded.subjectList ?? []
    const hasLegacySubjectCodes = subjectRows.some((row) => Object.prototype.hasOwnProperty.call(row, 'code'))
    if (hasLegacySubjectCodes) {
      const migrated = { ...loaded, subjectList: migrateSubjectCodesToShort(subjectRows) }
      setRecords(migrated)
      saveEduRecords(activeBranchId, migrated)
    } else {
      setRecords(loaded)
    }
    setEdit(null)
    setDel(null)
    setQ('')
  }, [activeBranchId])
  const [q, setQ] = useState('')
  const [memberTypeFilter, setMemberTypeFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [booksView, setBooksView] = useState<'grid' | 'table'>('grid')
  const [edit, setEdit] = useState<EduRow | null>(null)

  // The Marksheet Template preview draws its marks columns from the Mark
  // Distribution recorded against whichever exam the template names, so the
  // columns follow that exam rather than a fixed set.
  // The Marksheet Template preview draws its marks columns from the Mark
  // Distribution recorded against whichever exam the template names, so the
  // columns follow that exam rather than a fixed set. Each component carries
  // its own Max Marks, so a component recorded as 50 is marked out of 50
  // rather than an even share of 100. The Drag & Drop designer uses the same
  // lookup, so the two previews can never disagree.
  const examComponents =
    leaf.id === 'marksheetTemplate' && edit ? partsForExam(String(edit.examName ?? '')) : []
  const [del, setDel] = useState<EduRow | null>(null)
  /** The Drag & Drop Sheet designer, offered alongside Add on Marksheet Template. */
  const [designerOpen, setDesignerOpen] = useState(false)
  /** The template the designer is rearranging; null means a brand-new sheet. */
  const [designerRow, setDesignerRow] = useState<EduRow | null>(null)
  /** Certificate builder — free-position like Tutor LMS */
  const [certBuilderOpen, setCertBuilderOpen] = useState(false)
  const [certBuilderRow, setCertBuilderRow] = useState<EduRow | null>(null)
  const [classShortManuallyEdited, setClassShortManuallyEdited] = useState(false)
  const [bulkAllocationOpen, setBulkAllocationOpen] = useState(false)
  const [bulkAllocationClass, setBulkAllocationClass] = useState('')
  const [bulkAllocationStudentIds, setBulkAllocationStudentIds] = useState<string[]>([])
  const [bulkAllocationHostel, setBulkAllocationHostel] = useState('')
  const [bulkAllocationRoom, setBulkAllocationRoom] = useState('')
  const [bulkAllocationDate, setBulkAllocationDate] = useState('')
  const [bulkAllocationAcademicYearId, setBulkAllocationAcademicYearId] = useState('')
  const [bulkAllocationTerms, setBulkAllocationTerms] = useState<string[]>([])
  const [bulkTransportOpen, setBulkTransportOpen] = useState(false)
  const [bulkTransportClass, setBulkTransportClass] = useState('')
  const [bulkTransportStudentIds, setBulkTransportStudentIds] = useState<string[]>([])
  const [bulkTransportRouteName, setBulkTransportRouteName] = useState('')
  const [bulkTransportVehicleNo, setBulkTransportVehicleNo] = useState('')
  const [bulkTransportPickupPoint, setBulkTransportPickupPoint] = useState('')
  const [bulkTransportFee, setBulkTransportFee] = useState('')
  const [personnelAlertsOnly, setPersonnelAlertsOnly] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(todayISO())
  const [attendanceRoute, setAttendanceRoute] = useState('')
  const [attendanceVehicle, setAttendanceVehicle] = useState('')
  const [attendanceTrip, setAttendanceTrip] = useState(TRANSPORT_TRIPS[0])
  const [attendanceBulkOpen, setAttendanceBulkOpen] = useState(false)
  const [attendanceBulkTime, setAttendanceBulkTime] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, string>>({})
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({})

  // Reset view state when the *menu* leaf changes (the effective leaf also changes with the
  // Transport Fees tab, so this must key off menuLeaf — otherwise switching tabs resets it).
  useEffect(() => {
    setPersonnelAlertsOnly(false)
    setFeesTab('rules')
    setPersonnelTab('roster')
    setQ('')
    setEdit(null)
    setDel(null)
    setAttendanceDate(todayISO())
    setAttendanceRoute('')
    setAttendanceVehicle('')
    setAttendanceTrip(TRANSPORT_TRIPS[0])
    setAttendanceBulkOpen(false)
    setAttendanceDraft({})
  }, [menuLeaf.id])

  // Switching tabs closes any open editor and clears the search from the other tab.
  useEffect(() => {
    setEdit(null)
    setDel(null)
    setQ('')
  }, [feesTab, personnelTab])

  useEffect(() => {
    setBulkAllocationOpen(false)
    setBulkAllocationClass('')
    setBulkAllocationStudentIds([])
    setBulkAllocationHostel('')
    setBulkAllocationRoom('')
    setBulkAllocationDate('')
    setBulkAllocationAcademicYearId('')
    setBulkAllocationTerms([])
    setBulkTransportOpen(false)
    setBulkTransportClass('')
    setBulkTransportStudentIds([])
    setBulkTransportRouteName('')
    setBulkTransportVehicleNo('')
    setBulkTransportPickupPoint('')
    setBulkTransportFee('')
    setPersonnelAlertsOnly(false)
  }, [activeBranchId])

  const generatedMembers = group.id === 'library' && leaf.id === 'members'
  const memberStore = generatedMembers ? records[leaf.id] || [] : []
  const { externalRows, membershipOverrides } = splitMemberStore(memberStore)
  const storedRows = records[leaf.id] || []
  const rows = generatedMembers
    ? [...buildLibraryMembers(records, staff, users, activeBranchId), ...externalRows]
    : leaf.id === 'classList'
      ? storedRows.map((row) => ({
          ...row,
          short: String(row.short ?? '').trim() || makeClassShort(String(row.name ?? ''), String(row.section ?? '')),
        }))
      : leaf.id === 'subjectList'
        ? migrateSubjectCodesToShort(storedRows)
        : leaf.id === 'hostelList'
          ? storedRows.map((row) => ({
              ...row,
              warden: JSON.stringify(currentHostelWardenNames(records, row, activeWardenPeriod(records))),
            }))
          : storedRows
  const saveMemberStore = (overrides: EduRow[], external: EduRow[]) => persist([...overrides, ...external])
  const stateFor = (r: EduRow): MembershipState =>
    r.id.startsWith(EXTERNAL_MEMBER_PREFIX)
      ? { member: r.member === 'no' ? 'no' : 'yes', status: r.status === 'Inactive' ? 'Inactive' : 'Active' }
      : memberStateOf(membershipOverrides, r.id)
  const setMemberState = (rowId: string, patch: Partial<MembershipState>) => persist(applyMemberPatch(memberStore, rowId, patch))
  const openEditRow = (row: EduRow) => {
    if (leaf.id === 'classList') {
      const generatedShort = makeClassShort(String(row.name ?? ''), String(row.section ?? ''))
      const savedShort = String(row.short ?? '').trim()
      const isCustom = !!savedShort && savedShort.toLocaleUpperCase() !== generatedShort
      setClassShortManuallyEdited(isCustom)
      setEdit({ ...row, short: isCustom ? savedShort : generatedShort })
    } else {
      setClassShortManuallyEdited(false)
      if (leaf.id === 'studentHostelAllocation') {
        const academicYear = (records.academicYear ?? []).find((item) => String(item.id ?? '') === String(row.academicYearId ?? ''))
        const savedTermIds = new Set(multiSelectValues(row.termIds))
        const currentTermNames = (records.termSemester ?? [])
          .filter((item) => savedTermIds.has(String(item.id ?? '')))
          .map((item) => String(item.name ?? '').trim())
          .filter(Boolean)
        setEdit({
          ...row,
          academicYear: String(academicYear?.name ?? row.academicYear ?? row.session ?? ''),
          academicYearId: String(academicYear?.id ?? row.academicYearId ?? ''),
          terms: JSON.stringify(currentTermNames.length ? currentTermNames : multiSelectValues(row.terms)),
        })
      } else if (leaf.id === 'transportRoutes') {
        const savedStops = parseTransportRouteStops(row.routeStops)
        const legacyPickupPoints = parseTransportPickupPoints(row.pickupPoints)
        const routeStops = savedStops.length ? savedStops : legacyPickupPoints.map((stoppageName) => {
          const stoppage = (records.transportStoppage ?? []).find((item) => String(item.stoppageName ?? '').trim() === stoppageName)
          return {
            stoppageName,
            stopTime: String(stoppage?.pickupTime || row.departureTime || '').trim(),
            distance: '',
            routeFare: String(stoppage?.routeFare || row.fare || '0.00').trim(),
          }
        })
        const endpointNames = routeStops.map((stop) => stop.stoppageName).filter(Boolean)
        setEdit({
          ...row,
          startPlace: String(row.startPlace ?? '').trim() || endpointNames[0] || '',
          stopPlace: String(row.stopPlace ?? '').trim() || endpointNames[endpointNames.length - 1] || '',
          remarks: String(row.remarks ?? ''),
          routeStops: JSON.stringify(routeStops),
        })
      } else {
        setEdit({ ...row })
      }
    }
  }
  const openNewRow = () => {
    setClassShortManuallyEdited(false)
    // A new exam belongs to the term the Academic module currently has Active.
    if (leaf.id === 'examSetup' && leaf.fields.some((f) => f.key === 'term')) {
      setEdit({ id: uid(), term: activeTermNames(records)[0] ?? '' })
      return
    }
    // A marksheet template is stamped with its creation date rather than
    // typed, and carries the branch it was made in; the exam it belongs to is
    // chosen from Exam Setup. Branch never appears in the form — it is a
    // read-only column on the list so a template stays identifiable by branch.
    if (leaf.id === 'marksheetTemplate') {
      setEdit({
        id: uid(),
        createdAt: new Date().toISOString().slice(0, 10),
        branch: branchName ?? '',
      })
      return
    }
    if (leaf.id === 'studentHostelAllocation') {
      const academicYear = (records.academicYear ?? []).find((row) => String(row.status ?? '').toLocaleLowerCase() === 'active')
        || (records.academicYear ?? [])[0]
      const yearName = String(academicYear?.name ?? '').trim()
      const activeTerms = (records.termSemester ?? []).filter((row) =>
        String(row.academicYear ?? '').trim() === yearName
          && String(row.status ?? '').toLocaleLowerCase() === 'active',
      )
      setEdit({
        id: uid(),
        academicYear: yearName,
        academicYearId: String(academicYear?.id ?? ''),
        session: yearName,
        terms: JSON.stringify(activeTerms.map((row) => String(row.name ?? '').trim()).filter(Boolean)),
        termIds: JSON.stringify(activeTerms.map((row) => String(row.id ?? '').trim()).filter(Boolean)),
      })
      return
    }
    if (leaf.id === 'transportRoutes') {
      setEdit({
        id: uid(),
        startPlace: '',
        stopPlace: '',
        remarks: '',
        pickupPoints: '[]',
        routeStops: JSON.stringify([emptyTransportRouteStop()]),
        departureTime: '',
        returnTime: '',
        fare: '0.00',
        status: 'Active',
      })
      return
    }
    if (isTransportPersonnelLeaf(leaf.id)) {
      setEdit({
        id: uid(),
        employmentStatus: 'Active',
        assignedRoute: '',
        assignedVehicle: '',
      })
      return
    }
    if (leaf.id === 'transportFees') {
      const activeYear = (records.academicYear ?? []).find((row) => String(row.status ?? '').toLocaleLowerCase() === 'active')
        || (records.academicYear ?? [])[0]
      setEdit({
        id: uid(),
        academicYear: String(activeYear?.name ?? '').trim(),
        term: '[]',
        routeName: '',
        pickupPoint: '',
        vehicleCategory: '',
        feeStructure: 'Termly',
        status: 'Draft',
        effectiveDate: todayISO(),
      })
      return
    }
    if (leaf.id === 'transportFeeAdjustments') {
      const activeYear = (records.academicYear ?? []).find((row) => String(row.status ?? '').toLocaleLowerCase() === 'active')
        || (records.academicYear ?? [])[0]
      setEdit({
        id: uid(),
        date: todayISO(),
        academicYear: String(activeYear?.name ?? '').trim(),
        adjustmentType: 'Discount %',
        status: 'Pending',
      })
      return
    }
    if (leaf.id === 'transportFeeHistory') {
      setEdit({ id: uid(), date: todayISO(), action: 'Updated', changedBy: String(sessionUser?.name ?? '').trim() })
      return
    }
    if (leaf.id === 'transportPersonnelHistory') {
      setEdit({ id: uid(), date: todayISO(), role: 'Driver', action: 'Reassigned' })
      return
    }
    if (leaf.id === 'transportAttendance') {
      setEdit({
        id: uid(),
        date: attendanceDate || todayISO(),
        trip: attendanceTrip || TRANSPORT_TRIPS[0],
        status: 'Picked Up',
        time: nowTimeValue(),
        routeName: attendanceRoute,
        vehicleNo: attendanceVehicle,
      })
      return
    }
    setEdit({
      id: uid(),
      ...(leaf.id === 'classList' ? { short: '' } : {}),
      ...(leaf.id === 'transportVehicles' || leaf.id === 'transportVehicleAssignments' ? { status: 'Active' } : {}),
    })
  }
  const updateEditField = (key: string, value: string) => {
    if (leaf.id === 'classList' && key === 'short') {
      setClassShortManuallyEdited(!!value.trim())
      setEdit((current) => (current ? { ...current, [key]: value } : current))
      return
    }
    if (leaf.id === 'studentHostelAllocation' && key === 'academicYear') {
      const academicYear = (records.academicYear ?? []).find((row) => String(row.name ?? '').trim() === value.trim())
      setEdit((current) => current ? {
        ...current,
        academicYear: value,
        academicYearId: String(academicYear?.id ?? ''),
        session: value,
        terms: '[]',
        termIds: '[]',
      } : current)
      return
    }
    if (leaf.id === 'studentHostelAllocation' && key === 'student') {
      const student = (records.studentList ?? []).find((row) => String(row.name ?? '').trim() === value.trim())
      setEdit((current) => current ? {
        ...current,
        student: value,
        studentId: String(student?.id ?? ''),
        ...(student ? { className: String(student.className ?? '') } : {}),
      } : current)
      return
    }
    if (leaf.id === 'studentTransportAssignments' && key === 'routeName') {
      const validVehicles = assignedVehicleOptionsForRoute(records, value)
      const validPickupPoints = pickupPointOptionsForRoute(records, value)
      const nextFee = defaultTransportFeeFor(records, value, '') || fareForRoute(records, value)
      setEdit((current) => current ? {
        ...current,
        routeName: value,
        vehicleNo: validVehicles.includes(String(current.vehicleNo ?? '').trim()) ? String(current.vehicleNo ?? '').trim() : '',
        pickupPoint: validPickupPoints.includes(String(current.pickupPoint ?? '').trim()) ? String(current.pickupPoint ?? '').trim() : '',
        fee: nextFee || String(current.fee ?? '').trim(),
      } : current)
      return
    }
    if (leaf.id === 'studentTransportAssignments' && key === 'pickupPoint') {
      const currentRoute = String(edit?.routeName ?? '').trim()
      const matchedFare = defaultTransportFeeFor(records, currentRoute, value)
        || fareForPickupPoint(records, currentRoute, value)
      setEdit((current) => current ? {
        ...current,
        pickupPoint: value,
        ...(matchedFare !== null ? { fee: matchedFare } : {}),
      } : current)
      return
    }
    if (leaf.id === 'transportAttendance' && key === 'student') {
      const assignment = (records.studentTransportAssignments ?? []).find((row) =>
        transportAssignmentIsActive(row) && String(row.student ?? '').trim() === value.trim())
      setEdit((current) => current ? {
        ...current,
        student: value,
        ...(assignment ? {
          studentId: String(assignment.studentId ?? '').trim(),
          className: String(assignment.className ?? '').trim(),
          routeName: String(assignment.routeName ?? '').trim(),
          vehicleNo: String(assignment.vehicleNo ?? '').trim(),
          pickupPoint: String(assignment.pickupPoint ?? '').trim(),
        } : {}),
      } : current)
      return
    }
    if (leaf.id === 'transportAttendance' && key === 'routeName') {
      const validVehicles = value ? assignedVehicleOptionsForRoute(records, value) : []
      const validPickups = value ? pickupPointOptionsForRoute(records, value) : []
      setEdit((current) => current ? {
        ...current,
        routeName: value,
        vehicleNo: validVehicles.includes(String(current.vehicleNo ?? '').trim()) ? String(current.vehicleNo ?? '').trim() : '',
        pickupPoint: validPickups.includes(String(current.pickupPoint ?? '').trim()) ? String(current.pickupPoint ?? '').trim() : '',
      } : current)
      return
    }
    if (leaf.id === 'transportFees' && key === 'routeName') {
      const validPickupPoints = value ? pickupPointOptionsForRoute(records, value) : []
      setEdit((current) => current ? {
        ...current,
        routeName: value,
        pickupPoint: validPickupPoints.includes(String(current.pickupPoint ?? '').trim()) ? String(current.pickupPoint ?? '').trim() : '',
      } : current)
      return
    }
    if (isTransportPersonnelLeaf(leaf.id) && key === 'assignedRoute') {
      const validVehicles = value ? assignedVehicleOptionsForRoute(records, value) : []
      setEdit((current) => current ? {
        ...current,
        assignedRoute: value,
        assignedVehicle: validVehicles.includes(String(current.assignedVehicle ?? '').trim()) ? String(current.assignedVehicle ?? '').trim() : '',
      } : current)
      return
    }
    setEdit((current) => {
      if (!current) return current
      const next = { ...current, [key]: value }
      if (leaf.id === 'classList' && (key === 'name' || key === 'section') && !classShortManuallyEdited) {
        next.short = makeClassShort(String(next.name ?? ''), String(next.section ?? ''))
      }
      return next
    })
  }
  const leafBadgeFor = (r: EduRow, f: FieldDef): ReactNode | undefined => {
    if (leaf.id === 'bookIssueReturn' && f.key === 'status') {
      return isOverdueLoan(r)
        ? (
          <Badge tone="rose">
            Overdue{overdueFine(r, settingsFrom(records).finePerDay) > 0
              ? ` · ${formatGhs(overdueFine(r, settingsFrom(records).finePerDay))}`
              : ''}
          </Badge>
        )
        : (<Badge tone={String(r.status) === 'Returned' ? 'zinc' : 'lime'}>{String(r.status || '—')}</Badge>)
    }
    if (isTransportPersonnelLeaf(leaf.id) && f.key === 'licenseExpiryDate') {
      const v = String(r[f.key] ?? '').trim()
      if (!v) return undefined
      const status = licenseStatus(v)
      if (status === 'expired') return <Badge tone="rose">Expired</Badge>
      if (status === 'expiring') return <Badge tone="amber">Expiring in {Math.max(0, daysUntil(v) ?? 0)}d</Badge>
      return undefined
    }
    if (isTransportPersonnelLeaf(leaf.id) && f.key === 'employmentStatus') {
      const s = String(r.employmentStatus ?? '').trim()
      if (!s) return undefined
      const tone = s.toLocaleLowerCase() === 'active' ? 'lime' : s.toLocaleLowerCase() === 'on leave' ? 'amber' : s.toLocaleLowerCase() === 'suspended' ? 'rose' : 'zinc'
      return <Badge tone={tone as 'lime' | 'amber' | 'rose' | 'zinc'}>{s}</Badge>
    }
    if (leaf.id === 'transportFees' && f.key === 'amount') {
      const terms = transportFeeTerms(records, r)
      const breakdown = transportFeeBreakdown(records, r, { name: '' }, terms[0] ?? '')
      if (breakdown.gross <= 0) return undefined
      return (
        <Badge tone="zinc">
          {transportFeeIsMonthly(r) ? `${monthsInTerm(records, String(r.academicYear ?? ''), terms[0] ?? '')} × ` : ''}
          {formatGhs(breakdown.net)} net
        </Badge>
      )
    }
    if (isTransportAttendance && f.key === 'status') {
      const s = String(r.status ?? '').trim()
      if (!s) return undefined
      return <Badge tone={attendanceStatusTone(s)}>{s}</Badge>
    }
    if ((leaf.id === 'transportFees' || leaf.id === 'transportFeeAdjustments') && f.key === 'status') {
      const s = String(r.status ?? '').trim()
      if (!s) return undefined
      const lower = s.toLocaleLowerCase()
      const tone: 'lime' | 'amber' | 'rose' | 'zinc' = lower === 'approved' ? 'lime'
        : lower === 'pending approval' || lower === 'pending' ? 'amber'
          : lower === 'rejected' ? 'rose'
            : 'zinc'
      return <Badge tone={tone}>{s}</Badge>
    }
    return undefined
  }

  /* ---- Transport Fees: approval workflow, billing posting, change history ---- */
  const feeHistoryActor = String(sessionUser?.name ?? '').trim()
  const feeHistoryEntry = (over: Partial<EduRow>): EduRow => ({
    id: uid(),
    date: todayISO(),
    feeRef: '',
    action: 'Updated',
    fieldChanged: '',
    previousValue: '',
    newValue: '',
    amountBefore: '',
    amountAfter: '',
    changedBy: feeHistoryActor,
    remarks: '',
    ...over,
  } as EduRow)
  const feeHistoryEntries = (prev: EduRow | undefined, next: EduRow, action: string): EduRow[] => {
    const label = transportFeeLabel(next)
    if (!prev) {
      return [feeHistoryEntry({
        feeRef: label,
        action,
        newValue: String(next.amount ?? '').trim(),
        amountAfter: String(next.amount ?? '').trim(),
        remarks: `${String(next.feeStructure ?? '').trim() || 'Fee'} rate card${String(next.academicYear ?? '').trim() ? ` · ${String(next.academicYear ?? '').trim()}` : ''}`,
      })]
    }
    return FEE_TRACKED_FIELDS.flatMap((field) => {
      const before = String(prev[field.key] ?? '').trim()
      const after = String(next[field.key] ?? '').trim()
      if (before === after) return []
      return [feeHistoryEntry({
        feeRef: label,
        action,
        fieldChanged: field.label,
        previousValue: before,
        newValue: after,
        amountBefore: field.key === 'amount' ? before : '',
        amountAfter: field.key === 'amount' ? after : '',
      })]
    })
  }
  const setTransportFeeStatus = (row: EduRow, status: string, action: string) => {
    const next: EduRow = { ...row, status }
    persistLeaves({
      [leaf.id]: rows.map((item) => (item.id === row.id ? next : item)),
      transportFeeHistory: [feeHistoryEntry({
        feeRef: transportFeeLabel(next),
        action,
        fieldChanged: 'Status',
        previousValue: String(row.status ?? '').trim(),
        newValue: status,
        amountAfter: String(row.amount ?? '').trim(),
        remarks: `${String(next.feeStructure ?? '').trim()} · ${formatGhs(Number(row.amount ?? 0) || 0)}`,
      }), ...(records.transportFeeHistory ?? [])],
    })
    toast.success(`Fee ${status.toLocaleLowerCase()}`, transportFeeLabel(next))
  }
  const setTransportAdjustmentStatus = (row: EduRow, status: string) => {
    const next: EduRow = { ...row, status }
    persistLeaves({
      [leaf.id]: rows.map((item) => (item.id === row.id ? next : item)),
      transportFeeHistory: [feeHistoryEntry({
        feeRef: `${String(row.student ?? '').trim()} · ${String(row.adjustmentType ?? '').trim()}`,
        action: status,
        fieldChanged: 'Status',
        previousValue: String(row.status ?? '').trim(),
        newValue: status,
        amountAfter: String(row.value ?? '').trim(),
        remarks: String(row.reason ?? '').trim(),
      }), ...(records.transportFeeHistory ?? [])],
    })
    toast.success(`Adjustment ${status.toLocaleLowerCase()}`, String(row.student ?? ''))
  }
  /* ---- Transport daily attendance: bulk capture, summaries, absent alerts ---- */
  /** Rebuilds the bulk draft from saved records whenever the date / trip / route filter changes. */
  const refreshAttendanceDraft = (next: { route?: string; vehicle?: string; date?: string; trip?: string } = {}) => {
    const date = next.date ?? attendanceDate
    const trip = next.trip ?? attendanceTrip
    const route = next.route ?? attendanceRoute
    const vehicle = next.vehicle ?? attendanceVehicle
    const draft: Record<string, string> = {}
    const remarks: Record<string, string> = {}
    for (const student of expectedTransportStudents(records, { routeName: route, vehicleNo: vehicle })) {
      const record = attendanceRecordFor(
        records,
        { studentId: student.studentId, studentName: student.studentName },
        date,
        trip,
      )
      draft[student.key] = String(record?.status ?? '').trim()
      remarks[student.key] = String(record?.remarks ?? '').trim()
    }
    setAttendanceDraft(draft)
    setAttendanceRemarks(remarks)
  }
  const openAttendanceBulk = () => {
    if (!attendanceExpected.length) {
      toast.error('No students expected', 'Assign students to a Route under Transport → Student Assignments first.')
      return
    }
    setAttendanceDraft({})
    setAttendanceRemarks({})
    refreshAttendanceDraft()
    setAttendanceBulkTime(nowTimeValue())
    setAttendanceBulkOpen(true)
  }
  const saveAttendanceBulk = () => {
    const date = attendanceDate.trim()
    const trip = attendanceTrip.trim()
    if (!date) { toast.error('Select a Date'); return }
    const time = attendanceBulkTime.trim() || nowTimeValue()
    const current = records.transportAttendance ?? []
    const touched = new Set<string>()
    const nextRows: EduRow[] = []
    let added = 0
    let updated = 0
    let cleared = 0
    for (const student of attendanceExpected) {
      const status = String(attendanceDraft[student.key] ?? '').trim()
      const remark = String(attendanceRemarks[student.key] ?? '').trim()
      const key = attendanceRowKey(date, trip, student.studentId, student.studentName)
      touched.add(key)
      const existing = current.find((row) => attendanceRowKeyOf(row) === key)
      if (!status) {
        if (existing) cleared++
        continue
      }
      if (existing) {
        const next: EduRow = {
          ...existing,
          status,
          time: time || String(existing.time ?? '').trim(),
          remarks: remark,
        }
        nextRows.push(next)
        if (String(existing.status ?? '').trim() !== status || String(existing.remarks ?? '').trim() !== remark) updated++
        continue
      }
      nextRows.push({
        id: uid(),
        date,
        student: student.studentName,
        studentId: student.studentId,
        className: student.className,
        routeName: student.routeName,
        vehicleNo: student.vehicleNo,
        pickupPoint: student.pickupPoint,
        trip,
        status,
        time,
        remarks: remark,
      })
      added++
    }
    // Keep attendance captured for other dates / trips / routes untouched.
    const untouched = current.filter((row) => !touched.has(attendanceRowKeyOf(row)))
    persistLeaves({ transportAttendance: [...nextRows, ...untouched] })
    setAttendanceBulkOpen(false)
    toast.success('Attendance saved', `${added} recorded · ${updated} updated${cleared ? ` · ${cleared} cleared` : ''} · ${date} · ${trip}`)
  }
  const postTransportFeeToBilling = (feeRow: EduRow) => {
    if (!transportFeeIsApproved(feeRow)) {
      toast.error('Only approved fees can be posted', 'Submit the fee and get it approved first.')
      return
    }
    const terms = transportFeeTerms(records, feeRow)
    const ranks = transportSiblingRanks(records)
    const assignments = (records.studentTransportAssignments ?? [])
      .filter((row) => transportFeeMatchesAssignment(records, feeRow, row))
    if (!assignments.length) {
      toast.error('No students to bill', 'No active student transport assignment matches this Route / Pickup point / Vehicle Category.')
      return
    }
    const studentsById = new Map((records.studentList ?? []).map((row) => [String(row.id ?? '').trim(), row]))
    const existingRefs = new Set((records.studentBilling ?? []).map((row) => String(row.reference ?? '').trim()))
    const newBills: EduRow[] = []
    let skipped = 0
    let total = 0
    for (const assignment of assignments) {
      const studentId = String(assignment.studentId ?? '').trim()
      const studentName = String(assignment.student ?? '').trim()
      if (!studentName) continue
      const student = studentsById.get(studentId)
      for (const term of terms) {
        const reference = ['TF', feeRow.id, studentId || studentName, term || 'annual'].join(':')
        if (existingRefs.has(reference)) { skipped++; continue }
        const breakdown = transportFeeBreakdown(records, feeRow, { id: studentId, name: studentName }, term, ranks)
        if (breakdown.net <= 0) { skipped++; continue }
        newBills.push({
          id: uid(),
          student: studentName,
          className: String(assignment.className ?? student?.className ?? '').trim(),
          billingDate: todayISO(),
          amount: breakdown.net.toFixed(2),
          status: 'Unpaid',
          feeType: 'Transport',
          academicYear: String(feeRow.academicYear ?? '').trim(),
          term,
          reference,
          remarks: `${transportFeeLabel(feeRow)}${breakdown.siblingPercent ? ` · sibling #${breakdown.siblingRank} −${breakdown.siblingPercent}%` : ''}`,
        })
        total += breakdown.net
      }
    }
    if (!newBills.length) {
      toast.error('Nothing to post', skipped
        ? 'Every matching student is already billed for this fee. Delete the existing bills to re-post.'
        : 'No charge could be calculated for the matching students.')
      return
    }
    persistLeaves({
      studentBilling: [...newBills, ...(records.studentBilling ?? [])],
      transportFeeHistory: [feeHistoryEntry({
        feeRef: transportFeeLabel(feeRow),
        action: 'Posted to Billing',
        newValue: `${newBills.length} student bill(s)`,
        amountAfter: total.toFixed(2),
        remarks: `${String(feeRow.academicYear ?? '').trim()} · ${terms.filter(Boolean).join(', ') || 'Annual'}${skipped ? ` · ${skipped} skipped (already billed)` : ''}`,
      }), ...(records.transportFeeHistory ?? [])],
    })
    toast.success('Posted to Student Billing', `${newBills.length} transport charge(s) · ${formatGhs(total)}`)
  }

  /** Contextual help shown under a form field (route-scoped dropdowns, fee rules, licences…). */
  const fieldHintFor = (f: FieldDef): string | undefined => {
    if (leaf.id === 'studentTransportAssignments' && f.key === 'vehicleNo') {
      if (!String(edit?.routeName ?? '').trim()) return 'Choose a Route first to see its assigned vehicles.'
      if (!optionsFor(f).length) return 'No active vehicle is assigned to this Route. Add one under Transport → Assign Vehicle.'
      if (String(edit?.vehicleNo ?? '').trim() && !optionsFor(f).includes(String(edit?.vehicleNo ?? '').trim())) {
        return 'The saved vehicle is not assigned to this Route; choose an assigned vehicle or clear it.'
      }
      return undefined
    }
    if (leaf.id === 'studentTransportAssignments' && f.key === 'pickupPoint') {
      if (!String(edit?.routeName ?? '').trim()) return 'Choose a Route first to see its pickup points.'
      if (!optionsFor(f).length) return 'No pickup points configured for this Route. Add stoppages to the Route under Transport → Routes.'
      if (String(edit?.pickupPoint ?? '').trim() && !optionsFor(f).includes(String(edit?.pickupPoint ?? '').trim())) {
        return 'The saved pickup point is not on this Route; choose a pickup point from this Route or clear it.'
      }
      return undefined
    }
    if (leaf.id === 'studentTransportAssignments' && f.key === 'fee') {
      const routeFee = defaultTransportFeeFor(records, String(edit?.routeName ?? ''), String(edit?.pickupPoint ?? ''))
      if (routeFee) return 'Auto-filled from the approved Transport Fees rule for this Route / Pickup point; you may adjust it.'
      if (String(edit?.routeName ?? '').trim() && fareForRoute(records, String(edit?.routeName ?? ''))) {
        return 'Auto-filled from Route / Pickup point; you may adjust it.'
      }
      return undefined
    }
    if (isTransportPersonnel && f.key === 'assignedVehicle') {
      if (!String(edit?.assignedRoute ?? '').trim()) return 'Choose an Assigned Route first to see the vehicles serving it.'
      if (!optionsFor(f).length) return 'No active vehicle is assigned to this Route. Add one under Transport → Assign Vehicle.'
      return 'Only vehicles assigned to the selected Route are listed.'
    }
    if (isTransportPersonnel && f.key === 'assignedRoute') {
      return 'Only active Routes are listed. Changing the Route clears a vehicle that no longer matches.'
    }
    if (isTransportPersonnel && f.key === 'licenseExpiryDate') {
      return 'Alerts are raised once a licence has expired or is within 30 days of expiry.'
    }
    if (isTransportPersonnel && f.key === 'licenseNumber') return 'Required for Drivers; optional for Attendants.'
    if (isTransportFees) {
      const structure = String(edit?.feeStructure ?? '').trim().toLocaleLowerCase()
      switch (f.key) {
        case 'academicYear': return 'Rate cards apply to one Academic Year; add another card to change fees next year.'
        case 'term': return 'Leave blank to bill every term of the Academic Year. Annual fees always bill once.'
        case 'routeName': return 'Leave blank to make this the default fee for every Route.'
        case 'pickupPoint': return !String(edit?.routeName ?? '').trim()
          ? 'Select a Route first, then choose one of its pickup points.'
          : 'Only pickup points on the selected Route. Leave blank to charge the whole route the same amount.'
        case 'vehicleCategory': return 'Leave blank to charge the same amount for every vehicle category.'
        case 'feeStructure': return 'Monthly multiplies the amount by the number of months in the term; Termly bills once per term; Annual bills once per year.'
        case 'amount': return structure === 'monthly'
          ? 'Amount charged per month — multiplied by the months in each selected term.'
          : structure === 'annual' ? 'Total charged once for the whole Academic Year.' : 'Amount charged once per term.'
        case 'discountPercent': return 'Applied to every student on this card before concessions and adjustments.'
        case 'siblingSecondPercent': return 'Discount for the 2nd transport-using child of the same guardian.'
        case 'siblingThirdPercent': return 'Discount for the 3rd and any later child of the same guardian.'
        case 'status': return 'Draft → Pending Approval → Approved. Only approved fees can be posted to Student Billing.'
        default: return undefined
      }
    }
    if (isTransportFeeAdjustments) {
      if (f.key === 'value') return 'Use a percentage for Discount % / Sibling Concession, or an amount in GHS for Fixed Discount / Surcharge.'
      if (f.key === 'status') return 'Only Approved adjustments are applied when a transport fee is posted.'
      if (f.key === 'term') return 'Leave blank to apply the adjustment in every term of the Academic Year.'
    }
    if (leaf.id === 'studentHostelAllocation' && f.key === 'terms' && String(edit?.academicYear ?? '').trim()
      && !(records.termSemester ?? []).some((row) => String(row.academicYear ?? '').trim() === String(edit?.academicYear ?? '').trim())) {
      return 'No Terms / Semesters are configured for this Academic Year / Session.'
    }
    if (leaf.id === 'classList' && f.key === 'short') return 'Auto-filled from the class name and group; edit it to customize.'
    if (leaf.id === 'subjectList' && f.key === 'short') return 'Optional label used when Subject name display is set to Short; otherwise initials are used.'
    if (leaf.id === 'subjectList' && f.key === 'classroom') return 'Choose from the classrooms, labs, and halls configured under Room Allocation.'
    return undefined
  }

  const leafRowActions = (r: EduRow) => (
    <div className="flex justify-end gap-1.5">
      {/* Card Management is a shared module now — this is the students' way in. */}
      {(leaf.id === 'studentList' || leaf.id === 'studentRegistration') && (
        <IssueCardIconButton holder="Student" recordId={String(r.id ?? '')} title="Issue an ID card" />
      )}
      {leaf.id === 'bookIssueReturn' && isActiveLoan(r) && (
        <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Mark returned" onClick={() => returnLoan(r.id)}>
          <RotateCcw className="size-3.5" />
        </button>
      )}
      {leaf.id === 'requestBooks' && String(r.status) === 'Pending' && (
        <>
          <button
            className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime disabled:cursor-not-allowed disabled:opacity-40"
            title={canIssueBook(records, String(r.book ?? '')) ? 'Approve & issue book' : 'No copies available'}
            disabled={!canIssueBook(records, String(r.book ?? ''))}
            onClick={() => approveRequest(r)}
          >
            <Check className="size-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Reject request" onClick={() => rejectRequest(r)}>
            <X className="size-3.5" />
          </button>
        </>
      )}
      {isTransportFees && String(r.status ?? '').trim() === 'Draft' && (
        <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Submit for approval" onClick={() => setTransportFeeStatus(r, 'Pending Approval', 'Submitted')}>
          <Send className="size-3.5" />
        </button>
      )}
      {isTransportFees && String(r.status ?? '').trim() === 'Pending Approval' && (
        <>
          <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Approve fee" onClick={() => setTransportFeeStatus(r, 'Approved', 'Approved')}>
            <Check className="size-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Reject fee" onClick={() => setTransportFeeStatus(r, 'Rejected', 'Rejected')}>
            <X className="size-3.5" />
          </button>
        </>
      )}
      {isTransportFees && String(r.status ?? '').trim() === 'Approved' && (
        <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Post charges to Student Billing" onClick={() => postTransportFeeToBilling(r)}>
          <Banknote className="size-3.5" />
        </button>
      )}
      {isTransportFeeAdjustments && String(r.status ?? '').trim() === 'Pending' && (
        <>
          <button className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime" title="Approve adjustment" onClick={() => setTransportAdjustmentStatus(r, 'Approved')}>
            <Check className="size-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Reject adjustment" onClick={() => setTransportAdjustmentStatus(r, 'Rejected')}>
            <X className="size-3.5" />
          </button>
        </>
      )}
      {leaf.id === 'marksheetTemplate' && (
        <button
          className="rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime"
          title={(r as any).certificateData ? 'Edit certificate (free-position)' : 'Design sheet (drag & drop)'}
          onClick={() => { if ((r as any).certificateData) { setCertBuilderRow(r); setCertBuilderOpen(true) } else { setDesignerRow(r); setDesignerOpen(true) } }}
        >
          <LayoutGrid className="size-3.5" />
        </button>
      )}
      <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => openEditRow(r)}><Pencil className="size-3.5" /></button>
      <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Delete" onClick={() => setDel(r)}><Trash2 className="size-3.5" /></button>
    </div>
  )

  const allMembers = rows.length > 0 && rows.every((r) => stateFor(r).member === 'yes')
  const finesMap = generatedMembers ? finesByMember(records) : {}
  const setAllMembers = (member: 'yes' | 'no') => persist(applyAllMemberPatch(memberStore, rows.map((r) => r.id), member))

  const classOptions = useMemo(() => {
    if (!generatedMembers) return [] as string[]
    return [...new Set((records.studentList ?? []).map((r) => String(r.className ?? '').trim()).filter(Boolean))].sort()
  }, [generatedMembers, records.studentList])

  const isStudentHostelAllocation = leaf.id === 'studentHostelAllocation'
  const isStudentTransportAssignments = group.id === 'transport' && leaf.id === 'studentTransportAssignments'
  const isTransportPersonnel = isTransportPersonnelLeaf(leaf.id)
  const isTransportFees = leaf.id === 'transportFees'
  const isTransportFeeAdjustments = leaf.id === 'transportFeeAdjustments'
  const isTransportAttendance = leaf.id === 'transportAttendance'
  const isTransportDataTable = group.id === 'transport'
    && ['studentTransportAssignments', 'transportRoutes', 'transportVehicles', 'transportStoppage', 'transportVehicleAssignments', 'transportPersonnel', 'transportPersonnelHistory', 'transportFees', 'transportFeeAdjustments', 'transportFeeHistory', 'transportAttendance'].includes(leaf.id)
  // Examination lists render through the plain table branch below, which has
  // no serial column of its own — number those rows explicitly.
  const serialisePlainRows = group.id === 'examinations'
  const personnelAlerts = isTransportPersonnel ? personnelLicenseAlerts(rows) : null
  const attendanceRouteOptions = useMemo(() => [...new Set((records.studentTransportAssignments ?? [])
    .filter(transportAssignmentIsActive)
    .map((row) => String(row.routeName ?? '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), [records.studentTransportAssignments])
  const attendanceVehicleOptions = useMemo(() => (attendanceRoute ? assignedVehicleOptionsForRoute(records, attendanceRoute) : []),
    [records.transportRoutes, records.transportVehicles, records.transportVehicleAssignments, attendanceRoute])
  const attendanceExpected = useMemo(
    () => (isTransportAttendance ? expectedTransportStudents(records, { routeName: attendanceRoute, vehicleNo: attendanceVehicle }) : []),
    [isTransportAttendance, records.studentTransportAssignments, attendanceRoute, attendanceVehicle],
  )
  const attendanceSummary = useMemo(
    () => (isTransportAttendance ? transportAttendanceSummary(records, attendanceDate, attendanceTrip, attendanceRoute, attendanceVehicle) : null),
    [isTransportAttendance, records.transportAttendance, records.studentTransportAssignments, attendanceDate, attendanceTrip, attendanceRoute, attendanceVehicle],
  )
  const savedRouteStops = leaf.id === 'transportRoutes' ? parseTransportRouteStops(edit?.routeStops) : []
  const editableRouteStops = savedRouteStops.length ? savedRouteStops : [emptyTransportRouteStop()]
  // Suggestions only — a Route's pickup points are typed inline so they stay independent of
  // Transport → Stoppage records and the same point can be used on any number of routes (or twice).
  const routeStoppageSuggestions = [...new Set([
    ...(records.transportStoppage ?? [])
      .filter((row) => String(row.status ?? 'Active').trim().toLocaleLowerCase() !== 'inactive')
      .map((row) => String(row.stoppageName ?? '').trim()),
    ...(records.transportRoutes ?? []).flatMap((row) => [
      ...parseTransportRouteStops(row.routeStops).map((stop) => stop.stoppageName),
      ...parseTransportPickupPoints(row.pickupPoints),
    ]),
    ...editableRouteStops.map((stop) => stop.stoppageName),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const updateRouteStop = (index: number, patch: Partial<TransportRouteStop>) => {
    const next = editableRouteStops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop)
    updateEditField('routeStops', JSON.stringify(next))
  }
  const addRouteStop = () => updateEditField('routeStops', JSON.stringify([...editableRouteStops, emptyTransportRouteStop()]))
  const removeRouteStop = (index: number) => updateEditField(
    'routeStops',
    JSON.stringify(editableRouteStops.filter((_, stopIndex) => stopIndex !== index)),
  )
  const hostelAllocationStudents = useMemo(() => (records.studentList ?? [])
    .map((row) => ({
      id: String(row.id ?? '').trim(),
      name: String(row.name ?? '').trim(),
      className: String(row.className ?? '').trim(),
      admissionNo: String(row.admissionNo ?? '').trim(),
    }))
    .filter((row) => row.id && row.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      || a.className.localeCompare(b.className, undefined, { sensitivity: 'base' })), [records.studentList])
  const hostelAllocationClasses = useMemo(() => [...new Set(hostelAllocationStudents.map((student) => student.className).filter(Boolean))].sort(), [hostelAllocationStudents])
  const bulkVisibleStudents = useMemo(
    () => hostelAllocationStudents.filter((student) => !bulkAllocationClass || student.className === bulkAllocationClass),
    [hostelAllocationStudents, bulkAllocationClass],
  )
  const bulkTransportVisibleStudents = useMemo(
    () => hostelAllocationStudents.filter((student) => !bulkTransportClass || student.className === bulkTransportClass),
    [hostelAllocationStudents, bulkTransportClass],
  )
  const bulkTransportRouteOptions = useMemo(() => [...new Set((records.transportRoutes ?? [])
    .filter((row) => !String(row.status ?? '').trim() || String(row.status).trim().toLocaleLowerCase() === 'active')
    .map((row) => String(row.routeName ?? '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), [records.transportRoutes])
  const bulkTransportVehicleOptions = useMemo(
    () => assignedVehicleOptionsForRoute(records, bulkTransportRouteName),
    [records.transportRoutes, records.transportVehicles, records.transportVehicleAssignments, bulkTransportRouteName],
  )
  const bulkTransportPickupPointOptions = useMemo(
    () => pickupPointOptionsForRoute(records, bulkTransportRouteName),
    [records.transportRoutes, records.transportStoppage, bulkTransportRouteName],
  )
  const bulkHostelOptions = useMemo(() => [...new Set((records.hostelList ?? [])
    .map((row) => String(row.hostelName ?? '').trim())
    .filter(Boolean))].sort(), [records.hostelList])
  const bulkRoomOptions = useMemo(() => [...new Set((records.hostelRooms ?? [])
    .filter((row) => String(row.hostelName ?? '').trim() === bulkAllocationHostel)
    .map((row) => String(row.roomNumber ?? '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), [records.hostelRooms, bulkAllocationHostel])
  const bulkAcademicYears = records.academicYear ?? []
  const bulkSelectedAcademicYear = bulkAcademicYears.find((row) => String(row.id ?? '') === bulkAllocationAcademicYearId)
  const bulkAvailableTermRows = useMemo(() => (records.termSemester ?? []).filter((row) =>
    String(row.academicYear ?? '').trim() === String(bulkSelectedAcademicYear?.name ?? '').trim(),
  ), [records.termSemester, bulkSelectedAcademicYear?.name])
  const bulkTermOptions = useMemo(() => [...new Set(bulkAvailableTermRows
    .map((row) => String(row.name ?? '').trim())
    .filter(Boolean))].sort(), [bulkAvailableTermRows])

  const filtered = useMemo(() => {
    let base = filterMemberRows(rows, leaf, q, memberTypeFilter, classFilter)
    if (isTransportAttendance) {
      base = base.filter((row) => {
        if (attendanceDate && String(row.date ?? '').trim() !== attendanceDate) return false
        if (attendanceTrip && String(row.trip ?? '').trim() !== attendanceTrip) return false
        if (attendanceRoute && String(row.routeName ?? '').trim() !== attendanceRoute) return false
        if (attendanceVehicle && String(row.vehicleNo ?? '').trim() !== attendanceVehicle) return false
        return true
      })
    }
    if (!personnelAlertsOnly || !isTransportPersonnel) return base
    return base.filter((row) => {
      const status = licenseStatus(row.licenseExpiryDate)
      return status === 'expired' || status === 'expiring'
    })
  }, [q, rows, leaf, memberTypeFilter, classFilter, personnelAlertsOnly, isTransportPersonnel,
    isTransportAttendance, attendanceDate, attendanceTrip, attendanceRoute, attendanceVehicle])

  /**
   * Display order for the plain table. Leaves that carry a Sort order field
   * list by that number (1, 2, 3…); rows left blank keep their relative order
   * at the bottom rather than being treated as zero.
   */
  const orderedRows = useMemo(() => {
    if (!leaf.fields.some((f) => f.key === 'sortOrder')) return filtered
    const rank = (row: EduRow) => {
      const raw = String(row.sortOrder ?? '').trim()
      const asNumber = raw === '' ? Number.NaN : Number(raw)
      return Number.isFinite(asNumber) ? asNumber : Number.POSITIVE_INFINITY
    }
    return filtered
      .map((row, index) => ({ row, index, rank: rank(row) }))
      .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
      .map((entry) => entry.row)
  }, [filtered, leaf.fields])

  // Select options: static list, or pulled live from another submenu's records
  // (e.g. Level → Programme picks from the Programmes you created).
  const optionsFor = (f: FieldDef): string[] => {
    const currentValues = f.type === 'multiselect'
      ? multiSelectValues(edit?.[f.key])
      : [String(edit?.[f.key] ?? '').trim()].filter(Boolean)
    if (f.options && f.options.length) {
      const merged = [...new Set([...f.options, ...currentValues])]
      // A deliberate order (e.g. "Marks" before "Grade (GPA)") is kept as authored.
      if (f.keepOrder) return merged
      // Numeric option lists (e.g. a 1–10 sort order) must sort as numbers,
      // otherwise they read 1, 10, 2, 3…
      return merged.every((value) => /^\d+$/.test(value))
        ? merged.sort((a, b) => Number(a) - Number(b))
        : merged.sort()
    }
    if (f.source === 'termSemester') {
      const academicYear = String(edit?.academicYear ?? '').trim()
      const termNames = academicYear
        ? (records.termSemester ?? [])
          .filter((row) => String(row.academicYear ?? '').trim() === academicYear)
          .map((row) => String(row.name ?? '').trim())
          .filter(Boolean)
        : []
      return [...new Set([...termNames, ...currentValues])].sort()
    }
    if (f.source === 'members') return [...new Set([...memberNameOptions(records, staff, users, activeBranchId), ...currentValues])].sort()
    if (f.source === 'hrTeachingStaff') {
      const names = staff
        .filter((employee) => (!employee.branchId || employee.branchId === activeBranchId)
          && (employee.staffType === 'teacher' || employee.staffCategory?.trim().toLocaleLowerCase() === 'teaching'))
        .map((employee) => users.find((user) => user.id === employee.userId)?.name?.trim() || '')
        .filter(Boolean)
      return [...new Set([...names, ...currentValues])].sort()
    }
    if (f.source === 'academicSections') {
      const sectionNames = (records.academicSections ?? [])
        .map((row) => String(row.name ?? '').trim())
        .filter(Boolean)
        .map((name) => name.replace(/^section\s+/i, '').trim())
      return [...new Set([...sectionNames, ...currentValues])].sort()
    }
    if (f.source === 'classrooms') {
      const classroomNames = [
        ...(records.rooms ?? []).map((row) => row.name),
        ...(records.roomAllocation ?? []).map((row) => row.room),
        ...(records.classList ?? []).map((row) => row.room),
        ...currentValues,
      ].map((name) => String(name ?? '').trim()).filter(Boolean)
      return [...new Set(classroomNames)].sort()
    }
    if (leaf.id === 'studentTransportAssignments' && f.key === 'vehicleNo') {
      return assignedVehicleOptionsForRoute(records, String(edit?.routeName ?? ''))
    }
    if (leaf.id === 'studentTransportAssignments' && f.key === 'pickupPoint') {
      return pickupPointOptionsForRoute(records, String(edit?.routeName ?? ''))
    }
    if (isTransportPersonnel && f.key === 'assignedVehicle') {
      return assignedVehicleOptionsForRoute(records, String(edit?.assignedRoute ?? ''))
    }
    if (leaf.id === 'transportAttendance' && f.key === 'vehicleNo') {
      return assignedVehicleOptionsForRoute(records, String(edit?.routeName ?? ''))
    }
    if (leaf.id === 'transportAttendance' && f.key === 'pickupPoint') {
      return pickupPointOptionsForRoute(records, String(edit?.routeName ?? ''))
    }
    if (leaf.id === 'transportFees' && f.key === 'pickupPoint') {
      const route = String(edit?.routeName ?? '').trim()
      if (route) return pickupPointOptionsForRoute(records, route)
      return [...new Set((records.transportRoutes ?? [])
        .flatMap((row) => pickupPointOptionsForRoute(records, String(row.routeName ?? '').trim()))
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    }
    // Term pickers read the Academic module's Term/Semester register for the
    // active year, so the choice tracks whatever that module says is current.
    if (f.source === 'academicTerms') {
      const years = records.academicYear ?? []
      const activeYear = years.find((row) => String(row.status ?? '').trim().toLocaleLowerCase() === 'active') || years[0]
      const yearName = String(activeYear?.name ?? '').trim()
      const names = (records.termSemester ?? [])
        .filter((row) => !yearName || String(row.academicYear ?? '').trim() === yearName)
        .map((row) => String(row.name ?? '').trim())
        .filter(Boolean)
      return [...new Set([...names, ...currentValues])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    }
    // Branch pickers come from the organisation's branch list rather than the
    // education record store.
    if (f.source === 'branches') {
      const branchNames = branches.map((branch) => String(branch.name ?? '').trim()).filter(Boolean)
      return [...new Set([...branchNames, ...currentValues])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    }
    if (f.source) {
      const sourceRows = records[f.source] ?? []
      const routeVehicleAssignmentSource = (leaf.id === 'transportVehicleAssignments'
        || (isTransportPersonnel && (f.key === 'assignedRoute' || f.key === 'assignedVehicle')))
        && (f.source === 'transportRoutes' || f.source === 'transportVehicles')
      const eligibleSourceRows = routeVehicleAssignmentSource
        ? sourceRows.filter(transportCatalogRowIsActive)
        : sourceRows
      const filter = f.filterContains?.trim().toLocaleLowerCase()
      const containsRows = f.filterKey && filter
        ? eligibleSourceRows.filter((row) => String(row[f.filterKey!] ?? '').toLocaleLowerCase().includes(filter))
        : eligibleSourceRows
      // Exam Name and friends: keep the choice inside the term the school is
      // currently running, but never drop the value a row already holds.
      const eligibleRows = f.filterActiveTerm
        ? containsRows.filter((row) => {
            const term = String(row.term ?? '').trim()
            return !term || activeTermNames(records).includes(term)
          })
        : containsRows
      const values = eligibleRows.map((row) => {
        if (f.displayKeys?.length) {
          return f.displayKeys.map((key) => String(row[key] ?? '').trim()).filter(Boolean).join(' ')
        }
        return String(row[f.valueKey ?? 'name'] ?? '').trim()
      }).filter(Boolean)
      return [...new Set([...values, ...currentValues])].sort()
    }
    return []
  }

  /**
   * Options for a checkbox-group multiselect, in the source list's own sort
   * order rather than alphabetical — so the boxes read in the same order the
   * Mark Distribution list does. Falls back to `optionsFor` ordering when the
   * source has no sortOrder (or the field isn't sourced).
   */
  const checkboxOptionsFor = (f: FieldDef): string[] => {
    const base = optionsFor(f)
    const rows = f.source ? (records[f.source] ?? []) : []
    const rank = new Map<string, number>()
    for (const row of rows) {
      const name = String(row.name ?? '').trim()
      const order = Number(String(row.sortOrder ?? '').trim())
      if (name && Number.isFinite(order)) rank.set(name, order)
    }
    if (!rank.size) return base
    return [...base].sort((a, b) =>
      (rank.get(a) ?? Number.POSITIVE_INFINITY) - (rank.get(b) ?? Number.POSITIVE_INFINITY))
  }

  // Image fields (e.g. book cover): read the dropped/picked file as a data URL.
  const readImage = (file: File, key: string) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }
    if (file.size > 2_000_000) {
      toast.error('Image too large (max 2 MB)')
      return
    }
    const rd = new FileReader()
    rd.onload = () => setEdit((cur) => (cur ? { ...cur, [key]: String(rd.result) } : cur))
    rd.readAsDataURL(file)
  }

  /**
   * Exams for the term the school is currently running, offered by the Drag &
   * Drop designer. Memoised so its identity is stable — the designer reloads
   * its state whenever this list changes.
   */
  const designerExamNames = useMemo(
    () => (records.examSetup ?? [])
      .filter((row) => {
        const term = String(row.term ?? '').trim()
        return !term || activeTermNames(records).includes(term)
      })
      .map((row) => String(row.examName ?? '').trim())
      .filter(Boolean),
    [records],
  )

  const persist = (next: EduRow[]) => {
    if (!leaf) return
    const all = { ...records, [leaf.id]: next }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  const persistLeaves = (patch: Record<string, EduRow[]>) => {
    const all = { ...records, ...patch }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  // Publish / Publish Result can be flipped straight from the list, so an exam
  // can go live without opening the edit form.
  const toggleExamPublish = (rowId: string, key: string, on: boolean) => {
    if (leaf.id !== 'examSetup') return
    const rows = records.examSetup ?? []
    const target = rows.find((row) => row.id === rowId)
    if (!target) return
    persist(rows.map((row) => (row.id === rowId ? { ...row, [key]: on ? 'Yes' : 'No' } : row)))
    const name = String(target.examName ?? '').trim()
    toast.success(`${name || 'Exam'} — ${key === 'publishResult' ? 'result ' : ''}${on ? 'published' : 'unpublished'}`)
  }

  const openBulkHostelAllocation = () => {
    setBulkAllocationClass('')
    setBulkAllocationStudentIds([])
    setBulkAllocationHostel('')
    setBulkAllocationRoom('')
    setBulkAllocationDate(todayISO())
    const academicYear = bulkAcademicYears.find((row) => String(row.status ?? '').toLocaleLowerCase() === 'active')
      || bulkAcademicYears[0]
    const yearName = String(academicYear?.name ?? '').trim()
    const activeTerms = (records.termSemester ?? []).filter((row) =>
      String(row.academicYear ?? '').trim() === yearName
        && String(row.status ?? '').toLocaleLowerCase() === 'active',
    )
    setBulkAllocationAcademicYearId(String(academicYear?.id ?? ''))
    setBulkAllocationTerms(activeTerms.map((row) => String(row.name ?? '').trim()).filter(Boolean))
    setBulkAllocationOpen(true)
  }

  const selectVisibleBulkStudents = () => {
    setBulkAllocationStudentIds((current) => [...new Set([...current, ...bulkVisibleStudents.map((student) => student.id)])])
  }

  const commitBulkHostelAllocation = () => {
    const selectedStudents = bulkAllocationStudentIds.flatMap((id) => {
      const student = hostelAllocationStudents.find((row) => row.id === id)
      return student ? [student] : []
    })
    if (!selectedStudents.length) { toast.error('Select at least one student'); return }
    const academicYear = bulkAcademicYears.find((row) => String(row.id ?? '') === bulkAllocationAcademicYearId)
    const academicYearName = String(academicYear?.name ?? '').trim()
    if (!academicYear || !academicYearName) { toast.error('Select an Academic Year / Session'); return }
    const selectedTerms = [...new Set(bulkAllocationTerms.filter((term) => bulkTermOptions.includes(term)))].sort()
    if (!selectedTerms.length) { toast.error('Select at least one Term / Semester'); return }
    if (!bulkAllocationHostel || !bulkHostelOptions.includes(bulkAllocationHostel)) { toast.error('Select a valid Hostel'); return }
    if (!bulkAllocationDate) { toast.error('Allocation date is required'); return }
    const hostel = (records.hostelList ?? []).find((row) => String(row.hostelName ?? '').trim() === bulkAllocationHostel)
    const room = bulkAllocationRoom
      ? (records.hostelRooms ?? []).find((row) => String(row.hostelName ?? '').trim() === bulkAllocationHostel && String(row.roomNumber ?? '').trim() === bulkAllocationRoom)
      : undefined
    if (bulkAllocationRoom && !room) { toast.error('Select a room that belongs to the chosen Hostel'); return }

    const selectedTermIds = [...new Set(bulkAvailableTermRows
      .filter((row) => selectedTerms.includes(String(row.name ?? '').trim()))
      .map((row) => String(row.id ?? '').trim())
      .filter(Boolean))]
    const currentAllocations = records.studentHostelAllocation ?? []
    const currentForPeriod = currentAllocations.filter((row) =>
      hostelAllocationIsActive(row)
        && hostelAllocationMatchesPeriod(row, String(academicYear.id), academicYearName, selectedTerms, selectedTermIds),
    )
    const activeForStudent = (student: typeof selectedStudents[number]) => currentAllocations.find((row) =>
      hostelAllocationIsActive(row)
        && hostelAllocationMatchesYear(row, String(academicYear.id), academicYearName)
        && hostelAllocationMatchesStudent(row, student.id, student.name),
    )
    const allocationOverlapsSelection = (row: EduRow | undefined) => Boolean(row
      && hostelAllocationMatchesPeriod(row, String(academicYear.id), academicYearName, selectedTerms, selectedTermIds))

    const hostelCapacity = Number(hostel?.capacity ?? 0)
    if (hostelCapacity > 0) {
      const alreadyInHostel = currentForPeriod.filter((row) => String(row.hostelName ?? '').trim() === bulkAllocationHostel).length
      const incoming = selectedStudents.filter((student) => {
        const current = activeForStudent(student)
        return !allocationOverlapsSelection(current) || String(current?.hostelName ?? '').trim() !== bulkAllocationHostel
      }).length
      if (alreadyInHostel + incoming > hostelCapacity) {
        toast.error('Hostel capacity would be exceeded', `${hostelCapacity} places available; this allocation would reach ${alreadyInHostel + incoming}.`)
        return
      }
    }
    const roomCapacity = Number(room?.capacity ?? 0)
    if (bulkAllocationRoom && roomCapacity > 0) {
      const alreadyInRoom = currentForPeriod.filter((row) =>
        String(row.hostelName ?? '').trim() === bulkAllocationHostel
          && String(row.roomNumber ?? '').trim() === bulkAllocationRoom,
      ).length
      const incoming = selectedStudents.filter((student) => {
        const current = activeForStudent(student)
        return !allocationOverlapsSelection(current)
          || String(current?.hostelName ?? '').trim() !== bulkAllocationHostel
          || String(current?.roomNumber ?? '').trim() !== bulkAllocationRoom
      }).length
      if (alreadyInRoom + incoming > roomCapacity) {
        toast.error('Room capacity would be exceeded', `${roomCapacity} places available; this allocation would reach ${alreadyInRoom + incoming}.`)
        return
      }
    }

    const nextAllocations = [...currentAllocations]
    let added = 0
    let updated = 0
    for (const student of selectedStudents) {
      const existingIndex = nextAllocations.findIndex((row) =>
        hostelAllocationIsActive(row)
          && hostelAllocationMatchesYear(row, String(academicYear.id), academicYearName)
          && hostelAllocationMatchesStudent(row, student.id, student.name),
      )
      const allocationFields = {
        student: student.name,
        studentId: student.id,
        className: student.className,
        hostelName: bulkAllocationHostel,
        roomNumber: bulkAllocationRoom,
        allocationDate: bulkAllocationDate,
        academicYear: academicYearName,
        academicYearId: String(academicYear.id),
        session: academicYearName,
        terms: JSON.stringify(selectedTerms),
        termIds: JSON.stringify(selectedTermIds),
        status: 'Allocated',
      }
      if (existingIndex >= 0) {
        nextAllocations[existingIndex] = { ...nextAllocations[existingIndex], ...allocationFields }
        updated++
      } else {
        nextAllocations.push({ id: uid(), ...allocationFields })
        added++
      }
    }
    persistLeaves({ studentHostelAllocation: nextAllocations })
    toast.success('Bulk Hostel allocation saved', `${added} added · ${updated} updated`)
    setBulkAllocationOpen(false)
    setBulkAllocationStudentIds([])
  }

  const openBulkTransportAssignment = () => {
    setBulkTransportClass('')
    setBulkTransportStudentIds([])
    setBulkTransportRouteName('')
    setBulkTransportVehicleNo('')
    setBulkTransportPickupPoint('')
    setBulkTransportFee('')
    setBulkTransportOpen(true)
  }

  const selectVisibleTransportStudents = () => {
    setBulkTransportStudentIds((current) => [...new Set([...current, ...bulkTransportVisibleStudents.map((student) => student.id)])])
  }

  const commitBulkTransportAssignment = () => {
    const selectedStudents = bulkTransportStudentIds.flatMap((id) => {
      const student = hostelAllocationStudents.find((row) => row.id === id)
      return student ? [student] : []
    })
    if (!selectedStudents.length) { toast.error('Select at least one student'); return }
    if (!bulkTransportRouteName || !bulkTransportRouteOptions.includes(bulkTransportRouteName)) {
      toast.error('Select a valid active Route')
      return
    }
    if (bulkTransportVehicleNo && !bulkTransportVehicleOptions.includes(bulkTransportVehicleNo)) {
      toast.error('Vehicle not assigned to this Route', 'Choose a vehicle assigned to the selected Route, or leave it blank.')
      return
    }
    if (bulkTransportPickupPoint && !bulkTransportPickupPointOptions.includes(bulkTransportPickupPoint)) {
      toast.error('Pickup point not on this Route', 'Choose a pickup point configured for the selected Route, or leave it blank.')
      return
    }
    const feeValue = bulkTransportFee.trim()
    if (feeValue && (!Number.isFinite(Number(feeValue)) || Number(feeValue) < 0)) {
      toast.error('Transport fee must be zero or greater')
      return
    }

    const currentAssignments = records.studentTransportAssignments ?? []
    if (bulkTransportVehicleNo) {
      const vehicle = (records.transportVehicles ?? []).find((row) => String(row.vehicleNo ?? '').trim() === bulkTransportVehicleNo)
      const capacity = Number(vehicle?.capacity ?? 0)
      if (capacity > 0) {
        const selectedKeys = new Set(selectedStudents.flatMap((student) => [
          `id:${student.id}`,
          `name:${student.name.trim().toLocaleLowerCase()}`,
        ]))
        const alreadyOnVehicle = new Set(currentAssignments
          .filter((row) => transportAssignmentIsActive(row) && String(row.vehicleNo ?? '').trim() === bulkTransportVehicleNo)
          .map(transportAssignmentStudentKey)
          .filter((key) => key && !selectedKeys.has(key)))
        const projectedCount = alreadyOnVehicle.size + selectedStudents.length
        if (projectedCount > capacity) {
          toast.error('Vehicle capacity would be exceeded', `${capacity} seats available; this assignment would reach ${projectedCount}.`)
          return
        }
      }
    }

    const nextAssignments = [...currentAssignments]
    let added = 0
    let updated = 0
    for (const student of selectedStudents) {
      const existingIndex = nextAssignments.findIndex((row) =>
        transportAssignmentIsActive(row) && transportAssignmentMatchesStudent(row, student.id, student.name),
      )
      const assignmentFields = {
        student: student.name,
        studentId: student.id,
        className: student.className,
        routeName: bulkTransportRouteName,
        vehicleNo: bulkTransportVehicleNo,
        pickupPoint: bulkTransportPickupPoint.trim(),
        fee: feeValue,
        status: 'Active',
      }
      if (existingIndex >= 0) {
        nextAssignments[existingIndex] = { ...nextAssignments[existingIndex], ...assignmentFields }
        updated++
      } else {
        nextAssignments.push({ id: uid(), ...assignmentFields })
        added++
      }
    }
    persistLeaves({ studentTransportAssignments: nextAssignments })
    toast.success('Bulk transport assignment saved', `${added} added · ${updated} updated`)
    setBulkTransportOpen(false)
    setBulkTransportStudentIds([])
  }

  // Circulation workflows: one-click return; approve a request issues the book.
  const returnLoan = (id: string) => {
    persist(rows.map((r) => (r.id === id ? { ...r, returnDate: todayISO(), status: 'Returned' } : r)))
    toast.success('Book returned')
  }
  const approveRequest = (row: EduRow) => {
    persistLeaves({
      requestBooks: (records.requestBooks ?? []).map((r) => (r.id === row.id ? { ...r, status: 'Approved' } : r)),
      bookIssueReturn: [...(records.bookIssueReturn ?? []), makeLoanFromRequest(row, todayISO(), settingsFrom(records).loanPeriodDays)],
    })
    toast.success('Request approved — book issued for 14 days')
  }
  const generateSnapshot = () => {
    const today = todayISO()
    const stats = computeLibraryStats(records, staff, users, activeBranchId)
    persist([...rows, { id: uid('rep'), title: snapshotTitle(stats, today), fromDate: today, toDate: today, type: 'Summary' }])
    toast.success('Report generated', 'A snapshot of the current library state was saved.')
  }

  const rejectRequest = (row: EduRow) => {
    persistLeaves({
      requestBooks: (records.requestBooks ?? []).map((r) => (r.id === row.id ? { ...r, status: 'Rejected' } : r)),
    })
    toast.success('Request rejected')
  }

  const submit = () => {
    if (!edit || !leaf) return
    const missing = leaf.fields.find((f) => {
      if (!f.required) return false
      if (f.type === 'multiselect') return !multiSelectValues(edit[f.key]).length
      return !String(edit[f.key] ?? '').trim()
    })
    if (missing) {
      toast.error(`${missing.label} is required`)
      return
    }
    if (leaf.id === 'transportVehicleAssignments') {
      const routeName = String(edit.routeName ?? '').trim()
      const vehicleNos = [...new Set(multiSelectValues(edit.vehicleNo).map((value) => String(value).trim()).filter(Boolean))]
      const status = String(edit.status ?? 'Active').trim() || 'Active'
      if (!routeName || !vehicleNos.length) {
        toast.error(`${!routeName ? 'Route' : 'Vehicle'} is required`)
        return
      }
      if (status.toLocaleLowerCase() !== 'inactive') {
        const activeRoute = (records.transportRoutes ?? []).some((row) =>
          String(row.routeName ?? '').trim() === routeName && transportCatalogRowIsActive(row),
        )
        if (!activeRoute) {
          toast.error('Select an active Route')
          return
        }
        const activeVehicleSet = new Set((records.transportVehicles ?? [])
          .filter(transportCatalogRowIsActive)
          .map((row) => String(row.vehicleNo ?? '').trim())
          .filter(Boolean))
        const invalidVehicle = vehicleNos.find((vehicleNo) => !activeVehicleSet.has(vehicleNo))
        if (invalidVehicle) {
          toast.error('Select active Vehicles', `Vehicle ${invalidVehicle} is not active.`)
          return
        }
        const existingAssignments = records.transportVehicleAssignments ?? []
        const duplicateVehicles: string[] = []
        for (const vehicleNo of vehicleNos) {
          const isDuplicate = existingAssignments.some((row) =>
            row.id !== edit.id
              && String(row.status ?? 'Active').trim().toLocaleLowerCase() !== 'inactive'
              && String(row.routeName ?? '').trim() === routeName
              && String(row.vehicleNo ?? '').trim() === vehicleNo,
          )
          if (isDuplicate) duplicateVehicles.push(vehicleNo)
        }
        if (duplicateVehicles.length) {
          if (duplicateVehicles.length === 1) {
            toast.error('Vehicle already assigned', `Vehicle ${duplicateVehicles[0]} is already assigned to this route.`)
          } else {
            toast.error('Vehicles already assigned', `Vehicles ${duplicateVehicles.join(', ')} are already assigned to this route.`)
          }
          return
        }
      }
      const normalizedRemarks = String(edit.remarks ?? '').trim()
      const existingIndex = rows.findIndex((row) => row.id === edit.id)
      const isExisting = existingIndex >= 0
      if (isExisting) {
        const nextRows = [...rows]
        nextRows[existingIndex] = {
          ...nextRows[existingIndex],
          routeName,
          vehicleNo: vehicleNos[0],
          status,
          remarks: normalizedRemarks,
        }
        for (let i = 1; i < vehicleNos.length; i++) {
          nextRows.push({
            id: uid(),
            routeName,
            vehicleNo: vehicleNos[i],
            status,
            remarks: normalizedRemarks,
          })
        }
        persist(nextRows)
        toast.success(vehicleNos.length > 1 ? `${vehicleNos.length} vehicle assignments saved` : 'Record updated', routeName)
        setEdit(null)
        return
      }
      const newRows = vehicleNos.map((vehicleNo) => ({
        id: uid(),
        routeName,
        vehicleNo,
        status,
        remarks: normalizedRemarks,
      }))
      persist([...rows, ...newRows])
      toast.success(newRows.length > 1 ? `${newRows.length} vehicle assignments added` : 'Record added', routeName)
      setEdit(null)
      return
    }
    if (leaf.id === 'studentTransportAssignments') {
      const vehicleNo = String(edit.vehicleNo ?? '').trim()
      const routeName = String(edit.routeName ?? '').trim()
      const pickupPoint = String(edit.pickupPoint ?? '').trim()
      if (vehicleNo && !assignedVehicleOptionsForRoute(records, routeName).includes(vehicleNo)) {
        toast.error('Vehicle not assigned to this Route', 'Choose a vehicle assigned under Transport → Assign Vehicle, or leave the vehicle blank.')
        return
      }
      if (pickupPoint && !pickupPointOptionsForRoute(records, routeName).includes(pickupPoint)) {
        toast.error('Pickup point not on this Route', 'Choose a pickup point configured for the selected Route, or leave it blank.')
        return
      }
      const feeValue = String(edit.fee ?? '').trim()
      if (feeValue && (!Number.isFinite(Number(feeValue)) || Number(feeValue) < 0)) {
        toast.error('Transport fee must be zero or greater')
        return
      }
    }
    if (isTransportFees) {
      const amount = Number(String(edit.amount ?? '').trim())
      if (!Number.isFinite(amount) || amount < 0) { toast.error('Amount must be zero or greater'); return }
      const percentages: [string, string][] = [
        ['discountPercent', 'Discount %'],
        ['siblingSecondPercent', '2nd Sibling %'],
        ['siblingThirdPercent', '3rd+ Sibling %'],
      ]
      for (const [key, label] of percentages) {
        const raw = String(edit[key] ?? '').trim()
        if (!raw) continue
        const value = Number(raw)
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          toast.error(`${label} must be between 0 and 100`)
          return
        }
      }
      const year = String(edit.academicYear ?? '').trim()
      if (!(records.academicYear ?? []).some((row) => String(row.name ?? '').trim() === year)) {
        toast.error('Select a valid Academic Year')
        return
      }
      const route = String(edit.routeName ?? '').trim()
      if (route && !(records.transportRoutes ?? []).some((row) => String(row.routeName ?? '').trim() === route)) {
        toast.error('Select a valid Route')
        return
      }
      const pickup = String(edit.pickupPoint ?? '').trim()
      if (pickup && route && !pickupPointOptionsForRoute(records, route).includes(pickup)) {
        toast.error('Pickup point not on this Route', 'Choose a pickup point configured for the selected Route, or leave it blank.')
        return
      }
      if (pickup && !route) { toast.error('Select a Route before choosing a Pickup point'); return }
      const duplicate = rows.some((row) => row.id !== edit.id
        && String(row.academicYear ?? '').trim() === year
        && multiSelectValues(row.term).join('|') === multiSelectValues(edit.term).join('|')
        && String(row.routeName ?? '').trim() === route
        && String(row.pickupPoint ?? '').trim() === pickup
        && String(row.vehicleCategory ?? '').trim() === String(edit.vehicleCategory ?? '').trim()
        && String(row.feeStructure ?? '').trim() === String(edit.feeStructure ?? '').trim())
      if (duplicate) {
        toast.error('A matching fee rule already exists', 'Change the Route, Pickup point, Vehicle Category, Terms or Fee Structure.')
        return
      }
    }
    if (isTransportAttendance) {
      const studentName = String(edit.student ?? '').trim()
      const student = (records.studentList ?? []).find((row) => String(row.name ?? '').trim() === studentName)
      if (!student) { toast.error('Select a valid Student'); return }
      const routeName = String(edit.routeName ?? '').trim()
      if (!(records.transportRoutes ?? []).some((row) => String(row.routeName ?? '').trim() === routeName)) {
        toast.error('Select a valid Route')
        return
      }
      const vehicleNo = String(edit.vehicleNo ?? '').trim()
      if (vehicleNo && !assignedVehicleOptionsForRoute(records, routeName).includes(vehicleNo)) {
        toast.error('Vehicle not assigned to this Route', 'Pick a vehicle assigned to the Route, or leave it blank.')
        return
      }
      const pickupPoint = String(edit.pickupPoint ?? '').trim()
      if (pickupPoint && !pickupPointOptionsForRoute(records, routeName).includes(pickupPoint)) {
        toast.error('Pickup point not on this Route')
        return
      }
      const duplicate = rows.some((row) => row.id !== edit.id
        && String(row.date ?? '').trim() === String(edit.date ?? '').trim()
        && String(row.trip ?? '').trim() === String(edit.trip ?? '').trim()
        && (String(row.studentId ?? '').trim()
          ? String(row.studentId ?? '').trim() === String(edit.studentId ?? '').trim()
          : String(row.student ?? '').trim().toLocaleLowerCase() === studentName.toLocaleLowerCase()))
      if (duplicate) {
        toast.error('Attendance already recorded', `${studentName} already has a ${String(edit.trip ?? '').trim()} entry for this date — edit that row instead.`)
        return
      }
      const normalized: EduRow = {
        ...edit,
        studentId: String(edit.studentId ?? '').trim() || String(student.id ?? '').trim(),
        className: String(edit.className ?? '').trim() || String(student.className ?? '').trim(),
        time: String(edit.time ?? '').trim() || nowTimeValue(),
      }
      const exists = rows.some((row) => row.id === normalized.id)
      persist(exists ? rows.map((row) => (row.id === normalized.id ? normalized : row)) : [...rows, normalized])
      toast.success(exists ? 'Attendance updated' : 'Attendance recorded', `${studentName} · ${String(normalized.status ?? '').trim()}`)
      setEdit(null)
      return
    }
    if (isTransportFeeAdjustments) {
      const studentName = String(edit.student ?? '').trim()
      if (!(records.studentList ?? []).some((row) => String(row.name ?? '').trim() === studentName)) {
        toast.error('Select a valid Student')
        return
      }
      const value = Number(String(edit.value ?? '').trim())
      if (!Number.isFinite(value) || value < 0) { toast.error('Value must be zero or greater'); return }
      const type = String(edit.adjustmentType ?? '').trim().toLocaleLowerCase()
      if ((type === 'discount %' || type === 'sibling concession') && value > 100) {
        toast.error('Percentage adjustments cannot exceed 100%')
        return
      }
    }
    if (isTransportPersonnel) {
      const role = String(edit.role ?? '').trim()
      if (!role) { toast.error('Role is required'); return }
      const employeeId = String(edit.employeeId ?? '').trim()
      const duplicateId = rows.some((row) => row.id !== edit.id
        && String(row.employeeId ?? '').trim().toLocaleLowerCase() === employeeId.toLocaleLowerCase())
      if (duplicateId) { toast.error('Employee ID already exists', `Another record already uses ${employeeId}.`); return }
      if (role.toLocaleLowerCase() === 'driver') {
        if (!String(edit.licenseNumber ?? '').trim()) { toast.error('License Number is required for Drivers'); return }
        if (!String(edit.licenseExpiryDate ?? '').trim()) { toast.error('License Expiry Date is required for Drivers'); return }
      }
      const assignedRoute = String(edit.assignedRoute ?? '').trim()
      const assignedVehicle = String(edit.assignedVehicle ?? '').trim()
      if (assignedVehicle && !assignedRoute) {
        toast.error('Select an Assigned Route first', 'A vehicle can only be assigned together with the Route it serves.')
        return
      }
      if (assignedRoute) {
        const activeRoute = (records.transportRoutes ?? []).some((row) =>
          String(row.routeName ?? '').trim() === assignedRoute && transportCatalogRowIsActive(row))
        if (!activeRoute) { toast.error('Select an active Route', `${assignedRoute} is not an active Route.`); return }
      }
      if (assignedVehicle) {
        const routeVehicles = assignedVehicleOptionsForRoute(records, assignedRoute)
        if (!routeVehicles.includes(assignedVehicle)) {
          toast.error('Vehicle not assigned to this Route', `Assign ${assignedVehicle} to ${assignedRoute} under Transport → Assign Vehicle first.`)
          return
        }
      }
    }
    if (leaf.id === 'transportRoutes') {
      if (!activeBranchId) {
        toast.error('Select a Branch')
        return
      }
      const routeStops = parseTransportRouteStops(edit.routeStops)
      const invalidStop = routeStops.some((stop) => {
        const fare = Number(stop.routeFare)
        const distance = stop.distance.trim()
        const invalidDistance = Boolean(distance) && (!Number.isFinite(Number(distance)) || Number(distance) < 0)
        return !stop.stoppageName || !stop.stopTime || !stop.routeFare || !Number.isFinite(fare) || fare < 0 || invalidDistance
      })
      if (!routeStops.length || invalidStop) {
        toast.error('Complete every stoppage row', 'Enter the pickup point, its Stop Time, provide a valid Route Fare, and use a non-negative Distance if supplied.')
        return
      }
    }
    if (
      leaf.id === 'bookIssueReturn' &&
      !rows.some((r) => r.id === edit.id) &&
      String(edit.status ?? '') !== 'Returned' &&
      !canIssueBook(records, String(edit.book ?? ''))
    ) {
      toast.error('No copies available', 'Add stock or receive returns before issuing this book.')
      return
    }
    if (generatedMembers) {
      const row = { member: 'yes', status: 'Active', ...edit, memberType: 'External' }
      const exists = externalRows.some((r) => r.id === edit.id)
      saveMemberStore(membershipOverrides, exists ? externalRows.map((r) => (r.id === edit.id ? row : r)) : [...externalRows, row])
      toast.success(exists ? 'External member updated' : 'External member registered', String(edit.name ?? ''))
      setEdit(null)
      return
    }
    if (leaf.id === 'hostelList') {
      const currentHostels = records.hostelList ?? []
      const previousHostel = currentHostels.find((row) => row.id === edit.id)
      const selectedWardens = multiSelectValues(edit.warden)
      const savedHostel: EduRow = { ...edit, warden: JSON.stringify(selectedWardens) }
      const nextHostels = previousHostel
        ? currentHostels.map((row) => row.id === savedHostel.id ? savedHostel : row)
        : [...currentHostels, savedHostel]
      let nextRecords: EduRecords = { ...records, hostelList: nextHostels }
      const period = activeWardenPeriod(records)
      if (period) {
        nextRecords = syncWardenAssignmentsFromHostel(
          nextRecords,
          previousHostel,
          savedHostel,
          selectedWardens,
          period,
          teachingWardensForBranch(staff, users, activeBranchId),
        )
      }
      setRecords(nextRecords)
      saveEduRecords(activeBranchId, nextRecords)
      toast.success(previousHostel ? 'Hostel updated' : 'Hostel added', String(savedHostel.hostelName ?? ''))
      setEdit(null)
      return
    }
    if (leaf.id === 'studentHostelAllocation') {
      const academicYear = (records.academicYear ?? []).find((row) =>
        String(row.id ?? '') === String(edit.academicYearId ?? '')
          || String(row.name ?? '').trim() === String(edit.academicYear ?? '').trim(),
      )
      const academicYearName = String(academicYear?.name ?? '').trim()
      if (!academicYear || !academicYearName) { toast.error('Select a valid Academic Year / Session'); return }
      const selectedTerms = [...new Set(multiSelectValues(edit.terms))]
      if (!selectedTerms.length) { toast.error('Select at least one Term / Semester'); return }
      const selectedTermRows = (records.termSemester ?? []).filter((row) =>
        String(row.academicYear ?? '').trim() === academicYearName
          && selectedTerms.includes(String(row.name ?? '').trim()),
      )
      const validTermNames = new Set(selectedTermRows.map((row) => String(row.name ?? '').trim()))
      if (selectedTerms.some((term) => !validTermNames.has(term))) {
        toast.error('Choose Terms / Semesters from the selected Academic Year / Session')
        return
      }
      const studentName = String(edit.student ?? '').trim()
      const student = (records.studentList ?? []).find((row) =>
        (String(edit.studentId ?? '').trim() && String(row.id ?? '') === String(edit.studentId ?? '').trim())
          || String(row.name ?? '').trim().toLocaleLowerCase() === studentName.toLocaleLowerCase(),
      )
      const normalizedEdit: EduRow = {
        ...edit,
        ...(student ? { studentId: String(student.id ?? ''), className: String(edit.className ?? student.className ?? '') } : {}),
        academicYear: academicYearName,
        academicYearId: String(academicYear.id),
        session: academicYearName,
        terms: JSON.stringify(selectedTerms),
        termIds: JSON.stringify([...new Set(selectedTermRows.map((row) => String(row.id ?? '').trim()).filter(Boolean))]),
      }
      const exists = rows.some((row) => row.id === normalizedEdit.id)
      if (exists) {
        persist(rows.map((row) => row.id === normalizedEdit.id ? normalizedEdit : row))
        toast.success('Allocation updated', studentName)
      } else {
        const existingIndex = rows.findIndex((row) =>
          hostelAllocationIsActive(row)
            && hostelAllocationMatchesYear(row, String(academicYear.id), academicYearName)
            && hostelAllocationMatchesStudent(row, String(student?.id ?? normalizedEdit.studentId ?? ''), studentName),
        )
        if (existingIndex >= 0) {
          const updated = { ...rows[existingIndex], ...normalizedEdit, id: rows[existingIndex].id }
          persist(rows.map((row, index) => index === existingIndex ? updated : row))
          toast.success('Allocation updated', studentName)
        } else {
          persist([...rows, normalizedEdit])
          toast.success('Allocation added', studentName)
        }
      }
      setEdit(null)
      return
    }
    const routeStops = leaf.id === 'transportRoutes' ? parseTransportRouteStops(edit.routeStops) : []
    const savedEdit: EduRow = leaf.id === 'transportRoutes'
      ? {
          ...edit,
          routeName: String(edit.routeName ?? '').trim(),
          startPlace: String(edit.startPlace ?? '').trim(),
          stopPlace: String(edit.stopPlace ?? '').trim(),
          remarks: String(edit.remarks ?? '').trim(),
          branchId: activeBranchId,
          branchName: branchName ?? '',
          routeStops: JSON.stringify(routeStops),
          pickupPoints: JSON.stringify(routeStops.map((stop) => stop.stoppageName)),
          departureTime: routeStops[0]?.stopTime ?? '',
          returnTime: routeStops[routeStops.length - 1]?.stopTime ?? '',
          fare: routeStops[0]?.routeFare ?? String(edit.fare ?? '0.00'),
          status: String(edit.status ?? 'Active').trim() || 'Active',
        }
      : edit
    const exists = rows.some((r) => r.id === savedEdit.id)
    if (isTransportFees) {
      const previous = rows.find((r) => r.id === savedEdit.id) as EduRow | undefined
      const nextRows = exists ? rows.map((r) => (r.id === savedEdit.id ? savedEdit : r)) : [...rows, savedEdit]
      const entries = feeHistoryEntries(previous, savedEdit, exists ? 'Updated' : 'Created')
      persistLeaves({
        [leaf.id]: nextRows,
        ...(entries.length ? { transportFeeHistory: [...entries, ...(records.transportFeeHistory ?? [])] } : {}),
      })
      toast.success(exists ? 'Fee updated' : 'Fee added', transportFeeLabel(savedEdit))
      setEdit(null)
      return
    }
    if (isTransportFeeAdjustments) {
      const previous = rows.find((r) => r.id === savedEdit.id) as EduRow | undefined
      const nextRows = exists ? rows.map((r) => (r.id === savedEdit.id ? savedEdit : r)) : [...rows, savedEdit]
      const entry = feeHistoryEntry({
        feeRef: `${String(savedEdit.student ?? '').trim()} · ${String(savedEdit.adjustmentType ?? '').trim()}`,
        action: 'Adjustment',
        fieldChanged: exists ? 'Adjustment' : 'New adjustment',
        previousValue: previous ? String(previous.status ?? '').trim() : '',
        newValue: String(savedEdit.status ?? '').trim(),
        amountAfter: String(savedEdit.value ?? '').trim(),
        remarks: String(savedEdit.reason ?? '').trim(),
      })
      persistLeaves({
        [leaf.id]: nextRows,
        transportFeeHistory: [entry, ...(records.transportFeeHistory ?? [])],
      })
      toast.success(exists ? 'Adjustment updated' : 'Adjustment added', String(savedEdit.student ?? ''))
      setEdit(null)
      return
    }
    if (isTransportPersonnel) {
      const nextRows = exists ? rows.map((r) => (r.id === savedEdit.id ? savedEdit : r)) : [...rows, savedEdit]
      const previous = rows.find((r) => r.id === savedEdit.id)
      const historyEntry = personnelHistoryRow(previous, savedEdit)
      if (historyEntry) {
        persistLeaves({
          [leaf.id]: nextRows,
          transportPersonnelHistory: [historyEntry, ...(records.transportPersonnelHistory ?? [])],
        })
      } else {
        persist(nextRows)
      }
      toast.success(exists ? 'Record updated' : 'Record added', String(savedEdit.fullName ?? ''))
      const expiryStatus = licenseStatus(savedEdit.licenseExpiryDate)
      if (expiryStatus === 'expired') {
        toast.error('License expired', `The licence for ${String(savedEdit.fullName ?? 'this personnel')} has expired.`)
      } else if (expiryStatus === 'expiring') {
        toast.error('License expiring soon', `The licence for ${String(savedEdit.fullName ?? 'this personnel')} expires in ${daysUntil(String(savedEdit.licenseExpiryDate ?? ''))} day(s).`)
      }
      setEdit(null)
      return
    }
    persist(exists ? rows.map((r) => (r.id === savedEdit.id ? savedEdit : r)) : [...rows, savedEdit])
    toast.success(exists ? 'Record updated' : 'Record added', leaf.fields[0] ? String(savedEdit[leaf.fields[0].key] || '') : '')
    setEdit(null)
  }

  if (group.id === 'library' && leaf.id === 'librarySettings') {
    return (
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-mist">
          <span>Administration</span>
          {crumb.map((c) => (
            <span key={c} className="contents">
              <span>/</span><span>{c}</span>
            </span>
          ))}
          <span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
        </div>
        <PageHeader title={t(leaf.key)} desc={`${t(group.key)} · ${branchName ?? 'Branch'} — Education Management`} />
        <LibraryStatsBar records={records} staff={staff} users={users} branchId={activeBranchId} />
        <LibrarySettingsCard
          leaf={leaf}
          row={(records.librarySettings ?? [])[0]}
          onSave={(r) => {
            persist([r])
            toast.success('Library settings saved')
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        {crumb.map((c) => (
          <span key={c} className="contents">
            <span>/</span><span>{c}</span>
          </span>
        ))}
        <span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
      </div>
      <PageHeader title={t(leaf.key)} desc={`${t(group.key)} · ${branchName ?? 'Branch'} — Education Management`} />

      {group.id === 'library' && <LibraryStatsBar records={records} staff={staff} users={users} branchId={activeBranchId} />}

      {isTransportAttendance && attendanceSummary && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Expected" value={String(attendanceSummary.expected)} hint="Active transport assignments" />
          <StatCard label="Picked up" value={String(attendanceSummary.pickedUp)} icon={<Check className="size-4" />} />
          <StatCard label="Dropped off" value={String(attendanceSummary.droppedOff)} />
          <StatCard label="Late pickup" value={String(attendanceSummary.latePickup)} />
          <StatCard label="Absent" value={String(attendanceSummary.absent)} />
          <StatCard label="Exception" value={String(attendanceSummary.exception)} />
          <StatCard label="Not recorded" value={String(attendanceSummary.notRecorded)} hint={attendanceSummary.notRecorded ? 'Still to be marked' : 'All marked'} />
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${t(leaf.key).toLowerCase()}…`} />
          {generatedMembers && (
            <Select value={memberTypeFilter} onChange={(e) => setMemberTypeFilter(e.target.value)} aria-label="Filter by member type" className="w-32">
              <option value="">All types</option>
              <option value="Student">Student</option>
              <option value="Staff">Staff</option>
              <option value="External">External</option>
            </Select>
          )}
          {generatedMembers && (
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className="w-32">
              <option value="">All classes</option>
              {classOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
            </Select>
          )}
          {leaf.id === 'books' && (
            <div className="flex overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setBooksView('grid')}
                aria-label="Catalog view"
                className={`p-2 ${booksView === 'grid' ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit'}`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setBooksView('table')}
                aria-label="Table view"
                className={`p-2 ${booksView === 'table' ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit'}`}
              >
                <List className="size-4" />
              </button>
            </div>
          )}
          {leaf.id === 'libraryReports' && (
            <Button size="sm" variant="outline" onClick={generateSnapshot}>
              <Plus className="size-4" /> Generate Snapshot
            </Button>
          )}
          {isStudentHostelAllocation && (
            <Button
              size="sm"
              variant="outline"
              onClick={openBulkHostelAllocation}
              disabled={!hostelAllocationStudents.length || !bulkHostelOptions.length || !bulkAcademicYears.length}
              title={!hostelAllocationStudents.length ? 'Add students first' : !bulkHostelOptions.length ? 'Add a Hostel first' : !bulkAcademicYears.length ? 'Add an Academic Year / Session first' : 'Allocate multiple students to a Hostel'}
            >
              <Users className="size-4" /> Bulk allocate
            </Button>
          )}
          {isStudentTransportAssignments && (
            <Button
              size="sm"
              variant="outline"
              onClick={openBulkTransportAssignment}
              disabled={!hostelAllocationStudents.length || !bulkTransportRouteOptions.length}
              title={!hostelAllocationStudents.length ? 'Add students first' : !bulkTransportRouteOptions.length ? 'Add an active Route first' : 'Assign transport to multiple students'}
            >
              <Users className="size-4" /> Assign multiple
            </Button>
          )}
          {isTransportAttendance && (
            <>
              <DatePicker value={attendanceDate} onChange={setAttendanceDate} className="w-40" aria-label="Attendance date" />
              <Select value={attendanceTrip} onChange={(event) => setAttendanceTrip(event.target.value)} className="w-44" aria-label="Trip">
                {TRANSPORT_TRIPS.map((trip) => (<option key={trip} value={trip}>{trip}</option>))}
              </Select>
              <Select
                value={attendanceRoute}
                onChange={(event) => { setAttendanceRoute(event.target.value); setAttendanceVehicle('') }}
                className="w-48"
                aria-label="Route"
              >
                <option value="">All routes</option>
                {attendanceRouteOptions.map((route) => (<option key={route} value={route}>{route}</option>))}
              </Select>
              <Select
                value={attendanceVehicle}
                onChange={(event) => setAttendanceVehicle(event.target.value)}
                className="w-44"
                disabled={!attendanceRoute}
                aria-label="Vehicle"
              >
                <option value="">{!attendanceRoute ? 'All vehicles' : attendanceVehicleOptions.length ? 'All vehicles on route' : 'No vehicle on this route'}</option>
                {attendanceVehicleOptions.map((vehicle) => (<option key={vehicle} value={vehicle}>{vehicle}</option>))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={openAttendanceBulk}
                disabled={!attendanceExpected.length}
                title={attendanceExpected.length ? 'Mark attendance for every student expected on this Route' : 'Assign students to a Route first'}
              >
                <ClipboardCheck className="size-4" /> Mark attendance
              </Button>
            </>
          )}
          {menuLeaf.id === 'transportFees' && (
            <div className="flex overflow-hidden rounded-lg border border-line" role="tablist" aria-label="Transport fees sections">
              <button
                type="button"
                role="tab"
                aria-selected={feesTab === 'rules'}
                onClick={() => setFeesTab('rules')}
                title="Rate cards: fees by Route, Pickup point, Vehicle Category, Term and Academic Year"
                className={`px-3 py-1.5 text-xs font-semibold transition ${feesTab === 'rules' ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
              >
                Fee Rules{(records.transportFees ?? []).length ? ` (${(records.transportFees ?? []).length})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={feesTab === 'adjustments'}
                onClick={() => setFeesTab('adjustments')}
                title="Student-level discounts, surcharges, waivers and sibling concessions"
                className={`px-3 py-1.5 text-xs font-semibold transition ${feesTab === 'adjustments' ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
              >
                Adjustments{(records.transportFeeAdjustments ?? []).length ? ` (${(records.transportFeeAdjustments ?? []).length})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={feesTab === 'history'}
                onClick={() => setFeesTab('history')}
                title="Every fee change, approval and billing post — written automatically"
                className={`px-3 py-1.5 text-xs font-semibold transition ${feesTab === 'history' ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
              >
                History{(records.transportFeeHistory ?? []).length ? ` (${(records.transportFeeHistory ?? []).length})` : ''}
              </button>
            </div>
          )}
          {menuLeaf.id === 'transportPersonnel' && (
            <div className="flex overflow-hidden rounded-lg border border-line" role="tablist" aria-label="Transport personnel sections">
              <button
                type="button"
                role="tab"
                aria-selected={personnelTab === 'roster'}
                onClick={() => setPersonnelTab('roster')}
                title="Drivers and attendants with licence, contact, route and employment details"
                className={`px-3 py-1.5 text-xs font-semibold transition ${personnelTab === 'roster' ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
              >
                Drivers &amp; Attendants{(records.transportPersonnel ?? []).length ? ` (${(records.transportPersonnel ?? []).length})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={personnelTab === 'history'}
                onClick={() => setPersonnelTab('history')}
                title="Route and vehicle assignment history — written automatically"
                className={`px-3 py-1.5 text-xs font-semibold transition ${personnelTab === 'history' ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10'}`}
              >
                Assignment History{(records.transportPersonnelHistory ?? []).length ? ` (${(records.transportPersonnelHistory ?? []).length})` : ''}
              </button>
            </div>
          )}
          {isTransportPersonnel && (personnelAlerts?.expired || personnelAlerts?.expiring) ? (
            <Button
              size="sm"
              variant={personnelAlertsOnly ? 'outline' : 'ghost'}
              onClick={() => setPersonnelAlertsOnly((current) => !current)}
              title="Show only personnel whose licence has expired or expires within 30 days"
              className={personnelAlertsOnly ? '' : 'text-amber-600 dark:text-amber-300'}
            >
              <AlertTriangle className="size-4" />
              {personnelAlertsOnly ? 'Show all personnel' : `License alerts (${(personnelAlerts?.expired ?? 0) + (personnelAlerts?.expiring ?? 0)})`}
            </Button>
          ) : null}
          {generatedMembers ? (
            <Button size="sm" onClick={() => setEdit({ id: `${EXTERNAL_MEMBER_PREFIX}${uid()}`, memberType: 'External' })}>
              <Plus className="size-4" /> Register External Member
            </Button>
          ) : leaf.id === 'marksheetTemplate' ? (
            // Marksheet Template offers a drag-and-drop designer next to Add.
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setCertBuilderRow(null); setCertBuilderOpen(true) }}>
                <Plus className="size-4" /> New Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setDesignerRow(null); setDesignerOpen(true) }}>
                <LayoutGrid className="size-4" /> Drag &amp; Drop Sheet
              </Button>
              <Button size="sm" onClick={openNewRow}>
                <Plus className="size-4" /> Add {editorLabel}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={openNewRow}>
              <Plus className="size-4" /> Add {editorLabel}
            </Button>
          )}
        </div>
        {isTransportAttendance && attendanceSummary && attendanceSummary.alerts.length ? (
          <div className={`flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs ${attendanceSummary.absent
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {attendanceSummary.alerts.length} of {attendanceSummary.expected} student{attendanceSummary.expected === 1 ? '' : 's'} expected on transport
              {' '}— {attendanceSummary.absent ? `${attendanceSummary.absent} absent, ` : ''}{attendanceSummary.notRecorded} not yet recorded for {attendanceDate} · {attendanceTrip}.
              {attendanceSummary.alerts.length <= 4
                ? ` (${attendanceSummary.alerts.map((alert) => `${alert.studentName}${alert.status === 'Not recorded' ? '' : ` — ${alert.status}`}`).join(', ')})`
                : ''}
            </span>
            <button
              type="button"
              className="ml-auto rounded-md px-2 py-1 font-medium underline-offset-2 hover:underline"
              onClick={openAttendanceBulk}
            >
              Record now
            </button>
          </div>
        ) : null}
        {isTransportPersonnel && (personnelAlerts?.expired || personnelAlerts?.expiring) ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {personnelAlerts?.expired ? `${personnelAlerts.expired} licence${personnelAlerts.expired === 1 ? '' : 's'} expired` : null}
              {personnelAlerts?.expired && personnelAlerts?.expiring ? ' · ' : null}
              {personnelAlerts?.expiring ? `${personnelAlerts.expiring} expiring within 30 days` : null}
            </span>
            <button
              type="button"
              className="ml-auto rounded-md px-2 py-1 font-medium underline-offset-2 hover:underline"
              onClick={() => setPersonnelAlertsOnly((current) => !current)}
            >
              {personnelAlertsOnly ? 'Show all personnel' : 'Review alerts'}
            </button>
          </div>
        ) : null}
        {leaf.id === 'books' && booksView === 'grid' ? (
          <BooksCatalogGrid books={filtered} records={records} />
        ) : generatedMembers ? (
          <DataTable
            columns={buildMemberColumns({
              fields: leaf.fields,
              stateFor,
              onMember: (id, member) => setMemberState(id, { member }),
              onStatus: (id, status) => setMemberState(id, { status }),
              allMembers,
              onAllMembers: setAllMembers,
              finesFor: (r) => finesMap[String(r.name ?? '').trim()] ?? 0,
              serialNumber: true,
            })}
            data={filtered}
            rowKey={(r) => r.id}
            pageSize={25}
            emptyTitle={`No ${t(leaf.key).toLowerCase()} yet`}
            emptyDesc="Members are generated from Students and Employees; register external members with the button above."
          />
        ) : (group.id === 'library' || isTransportDataTable) ? (
          <DataTable
            columns={buildLeafColumns(leaf, {
              actions: leafRowActions,
              badgeFor: leafBadgeFor,
              // Every table in this branch is a record list — number them all.
              serialNumber: true,
            })}
            data={filtered}
            rowKey={(r) => r.id}
            pageSize={10}
            emptyTitle={`No ${t(leaf.key).toLowerCase()} yet`}
            emptyDesc="Use Add to create the first record."
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                {serialisePlainRows && <th className="w-12 px-3 py-2.5 text-center">SL</th>}
                {tableFields.map((f) => (
                  <th key={f.key} className={`px-3 py-2.5 ${f.type === 'number' ? 'text-right' : ''}`}>{f.label}</th>
                ))}
                {generatedMembers && (
                  <th className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime"
                        checked={allMembers}
                        onChange={(e) => setAllMembers(e.target.checked ? 'yes' : 'no')}
                        aria-label="Check all library members"
                      />
                      Member
                    </span>
                  </th>
                )}
                {generatedMembers && <th className="px-3 py-2.5">Membership Status</th>}
                {(!generatedMembers || externalRows.length > 0) && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((r, rowIndex) => (
                <tr
                  key={r.id}
                  // A marksheet template opens by clicking anywhere on its row —
                  // the live preview is the reason you open one. Clicks that
                  // land on the Edit/Delete buttons are left to those buttons,
                  // so deleting a row never also opens it.
                  onClick={leaf.id === 'marksheetTemplate'
                    ? (event) => {
                        if ((event.target as HTMLElement).closest('button')) return
                        openEditRow(r)
                      }
                    : undefined}
                  className={`border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${leaf.id === 'marksheetTemplate' ? 'cursor-pointer' : ''}`}
                >
                  {serialisePlainRows && <td className="px-3 py-2 text-center text-mist">{rowIndex + 1}</td>}
                  {tableFields.map((f) => (
                    <td key={f.key} className={`px-3 py-2 ${f.type === 'number' ? 'text-right font-mono' : ''}`}>
                      {leaf.id === 'examSetup' && (f.key === 'publish' || f.key === 'publishResult') ? (
                        <PublishToggle
                          on={String(r[f.key] ?? '').trim().toLocaleLowerCase() === 'yes'}
                          label={`${f.label} for ${String(r.examName ?? '').trim() || 'this exam'}`}
                          onChange={(next) => toggleExamPublish(r.id, f.key, next)}
                        />
                      ) : leaf.id === 'bookIssueReturn' && f.key === 'status' ? (
                        isOverdueLoan(r) ? (
                          <Badge tone="rose">
                            Overdue{overdueFine(r, settingsFrom(records).finePerDay) > 0
                              ? ` · ${formatGhs(overdueFine(r, settingsFrom(records).finePerDay))}`
                              : ''}
                          </Badge>
                        ) : (
                          <Badge tone={String(r.status) === 'Returned' ? 'zinc' : 'lime'}>{String(r.status || '—')}</Badge>
                        )
                      ) : f.type === 'image' ? (
                        String(r[f.key] ?? '').startsWith('data:') ? (
                          <img src={String(r[f.key])} alt="" className="h-9 w-7 rounded object-cover" />
                        ) : (
                          '—'
                        )
                      ) : f.type === 'time' ? (
                        formatTimeForDisplay(r[f.key]) || '—'
                      ) : f.type === 'multiselect' ? (
                        multiSelectValues(r[f.key]).join(', ') || '—'
                      ) : String(r[f.key] ?? '').trim() ? (
                        String(r[f.key])
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  {generatedMembers && (
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime"
                        checked={stateFor(r).member === 'yes'}
                        onChange={(e) => setMemberState(r.id, { member: e.target.checked ? 'yes' : 'no' })}
                        aria-label={`Library membership for ${r.name}`}
                      />
                    </td>
                  )}
                  {generatedMembers && (
                    <td className="px-3 py-2">
                      <Select
                        value={stateFor(r).status}
                        onChange={(e) => setMemberState(r.id, { status: e.target.value as 'Active' | 'Inactive' })}
                        aria-label={`Membership status for ${r.name}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </Select>
                    </td>
                  )}
                  {(!generatedMembers || r.id.startsWith(EXTERNAL_MEMBER_PREFIX)) && (
                    <td className="px-3 py-2 text-right">{leafRowActions(r)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title={`No ${t(leaf.key).toLowerCase()} yet`} desc="Use Add to create the first record." />}
        </div>
        )}
      </div>

      <Modal open={bulkAllocationOpen} onClose={() => setBulkAllocationOpen(false)} title="Bulk student Hostel allocation" xl>
        <div className="grid gap-4">
          <p className="text-sm text-mist">
            Select an Academic Year / Session, one or more Terms / Semesters, and several students to allocate them to one Hostel at once. Existing active allocations in that year are updated; checked-out allocation records are kept as history.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Academic Year / Session" required>
              <Select
                value={bulkAllocationAcademicYearId}
                onChange={(event) => { setBulkAllocationAcademicYearId(event.target.value); setBulkAllocationTerms([]) }}
                placeholder="Select Academic Year / Session…"
              >
                <option value="">Select Academic Year / Session…</option>
                {bulkAcademicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </Select>
            </Field>
            <Field label="Term / Semester(s)" required>
              <MultiSelect
                options={bulkTermOptions.map((term) => ({ value: term, label: term }))}
                values={bulkAllocationTerms}
                onChange={setBulkAllocationTerms}
                disabled={!bulkAllocationAcademicYearId || !bulkTermOptions.length}
                placeholder={bulkAllocationAcademicYearId ? 'Select one or more Terms / Semesters…' : 'Select an Academic Year / Session first'}
                aria-label="Terms or semesters for bulk allocation"
              />
            </Field>
          </div>
          {bulkAllocationAcademicYearId && !bulkTermOptions.length && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              No Terms / Semesters are configured for the selected Academic Year / Session.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Filter students by class">
              <Select value={bulkAllocationClass} onChange={(event) => setBulkAllocationClass(event.target.value)}>
                <option value="">All classes</option>
                {hostelAllocationClasses.map((className) => <option key={className} value={className}>{className}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectVisibleBulkStudents} disabled={!bulkVisibleStudents.length}>Select all shown</Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkAllocationStudentIds([])} disabled={!bulkAllocationStudentIds.length}>Clear selection</Button>
            </div>
          </div>
          <Field label={`Students (${bulkAllocationStudentIds.length} selected)`} required>
            <MultiSelect
              options={bulkVisibleStudents.map((student) => ({
                value: student.id,
                label: [student.name, student.className, student.admissionNo].filter(Boolean).join(' · '),
              }))}
              values={bulkAllocationStudentIds}
              onChange={setBulkAllocationStudentIds}
              placeholder="Select one or more students…"
              aria-label="Students to allocate"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hostel" required>
              <Select
                value={bulkAllocationHostel}
                onChange={(event) => { setBulkAllocationHostel(event.target.value); setBulkAllocationRoom('') }}
                placeholder="Select Hostel…"
              >
                <option value="">Select Hostel…</option>
                {bulkHostelOptions.map((hostel) => <option key={hostel} value={hostel}>{hostel}</option>)}
              </Select>
            </Field>
            <Field label="Room (optional)">
              <Select
                value={bulkAllocationRoom}
                onChange={(event) => setBulkAllocationRoom(event.target.value)}
                disabled={!bulkAllocationHostel}
                placeholder="No room assigned"
              >
                <option value="">No room assigned</option>
                {bulkRoomOptions.map((roomNumber) => <option key={roomNumber} value={roomNumber}>{roomNumber}</option>)}
              </Select>
            </Field>
            <Field label="Allocation date" required>
              <DatePicker value={bulkAllocationDate} onChange={setBulkAllocationDate} />
            </Field>
          </div>
          <p className="rounded-xl border border-line bg-black/[0.02] p-3 text-xs text-mist dark:bg-white/[0.03]">
            The selected students will be marked <span className="font-semibold text-inherit">Allocated</span>. Hostel and room capacities are checked against active allocations in the selected Academic Year / Session and overlapping Terms / Semesters.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={commitBulkHostelAllocation} disabled={!bulkAllocationStudentIds.length || !bulkAllocationAcademicYearId || !bulkAllocationTerms.length || !bulkAllocationHostel || !bulkAllocationDate}>
              <Users className="size-4" /> Allocate {bulkAllocationStudentIds.length} student{bulkAllocationStudentIds.length === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" onClick={() => setBulkAllocationOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={attendanceBulkOpen} onClose={() => setAttendanceBulkOpen(false)} title="Mark transport attendance" wide>
        <div className="grid gap-3">
          <p className="text-xs leading-relaxed text-mist">
            {attendanceDate} · {attendanceTrip} — {attendanceRoute || 'All routes'}
            {attendanceVehicle ? ` · ${attendanceVehicle}` : ''}. Pick a status for each student and add remarks where needed.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date">
              <DatePicker value={attendanceDate} onChange={(value) => { setAttendanceDate(value); refreshAttendanceDraft({ date: value }) }} aria-label="Attendance date" />
            </Field>
            <Field label="Trip">
              <Select value={attendanceTrip} onChange={(event) => { setAttendanceTrip(event.target.value); refreshAttendanceDraft({ trip: event.target.value }) }} aria-label="Trip">
                {TRANSPORT_TRIPS.map((trip) => (<option key={trip} value={trip}>{trip}</option>))}
              </Select>
            </Field>
            <Field label="Route">
              <Select
                value={attendanceRoute}
                onChange={(event) => { setAttendanceRoute(event.target.value); setAttendanceVehicle(''); refreshAttendanceDraft({ route: event.target.value, vehicle: '' }) }}
                aria-label="Route"
              >
                <option value="">All routes</option>
                {attendanceRouteOptions.map((route) => (<option key={route} value={route}>{route}</option>))}
              </Select>
            </Field>
            <Field label="Vehicle" hint={attendanceRoute ? undefined : 'Select a Route first to filter by vehicle'}>
              <Select
                value={attendanceVehicle}
                onChange={(event) => { setAttendanceVehicle(event.target.value); refreshAttendanceDraft({ vehicle: event.target.value }) }}
                disabled={!attendanceRoute}
                aria-label="Vehicle"
              >
                <option value="">{!attendanceRoute ? 'All vehicles' : attendanceVehicleOptions.length ? 'All vehicles on route' : 'No vehicle on this route'}</option>
                {attendanceVehicleOptions.map((vehicle) => (<option key={vehicle} value={vehicle}>{vehicle}</option>))}
              </Select>
            </Field>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
              <p className="text-xs font-semibold">
                Students expected ({attendanceExpected.length})
              </p>
              <label className="flex items-center gap-2 text-xs">
                <span className="font-medium">Select For Everyone <span className="text-rose-500">*</span></span>
                <Select
                  value=""
                  onChange={(event) => {
                    const status = event.target.value
                    if (!status) return
                    setAttendanceDraft(Object.fromEntries(
                      attendanceExpected.map((student) => [student.key, status === '__clear__' ? '' : status]),
                    ))
                  }}
                  className="w-40"
                  aria-label="Select for everyone"
                >
                  <option value="">Not Selected</option>
                  {TRANSPORT_ATTENDANCE_STATUSES.map((status) => (<option key={status} value={status}>{status}</option>))}
                  <option value="__clear__">Clear all</option>
                </Select>
              </label>
            </div>

            <div className="hidden grid-cols-[minmax(0,1.6fr)_5rem_8rem_minmax(0,2.4fr)_minmax(0,1.3fr)] gap-2 border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-mist md:grid">
              <span>Name</span>
              <span>Roll</span>
              <span>Register No</span>
              <span>Status</span>
              <span>Remarks</span>
            </div>

            <div className="max-h-[50vh] divide-y divide-line overflow-y-auto">
              {attendanceExpected.map((student) => {
                const selected = String(attendanceDraft[student.key] ?? '').trim()
                return (
                  <div
                    key={student.key}
                    className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1.6fr)_5rem_8rem_minmax(0,2.4fr)_minmax(0,1.3fr)] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{student.studentName}</p>
                      <p className="truncate text-[11px] text-mist md:hidden">
                        {[student.rollNo && `Roll ${student.rollNo}`, student.admissionNo, student.routeName, student.pickupPoint]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="hidden truncate text-xs text-mist md:block">{student.rollNo || '—'}</p>
                    <p className="hidden truncate text-xs text-mist md:block">{student.admissionNo || '—'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {TRANSPORT_ATTENDANCE_STATUSES.map((status) => (
                        <label
                          key={status}
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-medium"
                        >
                          <input
                            type="radio"
                            name={`attendance-${student.key}`}
                            value={status}
                            checked={selected === status}
                            onChange={() => setAttendanceDraft((current) => ({ ...current, [student.key]: status }))}
                            className="size-4 accent-lime"
                            aria-label={`${student.studentName} — ${status}`}
                          />
                          <span className={selected === status ? 'text-inherit' : 'text-mist'}>{status}</span>
                        </label>
                      ))}
                      {selected && (
                        <button
                          type="button"
                          onClick={() => setAttendanceDraft((current) => ({ ...current, [student.key]: '' }))}
                          className="text-[11px] text-mist underline-offset-2 hover:text-inherit hover:underline"
                        >
                          clear
                        </button>
                      )}
                    </div>
                    <Input
                      value={String(attendanceRemarks[student.key] ?? '')}
                      onChange={(event) => setAttendanceRemarks((current) => ({ ...current, [student.key]: event.target.value }))}
                      placeholder="Remarks"
                      aria-label={`Remarks for ${student.studentName}`}
                      className="min-h-8"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-xs text-mist">
              Time applied to every entry: {attendanceBulkTime || nowTimeValue()}
              <TimePicker
                value={attendanceBulkTime}
                onChange={setAttendanceBulkTime}
                displayFormat="12h"
                aria-label="Attendance time"
                className="ml-2 w-32"
              />
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setAttendanceBulkOpen(false)}>Cancel</Button>
              <Button onClick={saveAttendanceBulk}><Check className="size-4" /> Save</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={bulkTransportOpen} onClose={() => setBulkTransportOpen(false)} title="Assign transport to multiple students">
        <div className="grid gap-3">
          <p className="text-xs leading-relaxed text-mist">
            Select several students and apply one route, vehicle, pickup point and fee. Existing active assignments are updated; inactive records are kept as history.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Filter students by class">
              <Select value={bulkTransportClass} onChange={(event) => setBulkTransportClass(event.target.value)}>
                <option value="">All classes</option>
                {hostelAllocationClasses.map((className) => <option key={className} value={className}>{className}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectVisibleTransportStudents} disabled={!bulkTransportVisibleStudents.length}>Select all shown</Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkTransportStudentIds([])} disabled={!bulkTransportStudentIds.length}>Clear selection</Button>
            </div>
          </div>
          <Field label={`Students (${bulkTransportStudentIds.length} selected)`} required>
            <MultiSelect
              options={bulkTransportVisibleStudents.map((student) => ({
                value: student.id,
                label: [student.name, student.className, student.admissionNo].filter(Boolean).join(' · '),
              }))}
              values={bulkTransportStudentIds}
              onChange={setBulkTransportStudentIds}
              placeholder="Select one or more students…"
              aria-label="Students to assign transport"
            />
          </Field>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Route" required>
              <Select
                value={bulkTransportRouteName}
                onChange={(event) => {
                  const routeName = event.target.value
                  const availableVehicles = assignedVehicleOptionsForRoute(records, routeName)
                  const availablePickupPoints = pickupPointOptionsForRoute(records, routeName)
                  const nextFee = fareForRoute(records, routeName)
                  setBulkTransportRouteName(routeName)
                  setBulkTransportVehicleNo((current) => availableVehicles.includes(current) ? current : '')
                  setBulkTransportPickupPoint((current) => availablePickupPoints.includes(current) ? current : '')
                  setBulkTransportFee(nextFee)
                }}
                placeholder="Select an active Route…"
              >
                <option value="">Select an active Route…</option>
                {bulkTransportRouteOptions.map((route) => <option key={route} value={route}>{route}</option>)}
              </Select>
            </Field>
            <Field
              label="Vehicle (optional)"
              hint={!bulkTransportRouteName
                ? 'Choose a Route first to see its assigned vehicles.'
                : !bulkTransportVehicleOptions.length
                  ? 'Assign a vehicle to this Route under Transport → Assign Vehicle.'
                  : undefined}
            >
              <Select
                value={bulkTransportVehicleNo}
                onChange={(event) => setBulkTransportVehicleNo(event.target.value)}
                disabled={!bulkTransportRouteName || !bulkTransportVehicleOptions.length}
              >
                <option value="">
                  {!bulkTransportRouteName ? 'Select a Route first' : bulkTransportVehicleOptions.length ? 'No vehicle selected' : 'No vehicle assigned to this Route'}
                </option>
                {bulkTransportVehicleOptions.map((vehicleNo) => <option key={vehicleNo} value={vehicleNo}>{vehicleNo}</option>)}
              </Select>
            </Field>
            <Field
              label="Pickup point (optional)"
              hint={!bulkTransportRouteName
                ? 'Choose a Route first to see its pickup points.'
                : !bulkTransportPickupPointOptions.length
                  ? 'No pickup points configured for this Route.'
                  : undefined}
            >
              <Select
                value={bulkTransportPickupPoint}
                onChange={(event) => {
                  const nextPoint = event.target.value
                  const matchedFare = fareForPickupPoint(records, bulkTransportRouteName, nextPoint)
                  setBulkTransportPickupPoint(nextPoint)
                  if (matchedFare !== null) setBulkTransportFee(matchedFare)
                }}
                disabled={!bulkTransportRouteName || !bulkTransportPickupPointOptions.length}
              >
                <option value="">
                  {!bulkTransportRouteName ? 'Select a Route first' : bulkTransportPickupPointOptions.length ? 'No pickup point selected' : 'No pickup point on this Route'}
                </option>
                {bulkTransportPickupPointOptions.map((point) => <option key={point} value={point}>{point}</option>)}
              </Select>
            </Field>
            <Field label="Transport fee (optional)" hint={bulkTransportRouteName && fareForRoute(records, bulkTransportRouteName) ? 'Auto-filled from Route / Pickup point; you may adjust it.' : undefined}>
              <Input type="number" min={0} step="0.01" value={bulkTransportFee} onChange={(event) => setBulkTransportFee(event.target.value)} placeholder="Defaults to the selected route fare" />
            </Field>
          </div>
          <p className="rounded-lg border border-line bg-black/[0.02] p-2.5 text-[11px] leading-relaxed text-mist dark:bg-white/[0.03]">
            Selected students receive an <span className="font-semibold text-inherit">Active</span> assignment. Vehicle capacity is checked when a vehicle is selected.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={commitBulkTransportAssignment}
              disabled={!bulkTransportStudentIds.length || !bulkTransportRouteName}
            >
              <Users className="size-3.5" /> Assign {bulkTransportStudentIds.length} student{bulkTransportStudentIds.length === 1 ? '' : 's'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBulkTransportOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Drag & Drop Sheet: builds a template by arranging blocks, then saves
          it as an ordinary record so the normal form can reopen it. */}
      <MarksheetDesignerModal
        open={designerOpen}
        initial={designerRow}
        schoolName={String(branchName ?? 'School')}
        branchName={String(branchName ?? '')}
        examNames={designerExamNames}
        partsForExam={partsForExam}
        reportOptionChoices={
          leaf.fields.find((field) => field.key === 'reportOptions')?.options ?? []
        }
        onClose={() => { setDesignerOpen(false); setDesignerRow(null) }}
        onSave={(row) => {
          const existing = records[leaf.id] ?? []
          const isUpdate = existing.some((r) => r.id === row.id)
          persist(isUpdate ? existing.map((r) => (r.id === row.id ? row : r)) : [...existing, row])
          setDesignerOpen(false)
          setDesignerRow(null)
          setEdit(row)
        }}
      />
      {/* Certificate Builder — free-position like Tutor LMS (New Template button) */}
      <CertificateBuilderModal
        open={certBuilderOpen}
        initial={certBuilderRow}
        schoolName={String(branchName ?? 'School')}
        onClose={() => { setCertBuilderOpen(false); setCertBuilderRow(null) }}
        onSave={(row) => {
          const existing = records[leaf.id] ?? []
          const isUpdate = existing.some((r) => r.id === row.id)
          persist(isUpdate ? existing.map((r) => (r.id === row.id ? row : r)) : [...existing, row])
          setCertBuilderOpen(false)
          setCertBuilderRow(null)
          toast.success('Certificate template saved')
        }}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={
          generatedMembers
            ? externalRows.some((r) => r.id === edit?.id)
              ? 'Edit External Member'
              : 'Register External Member'
            : rows.some((r) => r.id === edit?.id)
              ? `Edit ${editorLabel}`
              : `Add ${editorLabel}`
        }
        wide={sideBySideTransportVehicle || leaf.id === 'transportRoutes' || leaf.id === 'marksheetTemplate'}
        xl={leaf.id === 'marksheetTemplate'}
      >
        {edit && leaf.id === 'transportRoutes' ? (
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-xl border border-line divide-y divide-line">
              <div className="grid items-center gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <label htmlFor="transport-route-name" className="text-sm font-medium sm:text-right">Route Name <span className="text-rose-500">*</span></label>
                <Input id="transport-route-name" value={String(edit.routeName ?? '')} onChange={(event) => updateEditField('routeName', event.target.value)} placeholder="Enter route name" aria-label="Route Name" />
              </div>
              <div className="grid items-center gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <label htmlFor="transport-route-start-place" className="text-sm font-medium sm:text-right">Start Place <span className="text-rose-500">*</span></label>
                <Input id="transport-route-start-place" value={String(edit.startPlace ?? '')} onChange={(event) => updateEditField('startPlace', event.target.value)} placeholder="Enter start place" aria-label="Start Place" />
              </div>
              <div className="grid items-center gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <label htmlFor="transport-route-stop-place" className="text-sm font-medium sm:text-right">Stop Place <span className="text-rose-500">*</span></label>
                <Input id="transport-route-stop-place" value={String(edit.stopPlace ?? '')} onChange={(event) => updateEditField('stopPlace', event.target.value)} placeholder="Enter stop place" aria-label="Stop Place" />
              </div>
              <div className="grid items-start gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <label htmlFor="transport-route-remarks" className="pt-2 text-sm font-medium sm:text-right">Remarks</label>
                <Textarea id="transport-route-remarks" rows={2} value={String(edit.remarks ?? '')} onChange={(event) => updateEditField('remarks', event.target.value)} placeholder="Enter remarks (optional)" aria-label="Remarks" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Route Stoppages</h4>
                <p className="text-xs text-mist">Add each stop in route order.</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '8%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line bg-black/[0.02] text-left text-[9px] font-bold uppercase tracking-wide text-mist dark:bg-white/[0.03] sm:text-[10px] sm:tracking-wider">
                      <th className="px-1 py-2.5 sm:px-2">Stoppage <span className="text-rose-500">*</span></th>
                      <th className="px-1 py-2.5 sm:px-2">Stop Time <span className="text-rose-500">*</span></th>
                      <th className="px-1 py-2.5 sm:px-2">Distance</th>
                      <th className="px-1 py-2.5 sm:px-2">Route Fare <span className="text-rose-500">*</span></th>
                      <th className="px-1 py-2.5 sm:px-2">Latitude</th>
                      <th className="px-1 py-2.5 sm:px-2">Longitude</th>
                      <th className="px-1 py-2.5 sm:px-2" aria-label="Remove stop"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableRouteStops.map((stop, index) => (
                      <tr key={`${edit.id}-route-stop-${index}`} className="border-b border-line/60 last:border-0">
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <Input
                            className="min-w-0 !px-1.5 sm:!px-2"
                            value={stop.stoppageName}
                            onChange={(event) => updateRouteStop(index, { stoppageName: event.target.value })}
                            placeholder="Enter pickup point"
                            list="transport-route-stoppage-suggestions"
                            aria-label={`Stoppage ${index + 1}`}
                          />
                        </td>
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <TimePicker className="min-w-0" value={stop.stopTime} onChange={(value) => updateRouteStop(index, { stopTime: value })} placeholder="Time" displayFormat="12h" required aria-label={`Stop Time ${index + 1}`} />
                        </td>
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <Input className="min-w-0 !px-1.5 sm:!px-2" type="number" min={0} step="0.01" value={stop.distance} onChange={(event) => updateRouteStop(index, { distance: event.target.value })} placeholder="0.00" aria-label={`Distance ${index + 1}`} />
                        </td>
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <Input className="min-w-0 !px-1.5 sm:!px-2" type="number" min={0} step="0.01" value={stop.routeFare} onChange={(event) => updateRouteStop(index, { routeFare: event.target.value })} placeholder="0.00" required aria-label={`Route Fare ${index + 1}`} />
                        </td>
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <Input className="min-w-0 !px-1.5 sm:!px-2" value={stop.latitude} onChange={(event) => updateRouteStop(index, { latitude: event.target.value })} placeholder="5.6037" inputMode="decimal" aria-label={`Latitude ${index + 1}`} />
                        </td>
                        <td className="min-w-0 px-1 py-2 sm:px-2">
                          <Input className="min-w-0 !px-1.5 sm:!px-2" value={stop.longitude} onChange={(event) => updateRouteStop(index, { longitude: event.target.value })} placeholder="-0.1870" inputMode="decimal" aria-label={`Longitude ${index + 1}`} />
                        </td>
                        <td className="px-0 py-2 text-center sm:px-2">
                          {editableRouteStops.length > 1 && (
                            <button type="button" onClick={() => removeRouteStop(index)} aria-label={`Remove stoppage ${index + 1}`} title="Remove stoppage" className="grid size-7 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 sm:size-8">
                              <X className="size-4" />
                            </button>
                          )}
                        </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="border-t border-line p-2">
                  <Button type="button" size="sm" variant="outline" onClick={addRouteStop}><Plus className="size-3.5" /> Add More</Button>
                </div>
              </div>
              <datalist id="transport-route-stoppage-suggestions">
                {routeStoppageSuggestions.map((name) => <option key={name} value={name} />)}
              </datalist>
              <p className="mt-2 text-xs text-mist">
                Pickup points are captured on the Route itself — type them freely (existing Stoppage names appear as suggestions) and reuse the same point on any Route or at more than one stop.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button onClick={submit}>Save</Button>
            </div>
          </div>
        ) : edit ? (
          <div className={marksheetTwoColumn
            ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start'
            : `grid gap-3 ${sideBySideTransportVehicle ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : sideBySideSpans ? 'sm:grid-cols-12' : ''}`}>
            {/* `contents` keeps the fields as direct grid items for every other
                leaf, so their existing column spans behave exactly as before. */}
            <div className={marksheetTwoColumn
              ? `grid gap-3 ${sideBySideSpans ? 'sm:grid-cols-12' : ''}`
              : 'contents'}>
            {allocationFormFields.map((f) => (
              <Field
                key={f.key}
                className={sideBySideTransportVehicle
                  ? f.key === 'note' ? 'sm:col-span-2 xl:col-span-3' : undefined
                  : sideBySideSpans ? (sideBySideSpans[f.key] ?? 'sm:col-span-12') : undefined}
                label={f.label}
                required={f.required}
                hint={fieldHintFor(f)}
              >
                {f.type === 'select' ? (
                  <Select
                    value={String(edit[f.key] ?? '')}
                    disabled={(generatedMembers && f.key === 'memberType') || (leaf.id === 'studentTransportAssignments' && (f.key === 'vehicleNo' || f.key === 'pickupPoint') && !String(edit.routeName ?? '').trim()) || (isTransportPersonnel && f.key === 'assignedVehicle' && !String(edit.assignedRoute ?? '').trim())}
                    onChange={(e) => updateEditField(f.key, e.target.value)}
                    placeholder={leaf.id === 'studentTransportAssignments' && f.key === 'vehicleNo' ? 'Select a vehicle assigned to this Route…' : leaf.id === 'studentTransportAssignments' && f.key === 'pickupPoint' ? 'Select a pickup point on this Route…' : 'Select…'}
                  >
                    {leaf.id === 'subjectList' && f.key === 'classroom' && <option value="">No classroom</option>}
                    {leaf.id === 'studentTransportAssignments' && f.key === 'vehicleNo' && (
                      <option value="">
                        {!String(edit.routeName ?? '').trim() ? 'Select a Route first' : optionsFor(f).length ? 'No vehicle selected' : 'No vehicle assigned to this Route'}
                      </option>
                    )}
                    {leaf.id === 'studentTransportAssignments' && f.key === 'pickupPoint' && (
                      <option value="">
                        {!String(edit.routeName ?? '').trim() ? 'Select a Route first' : optionsFor(f).length ? 'No pickup point selected' : 'No pickup point on this Route'}
                      </option>
                    )}
                    {isTransportPersonnel && f.key === 'assignedVehicle' && (
                      <option value="">
                        {!String(edit.assignedRoute ?? '').trim() ? 'Select a Route first' : optionsFor(f).length ? 'No vehicle selected' : 'No vehicle assigned to this Route'}
                      </option>
                    )}
                    {optionsFor(f).map((o) => (<option key={o} value={o}>{o}</option>))}
                  </Select>
                ) : f.type === 'multiselect' && f.display === 'checkboxes' ? (
                  // Every option is visible at once, so the whole set can be
                  // ticked without opening a dropdown.
                  checkboxOptionsFor(f).length ? (
                    <div className="flex flex-wrap gap-x-5 gap-y-2.5 rounded-xl border border-line p-3">
                      {checkboxOptionsFor(f).map((option) => {
                        const values = multiSelectValues(edit[f.key])
                        return (
                          <label
                            key={option}
                            className="inline-flex cursor-pointer select-none items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="size-4 flex-none accent-blue-600"
                              checked={values.includes(option)}
                              aria-label={option}
                              onChange={(event) => updateEditField(
                                f.key,
                                JSON.stringify(event.target.checked
                                  ? [...values, option]
                                  : values.filter((value) => value !== option)),
                              )}
                            />
                            <span className="min-w-0">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-line p-3 text-sm text-mist">
                      No {f.label.toLowerCase()} entries yet — add them under Mark Distribution first.
                    </p>
                  )
                ) : f.type === 'multiselect' ? (
                  <MultiSelect
                    options={optionsFor(f).map((option) => ({ value: option, label: option }))}
                    values={multiSelectValues(edit[f.key])}
                    onChange={(values) => updateEditField(f.key, JSON.stringify(values))}
                    disabled={leaf.id === 'studentHostelAllocation' && f.key === 'terms' && !String(edit.academicYear ?? '').trim()}
                    placeholder={leaf.id === 'studentHostelAllocation' && f.key === 'terms' && !String(edit.academicYear ?? '').trim()
                      ? 'Select an Academic Year / Session first'
                      : 'Select one or more…'}
                    aria-label={f.label}
                  />
                ) : f.type === 'date' && leaf.id === 'studentHostelAllocation' && f.key === 'allocationDate' ? (
                  <DatePicker value={String(edit[f.key] ?? '')} onChange={(value) => updateEditField(f.key, value)} />
                ) : f.type === 'time' ? (
                  <TimePicker
                    value={String(edit[f.key] ?? '')}
                    onChange={(value) => updateEditField(f.key, value)}
                    placeholder="Select time"
                    displayFormat="12h"
                    required={f.required}
                    aria-label={f.label}
                  />
                ) : f.type === 'textarea' && f.display === 'tokens' ? (
                  <ContentFieldWithTokens
                    value={String(edit[f.key] ?? '')}
                    ariaLabel={`${f.label} content`}
                    onChange={(next) => updateEditField(f.key, next)}
                  />
                ) : f.type === 'textarea' ? (
                  <Textarea
                    rows={leaf.id === 'transportVehicles' && f.key === 'note' ? 3 : 1}
                    value={String(edit[f.key] ?? '')}
                    onChange={(e) => updateEditField(f.key, e.target.value)}
                  />
                ) : f.type === 'image' ? (
                  <label
                    className={compactImageField(leaf.id, f)
                      ? 'flex min-h-[42px] cursor-pointer items-center justify-start gap-2 rounded-md border border-line bg-transparent px-3 py-2 text-sm text-mist transition hover:border-lime hover:text-inherit'
                      : 'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-black/[0.02] p-4 text-center text-xs text-mist transition hover:border-lime hover:text-inherit dark:bg-white/[0.03]'}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      if (file) readImage(file, f.key)
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readImage(file, f.key)
                        e.target.value = ''
                      }}
                    />
                    {String(edit[f.key] ?? '').startsWith('data:') ? (
                      <img
                        src={String(edit[f.key])}
                        alt={compactImageField(leaf.id, f) ? 'Selected file preview' : 'Cover preview'}
                        className={compactImageField(leaf.id, f) ? 'size-8 shrink-0 rounded-md object-cover' : 'h-24 w-16 rounded-md object-cover'}
                      />
                    ) : (
                      <UploadCloud className={compactImageField(leaf.id, f) ? 'size-4 shrink-0' : 'size-6'} />
                    )}
                    <span>{String(edit[f.key] ?? '')
                      ? (compactImageField(leaf.id, f) ? 'Change file' : 'Click or drop a file to replace')
                      : (compactImageField(leaf.id, f) ? 'Select file' : 'Drag and drop a file here or click')}</span>
                  </label>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={String(edit[f.key] ?? '')}
                    placeholder={leaf.id === 'classList' && f.key === 'short' ? 'e.g. G1A' : undefined}
                    onChange={(e) => updateEditField(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
            </div>
            {leaf.id === 'marksheetTemplate' && (
              <div className="lg:sticky lg:top-0">
                <MarksheetPreview
                  templateName={String(edit.templateName ?? '')}
                  pageLayout={String(edit.pageLayout ?? '')}
                  backgroundImage={String(edit.backgroundImage ?? '')}
                  schoolName={String(branchName ?? 'School')}
                  photoStyle={String(edit.photoStyle ?? '')}
                  topSpace={String(edit.topSpace ?? '')}
                  bottomSpace={String(edit.bottomSpace ?? '')}
                  rightSpace={String(edit.rightSpace ?? '')}
                  leftSpace={String(edit.leftSpace ?? '')}
                  headerContent={String(edit.headerContent ?? '')}
                  middleContent={String((edit as any).middleContent ?? '')}
                  footerContent={String(edit.footerContent ?? '')}
                  headerAlignments={String((edit as any).headerAlignments ?? '')}
                  middleAlignments={String((edit as any).middleAlignments ?? '')}
                  footerAlignments={String((edit as any).footerAlignments ?? '')}
                  reportOptions={String(edit.reportOptions ?? '')}
                  parts={examComponents}
                  examName={String(edit.examName ?? '')}
                  logoImage={String(edit.logoImage ?? '')}
                  leftSignature={String(edit.leftSignature ?? '')}
                  middleSignature={String(edit.middleSignature ?? '')}
                  rightSignature={String(edit.rightSignature ?? '')}
                  showHeader={edit.headerContent == null ? true : String(edit.headerContent).trim() !== ''}
                  showMiddle={(edit as any).middleContent == null ? true : String((edit as any).middleContent).trim() !== ''}
                  showFooter={edit.footerContent == null ? true : String(edit.footerContent).trim() !== ''}
                />
              </div>
            )}
            <div className={`flex gap-2 ${marksheetTwoColumn
              // Pinned to the foot of the dialog: this form is tall enough to
              // scroll, and Save must never sit below the fold.
              ? 'sticky bottom-0 z-10 -mb-4 rounded-b-xl border-t border-line bg-white px-1 pb-4 pt-3 dark:bg-[#141416] lg:col-span-2'
              : sideBySideTransportVehicle ? 'sm:col-span-2 xl:col-span-3' : sideBySideSpans ? 'sm:col-span-12' : ''}`}>
              <Button className="flex-1" onClick={submit}>Save</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${recordLabel}?`}>
        {del && (
          <>
            <p className="text-sm text-mist">
              Delete <span className="font-semibold text-inherit">{String(del[leaf.fields[0].key] || 'this record')}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => {
                        if (generatedMembers) {
                          saveMemberStore(membershipOverrides, externalRows.filter((r) => r.id !== del.id))
                        } else if (isTransportFees) {
                          persistLeaves({
                            [leaf.id]: rows.filter((r) => r.id !== del.id),
                            transportFeeHistory: [feeHistoryEntry({
                              feeRef: transportFeeLabel(del),
                              action: 'Deleted',
                              previousValue: String(del.amount ?? '').trim(),
                              amountBefore: String(del.amount ?? '').trim(),
                              remarks: `${String(del.academicYear ?? '').trim()} · ${String(del.status ?? '').trim()}`,
                            }), ...(records.transportFeeHistory ?? [])],
                          })
                        } else if (isTransportFeeAdjustments) {
                          persistLeaves({
                            [leaf.id]: rows.filter((r) => r.id !== del.id),
                            transportFeeHistory: [feeHistoryEntry({
                              feeRef: `${String(del.student ?? '').trim()} · ${String(del.adjustmentType ?? '').trim()}`,
                              action: 'Deleted',
                              previousValue: String(del.status ?? '').trim(),
                              amountBefore: String(del.value ?? '').trim(),
                              remarks: String(del.reason ?? '').trim(),
                            }), ...(records.transportFeeHistory ?? [])],
                          })
                        } else if (isTransportPersonnel && (String(del.assignedRoute ?? '').trim() || String(del.assignedVehicle ?? '').trim())) {
                          const unassigned: EduRow = {
                            id: uid(),
                            date: todayISO(),
                            personnelName: String(del.fullName ?? '').trim(),
                            employeeId: String(del.employeeId ?? '').trim(),
                            role: String(del.role ?? '').trim(),
                            previousRoute: String(del.assignedRoute ?? '').trim(),
                            previousVehicle: String(del.assignedVehicle ?? '').trim(),
                            assignedRoute: '',
                            assignedVehicle: '',
                            action: 'Unassigned',
                            remarks: 'Record removed from Drivers & Attendants',
                          }
                          persistLeaves({
                            [leaf.id]: rows.filter((r) => r.id !== del.id),
                            transportPersonnelHistory: [unassigned, ...(records.transportPersonnelHistory ?? [])],
                          })
                        } else {
                          persist(rows.filter((r) => r.id !== del.id))
                        }
                        toast.success('Record deleted')
                        setDel(null)
                      }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

/** Route wrapper: resolves group/leaf from the URL (Education Management pages). */
export function EduModulePage() {
  const { group: groupId, leaf: leafId } = useParams()
  const { t } = useI18n()
  const group = GROUPS.find((g) => g.path === groupId)
  const leaf = group?.leaves.find((l) => l.path === leafId)
  if (!group || !leaf) {
    // The transport Allocation Report moved into Transport Reports — old links
    // land on the reports page instead of a dead end.
    if (group?.id === 'transport' && leafId === 'allocation-report') return <EduTransportReportsPage />
    // Card Management is now its own top-level module serving students, staff
    // and members alike — any old education link lands there.
    if (leafId?.startsWith('id-card-')) {
      return <Navigate to={`/admin/card-management/${leafId}`} replace />
    }
    return <Empty title="Section not found" desc="This Education Management section does not exist." />
  }
  if (leaf.id === 'assignClassSubjects') return <EduAssignClassSubjectsPage />
  if (leaf.id === 'transportGpsTracking') return (
    <Suspense fallback={<div className="p-6 text-sm text-mist">Loading map…</div>}>
      <EduGpsTrackingPage />
    </Suspense>
  )
  if (leaf.id === 'transportReports') return <EduTransportReportsPage />
  if (leaf.id === 'wardenDirectory') return <EduWardensPage />
  if (leaf.id === 'studentHostelAllocationReport' || group.id === 'eduReports') return <EduReportsPage group={group} leaf={leaf} />
  return <EduLeafCrud group={group} leaf={leaf} crumb={['Education Management', t(group.key)]} />
}