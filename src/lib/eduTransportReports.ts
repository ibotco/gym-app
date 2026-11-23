/**
 * Transport Reports — one engine that turns the existing transport, billing,
 * attendance, maintenance and GPS records into nine operational and financial
 * reports. Every report returns the same shape (columns / rows / metrics) so a
 * single page can render them and one exporter can write them out.
 */
import { haversineKm } from './eduGps'
import type { EduRecords, EduRow } from './eduRecords'

/* ------------------------------------------------------------------ types */

export const TRANSPORT_REPORT_IDS = [
  'studentAllocation',
  'studentTransportLists',
  'routeUtilization',
  'vehicleOccupancy',
  'driverAssignments',
  'feeCollection',
  'feeArrears',
  'attendance',
  'vehicleMaintenance',
  'gpsActivity',
] as const

export type TransportReportId = (typeof TRANSPORT_REPORT_IDS)[number]

export type TransportReportFilters = {
  academicYear: string
  term: string
  routeName: string
  vehicleNo: string
  driver: string
  student: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_TRANSPORT_REPORT_FILTERS: TransportReportFilters = {
  academicYear: '',
  term: '',
  routeName: '',
  vehicleNo: '',
  driver: '',
  student: '',
  dateFrom: '',
  dateTo: '',
}

export type TransportFilterKey = keyof TransportReportFilters

export type TransportReportColumn = {
  key: string
  label: string
  numeric?: boolean
  /** Render with the currency format; exported as a plain number. */
  money?: boolean
  /** Highlight good / warning / bad values in the table. */
  tone?: 'ok' | 'warn' | 'bad'
}

export type TransportReportRow = { id: string } & Record<string, string | number>

export type TransportReportMetric = { label: string; value: string; hint?: string }

export type TransportReport = {
  id: TransportReportId
  label: string
  title: string
  subtitle: string
  description: string
  columns: TransportReportColumn[]
  rows: TransportReportRow[]
  metrics: TransportReportMetric[]
  emptyTitle: string
  emptyDescription: string
}

export type TransportReportDefinition = {
  id: TransportReportId
  label: string
  description: string
  category: 'Operational' | 'Financial' | 'Compliance'
  /** Filters that actually slice this report's data. */
  filters: TransportFilterKey[]
}

export const TRANSPORT_REPORTS: TransportReportDefinition[] = [
  {
    id: 'studentAllocation',
    label: 'Allocation Report',
    description: 'The student transport allocation ledger as recorded — every allocation, active or inactive, with route, vehicle, pickup point and fee.',
    category: 'Operational',
    filters: ['routeName', 'vehicleNo', 'student'],
  },
  {
    id: 'studentTransportLists',
    label: 'Student Transport Lists',
    description: 'Every student booked on a route, with their stoppage, vehicle, guardian contact and term fee.',
    category: 'Operational',
    filters: ['routeName', 'vehicleNo', 'student'],
  },
  {
    id: 'routeUtilization',
    label: 'Route Utilization',
    description: 'Seats against students per route: how full each route runs and where spare capacity sits.',
    category: 'Operational',
    filters: ['routeName', 'vehicleNo'],
  },
  {
    id: 'vehicleOccupancy',
    label: 'Vehicle Occupancy',
    description: 'Load per vehicle against its seating capacity, with the routes and driver it serves.',
    category: 'Operational',
    filters: ['routeName', 'vehicleNo'],
  },
  {
    id: 'driverAssignments',
    label: 'Driver Assignment',
    description: 'Drivers and attendants with their route, vehicle, licence validity and students carried.',
    category: 'Operational',
    filters: ['routeName', 'vehicleNo', 'driver'],
  },
  {
    id: 'feeCollection',
    label: 'Transport Fee Collection',
    description: 'Billed versus collected transport fees per student and term, from posted Student Billing records.',
    category: 'Financial',
    filters: ['academicYear', 'term', 'routeName', 'student', 'dateFrom', 'dateTo'],
  },
  {
    id: 'feeArrears',
    label: 'Transport Fee Arrears',
    description: 'Students owing transport fees, how much, for which terms and how long the debt has been open.',
    category: 'Financial',
    filters: ['academicYear', 'term', 'routeName', 'student', 'dateFrom', 'dateTo'],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Trip attendance per student: pick-ups, drop-offs, absences, late pick-ups and exceptions.',
    category: 'Compliance',
    filters: ['routeName', 'vehicleNo', 'student', 'dateFrom', 'dateTo'],
  },
  {
    id: 'vehicleMaintenance',
    label: 'Vehicle Maintenance',
    description: 'Service and repair history with cost, downtime and what is due or overdue next.',
    category: 'Compliance',
    filters: ['vehicleNo', 'dateFrom', 'dateTo'],
  },
  {
    id: 'gpsActivity',
    label: 'GPS Activity',
    description: 'Tracking activity per vehicle: pings, distance covered, speeds, stops and alerts raised.',
    category: 'Compliance',
    filters: ['routeName', 'vehicleNo', 'dateFrom', 'dateTo'],
  },
]

/* ---------------------------------------------------------------- helpers */

export const text = (value: unknown) => String(value ?? '').trim()
const num = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}
const round2 = (value: number) => Math.round(value * 100) / 100
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0)
const listValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))]
  const raw = text(value)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map(text).filter(Boolean))]
  } catch { /* legacy single value */ }
  return [raw]
}
const listText = (value: unknown) => listValues(value).join(', ')

const inRange = (date: string, from: string, to: string) => {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}
const daysBetween = (from: string, to: string) => {
  if (!from || !to) return 0
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}
const todayIso = () => new Date().toISOString().slice(0, 10)
const moneyValue = (value: number) => round2(value)
const ghs = (value: number) => `GHS ${moneyValue(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const countLabel = (value: number, singular: string) => `${value.toLocaleString()} ${value === 1 ? singular : `${singular}s`}`

type StudentInfo = { className: string; guardian: string; phone: string; admissionNo: string; rollNo: string }

const studentIndex = (records: EduRecords) => {
  const map = new Map<string, StudentInfo>()
  for (const row of records.studentList ?? []) {
    map.set(text(row.name).toLowerCase(), {
      className: text(row.className),
      guardian: text(row.guardian),
      phone: text(row.phone),
      admissionNo: text(row.admissionNo),
      rollNo: text(row.rollNo),
    })
  }
  return map
}
const studentInfo = (index: Map<string, StudentInfo>, name: string): StudentInfo =>
  index.get(name.toLowerCase()) ?? { className: '', guardian: '', phone: '', admissionNo: '', rollNo: '' }

const routeIndex = (records: EduRecords) => {
  const map = new Map<string, EduRow>()
  for (const row of records.transportRoutes ?? []) map.set(text(row.routeName).toLowerCase(), row)
  return map
}
const vehicleIndex = (records: EduRecords) => {
  const map = new Map<string, EduRow>()
  for (const row of records.transportVehicles ?? []) map.set(text(row.vehicleNo).toLowerCase(), row)
  return map
}

/** routeName (lower) → vehicle numbers, from the route→vehicle assignments. */
const vehiclesByRoute = (records: EduRecords) => {
  const map = new Map<string, string[]>()
  for (const row of records.transportVehicleAssignments ?? []) {
    if (text(row.status) === 'Inactive') continue
    const route = text(row.routeName)
    if (!route) continue
    const key = route.toLowerCase()
    const next = map.get(key) ?? []
    for (const vehicle of listValues(row.vehicleNo)) {
      if (!next.some((v) => v.toLowerCase() === vehicle.toLowerCase())) next.push(vehicle)
    }
    map.set(key, next)
  }
  return map
}

/** vehicleNo (lower) → route names, the inverse of the map above. */
const routesByVehicle = (records: EduRecords) => {
  const map = new Map<string, string[]>()
  for (const [route, vehicles] of vehiclesByRoute(records)) {
    for (const vehicle of vehicles) {
      const key = vehicle.toLowerCase()
      const next = map.get(key) ?? []
      if (!next.some((r) => r.toLowerCase() === route)) next.push(route)
      map.set(key, next)
    }
  }
  return map
}

/** Number of stoppages configured on a route (routeStops JSON wins, legacy pickupPoints otherwise). */
const stopCount = (row: EduRow | undefined) => {
  if (!row) return 0
  // routeStops holds objects ({ stoppageName, stopTime, … }); count the entries,
  // not the stringified values.
  const raw = text(row.routeStops)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const names = parsed
          .map((item) => (typeof item === 'string' ? text(item) : text((item as EduRow)?.stoppageName)))
          .filter(Boolean)
        if (names.length) return names.length
      }
    } catch { /* fall through to the legacy field */ }
  }
  return listValues(row.pickupPoints).length
}

const activeAssignment = (row: EduRow) => text(row.status) !== 'Inactive'

/** Student transport assignments narrowed by the shared route / vehicle / student filters. */
const assignmentsFor = (records: EduRecords, filters: TransportReportFilters) => {
  const route = filters.routeName.trim().toLowerCase()
  const vehicle = filters.vehicleNo.trim().toLowerCase()
  const student = filters.student.trim().toLowerCase()
  return (records.studentTransportAssignments ?? []).filter((row) => {
    if (route && text(row.routeName).toLowerCase() !== route) return false
    if (vehicle && text(row.vehicleNo).toLowerCase() !== vehicle) return false
    if (student && !text(row.student).toLowerCase().includes(student)) return false
    return true
  })
}

/** Transport bills posted to Student Billing, narrowed by the shared filters. */
const transportBills = (records: EduRecords, filters: TransportReportFilters) => {
  const year = filters.academicYear.trim().toLowerCase()
  const term = filters.term.trim().toLowerCase()
  const student = filters.student.trim().toLowerCase()
  const students = studentIndex(records)
  return (records.studentBilling ?? []).filter((row) => {
    const isTransport = text(row.feeType).toLowerCase() === 'transport' || text(row.reference).startsWith('TF:')
    if (!isTransport) return false
    if (year && text(row.academicYear).toLowerCase() !== year) return false
    if (term && text(row.term).toLowerCase() !== term) return false
    if (student && !text(row.student).toLowerCase().includes(student)) return false
    if (filters.routeName) {
      const onRoute = (records.studentTransportAssignments ?? []).some(
        (a) => text(a.student).toLowerCase() === text(row.student).toLowerCase() && text(a.routeName) === filters.routeName,
      )
      if (!onRoute) return false
    }
    if (!inRange(text(row.billingDate), filters.dateFrom, filters.dateTo)) return false
    return true
  }).map((row) => ({ row, info: studentInfo(students, text(row.student)) }))
}

/** A bill counts as collected only when it is marked Paid; Partial stays outstanding and is flagged. */
const collectedOf = (row: EduRow) => (text(row.status).toLowerCase() === 'paid' ? num(row.amount) : 0)
const outstandingOf = (row: EduRow) => (text(row.status).toLowerCase() === 'paid' ? 0 : num(row.amount))

const routeOfStudent = (records: EduRecords, name: string) => {
  const match = (records.studentTransportAssignments ?? []).find(
    (row) => text(row.student).toLowerCase() === name.toLowerCase(),
  )
  return match ? text(match.routeName) : '—'
}

/** Route attached to a bill, falling back to the student's current assignment. */
const billRoute = (records: EduRecords, row: EduRow) => {
  const fromRemarks = text(row.remarks)
  const assigned = routeOfStudent(records, text(row.student))
  return assigned !== '—' ? assigned : fromRemarks ? '—' : '—'
}

/* --------------------------------------------------------------- builders */


/** Record-level allocation ledger: every allocation row, including inactive ones. */
function studentAllocation(records: EduRecords, filters: TransportReportFilters) {
  const students = studentIndex(records)
  const rows = assignmentsFor(records, filters)
    .map((row) => {
      const name = text(row.student)
      const info = studentInfo(students, name)
      return {
        id: text(row.id) || `allocation-${name}-${text(row.routeName)}`,
        student: name,
        admissionNo: info.admissionNo || '—',
        className: text(row.className) || info.className || '—',
        route: text(row.routeName) || '—',
        vehicle: text(row.vehicleNo) || '—',
        pickupPoint: text(row.pickupPoint) || '—',
        fee: moneyValue(num(row.fee)),
        status: text(row.status) || 'Active',
      }
    })
    .sort((a, b) => a.route.localeCompare(b.route) || a.student.localeCompare(b.student))
  const active = rows.filter((row) => row.status.toLowerCase() !== 'inactive').length
  const feeTotal = rows.reduce((sum, row) => sum + row.fee, 0)
  return {
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'className', label: 'Class' },
      { key: 'route', label: 'Route' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'pickupPoint', label: 'Pickup point' },
      { key: 'fee', label: 'Transport fee', numeric: true, money: true },
      { key: 'status', label: 'Status', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Assignments', value: countLabel(rows.length, 'assignment') },
      { label: 'Active', value: countLabel(active, 'allocation'), hint: `${countLabel(rows.length - active, 'allocation')} inactive` },
      { label: 'Routes covered', value: countLabel(new Set(rows.map((r) => r.route)).size, 'route') },
      { label: 'Allocated fees', value: ghs(feeTotal), hint: 'Sum of the allocation fees in this selection' },
    ],
    emptyTitle: 'No student transport allocations yet',
    emptyDescription: 'Add student transport assignments under Transport → Student Assignments to populate this report.',
  }
}

function studentTransportLists(records: EduRecords, filters: TransportReportFilters) {
  const students = studentIndex(records)
  const rows = assignmentsFor(records, filters)
    .map((row) => {
      const name = text(row.student)
      const info = studentInfo(students, name)
      return {
        id: text(row.id) || `${name}-${text(row.routeName)}`,
        student: name,
        admissionNo: info.admissionNo || '—',
        className: info.className || text(row.className) || '—',
        guardian: info.guardian || '—',
        phone: info.phone || '—',
        routeName: text(row.routeName) || '—',
        pickupPoint: text(row.pickupPoint) || '—',
        vehicleNo: text(row.vehicleNo) || '—',
        fee: moneyValue(num(row.fee)),
        status: text(row.status) || 'Active',
      }
    })
    .sort((a, b) => a.routeName.localeCompare(b.routeName) || a.student.localeCompare(b.student))
  const rowsWithFees = rows.filter((row) => row.fee > 0)
  const feeTotal = rowsWithFees.reduce((sum, row) => sum + row.fee, 0)
  const avgFee = rowsWithFees.length ? feeTotal / rowsWithFees.length : 0
  return {
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'className', label: 'Class' },
      { key: 'routeName', label: 'Route' },
      { key: 'pickupPoint', label: 'Stoppage' },
      { key: 'vehicleNo', label: 'Vehicle' },
      { key: 'fee', label: 'Term fee', numeric: true, money: true },
      { key: 'guardian', label: 'Guardian' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Students listed', value: countLabel(rows.length, 'student') },
      { label: 'Routes covered', value: countLabel(new Set(rows.map((r) => r.routeName)).size, 'route') },
      { label: 'Vehicles used', value: countLabel(new Set(rows.map((r) => r.vehicleNo).filter((v) => v !== '—')).size, 'vehicle') },
      { label: 'Fees on the list', value: ghs(feeTotal), hint: `${ghs(avgFee)} average per student` },
    ],
    emptyTitle: 'No students on transport',
    emptyDescription: 'Assign students to a route under Transport → Student Assignments to populate this list.',
  }
}

function routeUtilization(records: EduRecords, filters: TransportReportFilters) {
  const vehiclesMap = vehiclesByRoute(records)
  const vehicles = vehicleIndex(records)
  const routeFilter = filters.routeName.trim().toLowerCase()
  const vehicleFilter = filters.vehicleNo.trim().toLowerCase()
  const assignments = assignmentsFor(records, filters).filter(activeAssignment)
  const counts = new Map<string, number>()
  const feeTotals = new Map<string, number>()
  for (const row of assignments) {
    const key = text(row.routeName)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
    feeTotals.set(key, (feeTotals.get(key) ?? 0) + num(row.fee))
  }
  const rows = (records.transportRoutes ?? [])
    .filter((row) => {
      const route = text(row.routeName)
      if (!route) return false
      if (routeFilter && route.toLowerCase() !== routeFilter) return false
      if (vehicleFilter && !(vehiclesMap.get(route.toLowerCase()) ?? []).some((v) => v.toLowerCase() === vehicleFilter)) return false
      return true
    })
    .map((row) => {
      const route = text(row.routeName)
      const assigned = vehiclesMap.get(route.toLowerCase()) ?? []
      const seats = assigned.reduce((sum, vehicleNo) => sum + num(vehicles.get(vehicleNo.toLowerCase())?.capacity), 0)
      const students = counts.get(route) ?? 0
      const utilization = percent(students, seats)
      const fare = num(row.fare)
      return {
        id: text(row.id) || route,
        routeName: route,
        path: [text(row.startPlace), text(row.stopPlace)].filter(Boolean).join(' → ') || '—',
        stoppages: stopCount(row),
        vehicles: assigned.length,
        vehicleList: assigned.length ? assigned.join(', ') : '—',
        seats,
        students,
        utilization,
        spare: Math.max(0, seats - students),
        termFees: moneyValue(feeTotals.get(route) ?? students * fare),
        status: text(row.status) || 'Active',
      }
    })
    .sort((a, b) => b.utilization - a.utilization)
  const seats = rows.reduce((sum, row) => sum + row.seats, 0)
  const students = rows.reduce((sum, row) => sum + row.students, 0)
  const full = rows.filter((row) => row.seats > 0 && row.students >= row.seats).length
  return {
    columns: [
      { key: 'routeName', label: 'Route' },
      { key: 'path', label: 'Start → Stop' },
      { key: 'stoppages', label: 'Stoppages', numeric: true },
      { key: 'vehicleList', label: 'Vehicles' },
      { key: 'seats', label: 'Seats', numeric: true },
      { key: 'students', label: 'Students', numeric: true },
      { key: 'spare', label: 'Spare seats', numeric: true, tone: 'ok' as const },
      { key: 'utilization', label: 'Utilization %', numeric: true, tone: 'warn' as const },
      { key: 'termFees', label: 'Fees / term', numeric: true, money: true },
      { key: 'status', label: 'Status', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Routes reported', value: countLabel(rows.length, 'route') },
      { label: 'Seats available', value: countLabel(seats, 'seat') },
      { label: 'Students assigned', value: countLabel(students, 'student') },
      { label: 'Average utilization', value: `${percent(students, seats)}%`, hint: full ? `${countLabel(full, 'route')} at or over capacity` : 'No route is full' },
    ],
    emptyTitle: 'No routes to report',
    emptyDescription: 'Add routes under Transport → Routes and assign vehicles to them.',
  }
}

function vehicleOccupancy(records: EduRecords, filters: TransportReportFilters) {
  const assignments = assignmentsFor(records, filters).filter(activeAssignment)
  const routeFilter = filters.routeName.trim().toLowerCase()
  const vehicleFilter = filters.vehicleNo.trim().toLowerCase()
  const routesMap = routesByVehicle(records)
  const counts = new Map<string, number>()
  const routeStudents = new Map<string, Set<string>>()
  for (const row of assignments) {
    const vehicle = text(row.vehicleNo)
    if (!vehicle) continue
    const key = vehicle.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const route = text(row.routeName)
    if (route) {
      const set = routeStudents.get(key) ?? new Set<string>()
      set.add(route)
      routeStudents.set(key, set)
    }
  }
  const personnel = records.transportPersonnel ?? []
  const driverFor = (vehicleNo: string) => {
    const match = personnel.find(
      (row) => text(row.role) === 'Driver' && text(row.assignedVehicle).toLowerCase() === vehicleNo.toLowerCase(),
    )
    return match ? text(match.fullName) : text(vehicleIndex(records).get(vehicleNo.toLowerCase())?.driverName) || '—'
  }
  const rows = (records.transportVehicles ?? [])
    .filter((row) => {
      const vehicle = text(row.vehicleNo)
      if (!vehicle) return false
      if (vehicleFilter && vehicle.toLowerCase() !== vehicleFilter) return false
      if (routeFilter) {
        const routes = routesMap.get(vehicle.toLowerCase()) ?? []
        if (!routes.some((route) => route.toLowerCase() === routeFilter)) return false
      }
      return true
    })
    .map((row) => {
      const vehicle = text(row.vehicleNo)
      const key = vehicle.toLowerCase()
      const capacity = num(row.capacity)
      const students = counts.get(key) ?? 0
      const routes = [...(routeStudents.get(key) ?? [])]
      return {
        id: text(row.id) || vehicle,
        vehicleNo: vehicle,
        vehicleType: text(row.vehicleType) || '—',
        vehicleCategory: text(row.vehicleCategory) || '—',
        capacity,
        students,
        occupancy: percent(students, capacity),
        spare: Math.max(0, capacity - students),
        routes: routes.length ? routes.join(', ') : '—',
        driver: driverFor(vehicle),
        status: text(row.status) || 'Active',
      }
    })
    .sort((a, b) => b.occupancy - a.occupancy)
  const capacity = rows.reduce((sum, row) => sum + row.capacity, 0)
  const students = rows.reduce((sum, row) => sum + row.students, 0)
  const over = rows.filter((row) => row.capacity > 0 && row.students > row.capacity).length
  const idle = rows.filter((row) => row.students === 0).length
  return {
    columns: [
      { key: 'vehicleNo', label: 'Vehicle' },
      { key: 'vehicleType', label: 'Model' },
      { key: 'vehicleCategory', label: 'Category' },
      { key: 'capacity', label: 'Capacity', numeric: true },
      { key: 'students', label: 'Students', numeric: true },
      { key: 'spare', label: 'Spare seats', numeric: true, tone: 'ok' as const },
      { key: 'occupancy', label: 'Occupancy %', numeric: true, tone: 'warn' as const },
      { key: 'routes', label: 'Route(s)' },
      { key: 'driver', label: 'Driver' },
      { key: 'status', label: 'Status', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Vehicles reported', value: countLabel(rows.length, 'vehicle') },
      { label: 'Total capacity', value: countLabel(capacity, 'seat') },
      { label: 'Students carried', value: countLabel(students, 'student') },
      { label: 'Average occupancy', value: `${percent(students, capacity)}%`, hint: over ? `${countLabel(over, 'vehicle')} over capacity` : idle ? `${countLabel(idle, 'vehicle')} running empty` : 'Healthy spread' },
    ],
    emptyTitle: 'No vehicles to report',
    emptyDescription: 'Add vehicles under Transport → Vehicles and assign them to routes.',
  }
}

function driverAssignments(records: EduRecords, filters: TransportReportFilters) {
  const drivers = records.transportPersonnel ?? []
  const routeFilter = filters.routeName.trim().toLowerCase()
  const vehicleFilter = filters.vehicleNo.trim().toLowerCase()
  const driverFilter = filters.driver.trim().toLowerCase()
  const assignments = (records.studentTransportAssignments ?? []).filter(activeAssignment)
  const routeLoad = new Map<string, number>()
  for (const row of assignments) {
    const route = text(row.routeName)
    if (route) routeLoad.set(route.toLowerCase(), (routeLoad.get(route.toLowerCase()) ?? 0) + 1)
  }
  const today = todayIso()
  const rows = drivers
    .filter((row) => {
      if (driverFilter && !text(row.fullName).toLowerCase().includes(driverFilter)) return false
      if (routeFilter && text(row.assignedRoute).toLowerCase() !== routeFilter) return false
      if (vehicleFilter && text(row.assignedVehicle).toLowerCase() !== vehicleFilter) return false
      return true
    })
    .map((row) => {
      const route = text(row.assignedRoute)
      const expiry = text(row.licenseExpiryDate)
      const days = expiry ? daysBetween(today, expiry) : 0
      const loaded = route ? (routeLoad.get(route.toLowerCase()) ?? 0) : 0
      return {
        id: text(row.id) || `${text(row.employeeId)}-${text(row.fullName)}`,
        employeeId: text(row.employeeId) || '—',
        fullName: text(row.fullName) || '—',
        role: text(row.role) || '—',
        phone: text(row.phoneNumber) || '—',
        licenseNumber: text(row.licenseNumber) || '—',
        licenseExpiryDate: expiry || '—',
        licenceStatus: !expiry ? 'No licence on file' : days < 0 ? 'Expired' : days <= 30 ? `Expiring in ${days} d` : 'Valid',
        assignedRoute: route || 'Unassigned',
        assignedVehicle: text(row.assignedVehicle) || '—',
        students: loaded,
        employmentStatus: text(row.employmentStatus) || '—',
      }
    })
    .sort((a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName))
  const expired = rows.filter((row) => row.licenceStatus === 'Expired' || row.licenceStatus === 'No licence on file').length
  const expiring = rows.filter((row) => row.licenceStatus.startsWith('Expiring')).length
  const unassigned = rows.filter((row) => row.assignedRoute === 'Unassigned').length
  return {
    columns: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'fullName', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'licenseNumber', label: 'Licence No' },
      { key: 'licenseExpiryDate', label: 'Licence expiry' },
      { key: 'licenceStatus', label: 'Licence status', tone: 'bad' as const },
      { key: 'assignedRoute', label: 'Route' },
      { key: 'assignedVehicle', label: 'Vehicle' },
      { key: 'students', label: 'Students', numeric: true },
      { key: 'employmentStatus', label: 'Employment', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Personnel listed', value: countLabel(rows.length, 'record') },
      { label: 'Drivers / attendants', value: `${rows.filter((r) => r.role === 'Driver').length} / ${rows.filter((r) => r.role === 'Attendant').length}` },
      { label: 'Unassigned', value: countLabel(unassigned, 'person'), hint: 'No route allocated yet' },
      { label: 'Licence alerts', value: countLabel(expired + expiring, 'alert'), hint: `${expired} expired · ${expiring} expiring within 30 days` },
    ],
    emptyTitle: 'No drivers or attendants',
    emptyDescription: 'Add drivers and attendants under Transport → Drivers & Attendants.',
  }
}

function feeCollection(records: EduRecords, filters: TransportReportFilters) {
  const bills = transportBills(records, filters)
  type Group = { student: string; className: string; academicYear: string; term: string; route: string; bills: number; billed: number; collected: number; outstanding: number; partial: number; lastBillingDate: string }
  const groups = new Map<string, Group>()
  for (const { row, info } of bills) {
    const student = text(row.student)
    const key = [student, text(row.academicYear), text(row.term)].join(' | ')
    const group = groups.get(key) ?? {
      student,
      className: text(row.className) || info.className || '—',
      academicYear: text(row.academicYear) || '—',
      term: text(row.term) || '—',
      route: billRoute(records, row),
      bills: 0,
      billed: 0,
      collected: 0,
      outstanding: 0,
      partial: 0,
      lastBillingDate: '',
    }
    group.bills += 1
    group.billed += num(row.amount)
    group.collected += collectedOf(row)
    group.outstanding += outstandingOf(row)
    if (text(row.status).toLowerCase() === 'partial') group.partial += 1
    const date = text(row.billingDate)
    if (date && date > group.lastBillingDate) group.lastBillingDate = date
    groups.set(key, group)
  }
  const rows = [...groups.values()]
    .map((group) => ({
      id: `${group.student}-${group.academicYear}-${group.term}`,
      student: group.student,
      className: group.className,
      routeName: group.route,
      academicYear: group.academicYear,
      term: group.term,
      bills: group.bills,
      billed: moneyValue(group.billed),
      collected: moneyValue(group.collected),
      outstanding: moneyValue(group.outstanding),
      collectionRate: percent(group.collected, group.billed),
      status: group.outstanding <= 0 ? 'Settled' : group.collected > 0 || group.partial ? 'Partial' : 'Unpaid',
      lastBillingDate: group.lastBillingDate || '—',
    }))
    .sort((a, b) => b.outstanding - a.outstanding || a.student.localeCompare(b.student))
  const billed = rows.reduce((sum, row) => sum + row.billed, 0)
  const collected = rows.reduce((sum, row) => sum + row.collected, 0)
  const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0)
  return {
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'className', label: 'Class' },
      { key: 'routeName', label: 'Route' },
      { key: 'academicYear', label: 'Academic year' },
      { key: 'term', label: 'Term' },
      { key: 'bills', label: 'Bills', numeric: true },
      { key: 'billed', label: 'Billed', numeric: true, money: true },
      { key: 'collected', label: 'Collected', numeric: true, money: true, tone: 'ok' as const },
      { key: 'outstanding', label: 'Outstanding', numeric: true, money: true, tone: 'bad' as const },
      { key: 'collectionRate', label: 'Collected %', numeric: true },
      { key: 'status', label: 'Status', tone: 'warn' as const },
      { key: 'lastBillingDate', label: 'Last billing' },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Students billed', value: countLabel(new Set(rows.map((r) => r.student)).size, 'student') },
      { label: 'Total billed', value: ghs(billed) },
      { label: 'Collected', value: ghs(collected) },
      { label: 'Collection rate', value: `${percent(collected, billed)}%`, hint: `${ghs(outstanding)} still outstanding` },
    ],
    emptyTitle: 'No transport fees billed',
    emptyDescription: 'Approve a transport fee and post it to Student Billing to see collections here.',
  }
}

function feeArrears(records: EduRecords, filters: TransportReportFilters) {
  const bills = transportBills(records, filters)
  const today = todayIso()
  type Debtor = {
    student: string
    className: string
    guardian: string
    phone: string
    route: string
    terms: Set<string>
    outstanding: number
    oldest: string
    latest: string
    status: string
  }
  const debtors = new Map<string, Debtor>()
  for (const { row, info } of bills) {
    const owed = outstandingOf(row)
    if (owed <= 0) continue
    const student = text(row.student)
    const debtor = debtors.get(student.toLowerCase()) ?? {
      student,
      className: text(row.className) || info.className || '—',
      guardian: info.guardian || '—',
      phone: info.phone || '—',
      route: billRoute(records, row),
      terms: new Set<string>(),
      outstanding: 0,
      oldest: '',
      latest: '',
      status: 'Unpaid',
    }
    debtor.outstanding += owed
    const termLabel = [text(row.academicYear), text(row.term)].filter(Boolean).join(' · ')
    if (termLabel) debtor.terms.add(termLabel)
    const date = text(row.billingDate)
    if (date) {
      if (!debtor.oldest || date < debtor.oldest) debtor.oldest = date
      if (date > debtor.latest) debtor.latest = date
    }
    if (text(row.status).toLowerCase() === 'partial') debtor.status = 'Partial'
    debtors.set(student.toLowerCase(), debtor)
  }
  const rows = [...debtors.values()]
    .map((debtor) => {
      const days = debtor.oldest ? daysBetween(debtor.oldest, today) : 0
      const bucket = days >= 90 ? '90+ days' : days >= 60 ? '60–89 days' : days >= 30 ? '30–59 days' : 'Under 30 days'
      return {
        id: debtor.student,
        student: debtor.student,
        className: debtor.className,
        routeName: debtor.route,
        guardian: debtor.guardian,
        phone: debtor.phone,
        terms: debtor.terms.size ? [...debtor.terms].sort().join(', ') : '—',
        outstanding: moneyValue(debtor.outstanding),
        oldest: debtor.oldest || '—',
        daysOverdue: days,
        bucket,
        status: debtor.status,
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding)
  const total = rows.reduce((sum, row) => sum + row.outstanding, 0)
  const oldest = rows.reduce((max, row) => Math.max(max, row.daysOverdue), 0)
  const chronic = rows.filter((row) => row.daysOverdue >= 60).length
  return {
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'className', label: 'Class' },
      { key: 'routeName', label: 'Route' },
      { key: 'guardian', label: 'Guardian' },
      { key: 'phone', label: 'Phone' },
      { key: 'terms', label: 'Terms owed' },
      { key: 'outstanding', label: 'Outstanding', numeric: true, money: true, tone: 'bad' as const },
      { key: 'oldest', label: 'Oldest bill' },
      { key: 'daysOverdue', label: 'Days overdue', numeric: true, tone: 'warn' as const },
      { key: 'bucket', label: 'Ageing', tone: 'warn' as const },
      { key: 'status', label: 'Status' },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Students in arrears', value: countLabel(rows.length, 'student') },
      { label: 'Total outstanding', value: ghs(total), hint: rows.length ? `${ghs(total / rows.length)} average per student` : 'Nothing owed' },
      { label: 'Oldest debt', value: oldest ? countLabel(oldest, 'day') : '—' },
      { label: 'Over 60 days', value: countLabel(chronic, 'student'), hint: chronic ? 'Chase these first' : 'No long-standing debt' },
    ],
    emptyTitle: 'No transport arrears',
    emptyDescription: 'Every posted transport bill in this selection is settled.',
  }
}

function attendanceReport(records: EduRecords, filters: TransportReportFilters) {
  const route = filters.routeName.trim().toLowerCase()
  const vehicle = filters.vehicleNo.trim().toLowerCase()
  const studentFilter = filters.student.trim().toLowerCase()
  const rowsFiltered = (records.transportAttendance ?? []).filter((row) => {
    if (!inRange(text(row.date), filters.dateFrom, filters.dateTo)) return false
    if (route && text(row.routeName).toLowerCase() !== route) return false
    if (vehicle && text(row.vehicleNo).toLowerCase() !== vehicle) return false
    if (studentFilter && !text(row.student).toLowerCase().includes(studentFilter)) return false
    return true
  })
  const students = studentIndex(records)
  type Roll = { student: string; className: string; route: string; vehicle: string; trips: number; pickedUp: number; droppedOff: number; absent: number; late: number; exception: number; last: string }
  const rolls = new Map<string, Roll>()
  for (const row of rowsFiltered) {
    const student = text(row.student)
    if (!student) continue
    const key = student.toLowerCase()
    const roll = rolls.get(key) ?? {
      student,
      className: text(row.className) || studentInfo(students, student).className || '—',
      route: text(row.routeName) || '—',
      vehicle: text(row.vehicleNo) || '—',
      trips: 0,
      pickedUp: 0,
      droppedOff: 0,
      absent: 0,
      late: 0,
      exception: 0,
      last: '',
    }
    roll.trips += 1
    const status = text(row.status).toLowerCase()
    if (status.includes('late')) roll.late += 1
    else if (status.includes('absent')) roll.absent += 1
    else if (status.includes('dropped')) roll.droppedOff += 1
    else if (status.includes('picked')) roll.pickedUp += 1
    else if (status.includes('exception')) roll.exception += 1
    const date = text(row.date)
    if (date > roll.last) roll.last = date
    rolls.set(key, roll)
  }
  const rows = [...rolls.values()]
    .map((roll) => ({
      id: roll.student,
      student: roll.student,
      className: roll.className,
      routeName: roll.route,
      vehicleNo: roll.vehicle,
      trips: roll.trips,
      pickedUp: roll.pickedUp,
      droppedOff: roll.droppedOff,
      absent: roll.absent,
      late: roll.late,
      exception: roll.exception,
      attendanceRate: percent(roll.trips - roll.absent, roll.trips),
      lastActivity: roll.last || '—',
    }))
    .sort((a, b) => b.absent - a.absent || a.student.localeCompare(b.student))
  const trips = rows.reduce((sum, row) => sum + row.trips, 0)
  const absent = rows.reduce((sum, row) => sum + row.absent, 0)
  const late = rows.reduce((sum, row) => sum + row.late, 0)
  const exceptions = rows.reduce((sum, row) => sum + row.exception, 0)
  return {
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'className', label: 'Class' },
      { key: 'routeName', label: 'Route' },
      { key: 'vehicleNo', label: 'Vehicle' },
      { key: 'trips', label: 'Trips', numeric: true },
      { key: 'pickedUp', label: 'Picked up', numeric: true, tone: 'ok' as const },
      { key: 'droppedOff', label: 'Dropped off', numeric: true },
      { key: 'late', label: 'Late', numeric: true, tone: 'warn' as const },
      { key: 'absent', label: 'Absent', numeric: true, tone: 'bad' as const },
      { key: 'exception', label: 'Exceptions', numeric: true, tone: 'warn' as const },
      { key: 'attendanceRate', label: 'Attendance %', numeric: true },
      { key: 'lastActivity', label: 'Last activity' },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Trip records', value: countLabel(trips, 'trip') },
      { label: 'Students covered', value: countLabel(rows.length, 'student') },
      { label: 'Absences', value: countLabel(absent, 'absence'), hint: `${countLabel(late, 'late pick-up')} · ${countLabel(exceptions, 'exception')}` },
      { label: 'Attendance rate', value: `${percent(trips - absent, trips)}%` },
    ],
    emptyTitle: 'No attendance recorded',
    emptyDescription: 'Record trips under Transport → Daily Attendance to build this report.',
  }
}

function vehicleMaintenance(records: EduRecords, filters: TransportReportFilters) {
  const vehicleFilter = filters.vehicleNo.trim().toLowerCase()
  const vehicle = vehicleIndex(records)
  const rows = (records.transportVehicleMaintenance ?? [])
    .filter((row) => {
      if (vehicleFilter && text(row.vehicleNo).toLowerCase() !== vehicleFilter) return false
      if (!inRange(text(row.date), filters.dateFrom, filters.dateTo)) return false
      return true
    })
    .map((row) => {
      const vehicleNo = text(row.vehicleNo)
      const next = text(row.nextServiceDate)
      const days = next ? daysBetween(todayIso(), next) : 0
      return {
        id: text(row.id) || `${vehicleNo}-${text(row.date)}`,
        date: text(row.date) || '—',
        vehicleNo: vehicleNo || '—',
        vehicleType: text(vehicle.get(vehicleNo.toLowerCase())?.vehicleType) || '—',
        serviceType: text(row.serviceType) || '—',
        description: text(row.description) || '—',
        garage: text(row.garage) || '—',
        odometerKm: num(row.odometerKm),
        downtimeDays: num(row.downtimeDays),
        cost: moneyValue(num(row.cost)),
        performedBy: text(row.performedBy) || '—',
        nextServiceDate: next || '—',
        nextServiceDue: !next ? '—' : days < 0 ? `Overdue by ${Math.abs(days)} d` : days <= 14 ? `Due in ${days} d` : 'Scheduled',
        status: text(row.status) || 'Completed',
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  const cost = rows.reduce((sum, row) => sum + row.cost, 0)
  const downtime = rows.reduce((sum, row) => sum + row.downtimeDays, 0)
  const serviced = new Set(rows.map((row) => row.vehicleNo)).size
  // A vehicle's next service is its earliest upcoming date — a pending inspection
  // due in a fortnight matters more than the annual service booked for January.
  const latest = new Map<string, string>()
  for (const row of rows) {
    if (!row.nextServiceDate || row.nextServiceDate === '—') continue
    const key = String(row.vehicleNo).toLowerCase()
    const current = latest.get(key)
    if (!current || row.nextServiceDate < current) latest.set(key, row.nextServiceDate)
  }
  const overdue = [...latest.values()].filter((date) => date < todayIso()).length
  const dueSoon = [...latest.values()].filter((date) => {
    const days = daysBetween(todayIso(), date)
    return days >= 0 && days <= 14
  }).length
  const inShop = (records.transportVehicles ?? []).filter((row) => text(row.status) === 'Maintenance').length
  return {
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'vehicleNo', label: 'Vehicle' },
      { key: 'vehicleType', label: 'Model' },
      { key: 'serviceType', label: 'Service type' },
      { key: 'description', label: 'Description' },
      { key: 'garage', label: 'Garage / vendor' },
      { key: 'odometerKm', label: 'Odometer (km)', numeric: true },
      { key: 'downtimeDays', label: 'Downtime (days)', numeric: true, tone: 'warn' as const },
      { key: 'cost', label: 'Cost', numeric: true, money: true },
      { key: 'performedBy', label: 'Performed by' },
      { key: 'nextServiceDate', label: 'Next service' },
      { key: 'nextServiceDue', label: 'Next service status', tone: 'bad' as const },
      { key: 'status', label: 'Status', tone: 'ok' as const },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Service records', value: countLabel(rows.length, 'record'), hint: `${countLabel(serviced, 'vehicle')} serviced` },
      { label: 'Maintenance spend', value: ghs(cost), hint: rows.length ? `${ghs(cost / rows.length)} average per service` : 'No spend yet' },
      { label: 'Downtime', value: countLabel(downtime, 'day'), hint: `${countLabel(inShop, 'vehicle')} currently in the workshop` },
      { label: 'Service due', value: countLabel(overdue + dueSoon, 'vehicle'), hint: `${overdue} overdue · ${dueSoon} due within 14 days` },
    ],
    emptyTitle: 'No maintenance records',
    emptyDescription: 'Log services and repairs under Transport → Vehicle Maintenance.',
  }
}

function gpsActivity(records: EduRecords, filters: TransportReportFilters) {
  const vehicleFilter = filters.vehicleNo.trim().toLowerCase()
  const routeFilter = filters.routeName.trim().toLowerCase()
  type Track = {
    vehicleNo: string
    route: string
    days: Set<string>
    pings: number
    distanceKm: number
    speedSum: number
    speedMax: number
    stops: Set<string>
    alerts: number
    openAlerts: number
    lastDate: string
    lastTime: string
  }
  const tracks = new Map<string, Track>()
  const pingsByVehicle = new Map<string, { date: string; time: string; lat: number; lng: number; speed: number }[]>()
  for (const row of records.transportGpsLogs ?? []) {
    const vehicle = text(row.vehicleNo)
    if (!vehicle) continue
    const date = text(row.date)
    if (!inRange(date, filters.dateFrom, filters.dateTo)) continue
    if (vehicleFilter && vehicle.toLowerCase() !== vehicleFilter) continue
    if (routeFilter && text(row.routeName).toLowerCase() !== routeFilter) continue
    const key = vehicle.toLowerCase()
    const track = tracks.get(key) ?? {
      vehicleNo: vehicle,
      route: text(row.routeName) || '—',
      days: new Set<string>(),
      pings: 0,
      distanceKm: 0,
      speedSum: 0,
      speedMax: 0,
      stops: new Set<string>(),
      alerts: 0,
      openAlerts: 0,
      lastDate: '',
      lastTime: '',
    }
    track.pings += 1
    if (date) track.days.add(date)
    const speed = num(row.speedKmh)
    track.speedSum += speed
    if (speed > track.speedMax) track.speedMax = speed
    const stop = text(row.stopName)
    if (stop && text(row.event).toLowerCase().includes('stop')) track.stops.add(stop)
    if (`${date} ${text(row.time)}` > `${track.lastDate} ${track.lastTime}`) {
      track.lastDate = date
      track.lastTime = text(row.time)
    }
    tracks.set(key, track)
    const lat = num(row.latitude)
    const lng = num(row.longitude)
    if (lat && lng) {
      const list = pingsByVehicle.get(key) ?? []
      list.push({ date, time: text(row.time), lat, lng, speed })
      pingsByVehicle.set(key, list)
    }
  }
  for (const [key, list] of pingsByVehicle) {
    const track = tracks.get(key)
    if (!track) continue
    const ordered = [...list].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    let distance = 0
    for (let index = 1; index < ordered.length; index += 1) {
      distance += haversineKm(
        { lat: ordered[index - 1].lat, lng: ordered[index - 1].lng },
        { lat: ordered[index].lat, lng: ordered[index].lng },
      )
    }
    track.distanceKm = distance
  }
  for (const row of records.transportGpsAlerts ?? []) {
    const vehicle = text(row.vehicleNo)
    if (!vehicle) continue
    if (!inRange(text(row.date), filters.dateFrom, filters.dateTo)) continue
    if (vehicleFilter && vehicle.toLowerCase() !== vehicleFilter) continue
    const key = vehicle.toLowerCase()
    let track = tracks.get(key)
    if (!track) {
      // A vehicle can raise alerts (manual report, offline device) without ever
      // logging a ping — still worth a line in the activity report.
      if (routeFilter) continue
      track = {
        vehicleNo: vehicle,
        route: '—',
        days: new Set<string>(),
        pings: 0,
        distanceKm: 0,
        speedSum: 0,
        speedMax: 0,
        stops: new Set<string>(),
        alerts: 0,
        openAlerts: 0,
        lastDate: '',
        lastTime: '',
      }
      tracks.set(key, track)
    }
    track.alerts += 1
    if (text(row.status).toLowerCase() === 'open') track.openAlerts += 1
    const date = text(row.date)
    if (date) {
      track.days.add(date)
      if (`${date} ${text(row.time)}` > `${track.lastDate} ${track.lastTime}`) {
        track.lastDate = date
        track.lastTime = text(row.time)
      }
    }
  }
  const rows = [...tracks.values()]
    .map((track) => ({
      id: track.vehicleNo,
      vehicleNo: track.vehicleNo,
      routeName: track.route,
      trackedDays: track.days.size,
      pings: track.pings,
      distanceKm: round2(track.distanceKm),
      avgSpeed: track.pings ? round2(track.speedSum / track.pings) : 0,
      maxSpeed: round2(track.speedMax),
      stops: track.stops.size,
      alerts: track.alerts,
      openAlerts: track.openAlerts,
      lastActivity: track.lastDate ? `${track.lastDate} ${track.lastTime}`.trim() : '—',
    }))
    .sort((a, b) => b.pings - a.pings)
  const pings = rows.reduce((sum, row) => sum + row.pings, 0)
  const distance = rows.reduce((sum, row) => sum + row.distanceKm, 0)
  const alerts = rows.reduce((sum, row) => sum + row.alerts, 0)
  const open = rows.reduce((sum, row) => sum + row.openAlerts, 0)
  const avgSpeed = rows.length ? rows.reduce((sum, row) => sum + row.avgSpeed, 0) / rows.length : 0
  return {
    columns: [
      { key: 'vehicleNo', label: 'Vehicle' },
      { key: 'routeName', label: 'Route' },
      { key: 'trackedDays', label: 'Days tracked', numeric: true },
      { key: 'pings', label: 'Pings', numeric: true },
      { key: 'distanceKm', label: 'Distance (km)', numeric: true },
      { key: 'avgSpeed', label: 'Avg speed (km/h)', numeric: true },
      { key: 'maxSpeed', label: 'Max speed (km/h)', numeric: true, tone: 'warn' as const },
      { key: 'stops', label: 'Stops logged', numeric: true },
      { key: 'alerts', label: 'Alerts', numeric: true, tone: 'warn' as const },
      { key: 'openAlerts', label: 'Open alerts', numeric: true, tone: 'bad' as const },
      { key: 'lastActivity', label: 'Last activity' },
    ],
    rows: rows as TransportReportRow[],
    metrics: [
      { label: 'Vehicles tracked', value: countLabel(rows.length, 'vehicle') },
      { label: 'Pings recorded', value: countLabel(pings, 'ping') },
      { label: 'Distance covered', value: `${round2(distance).toLocaleString()} km`, hint: `${round2(avgSpeed)} km/h average speed` },
      { label: 'Tracking alerts', value: countLabel(alerts, 'alert'), hint: `${open} still open` },
    ],
    emptyTitle: 'No tracking activity',
    emptyDescription: 'GPS pings are recorded from Transport → GPS Tracking (enable “Record position pings”).',
  }
}

/* ----------------------------------------------------------------- public */

export function buildTransportReport(
  id: TransportReportId,
  records: EduRecords,
  filters: TransportReportFilters,
): TransportReport {
  const definition = TRANSPORT_REPORTS.find((item) => item.id === id) ?? TRANSPORT_REPORTS[0]
  const built =
    id === 'studentAllocation' ? studentAllocation(records, filters)
      : id === 'studentTransportLists' ? studentTransportLists(records, filters)
        : id === 'routeUtilization' ? routeUtilization(records, filters)
          : id === 'vehicleOccupancy' ? vehicleOccupancy(records, filters)
            : id === 'driverAssignments' ? driverAssignments(records, filters)
              : id === 'feeCollection' ? feeCollection(records, filters)
                : id === 'feeArrears' ? feeArrears(records, filters)
                  : id === 'attendance' ? attendanceReport(records, filters)
                    : id === 'vehicleMaintenance' ? vehicleMaintenance(records, filters)
                      : gpsActivity(records, filters)
  return {
    id: definition.id,
    label: definition.label,
    title: definition.label,
    subtitle: describeFilters(filters, definition),
    description: definition.description,
    ...built,
  }
}

/** Human-readable "as at" line describing which filters are in play. */
export function describeFilters(filters: TransportReportFilters, definition?: TransportReportDefinition): string {
  const parts: string[] = []
  const active = definition ? definition.filters : (Object.keys(EMPTY_TRANSPORT_REPORT_FILTERS) as TransportFilterKey[])
  for (const key of active) {
    const value = text(filters[key])
    if (!value) continue
    if (key === 'dateFrom' || key === 'dateTo') {
      const other = key === 'dateFrom' ? text(filters.dateTo) : text(filters.dateFrom)
      if (key === 'dateTo' && parts.some((part) => part.startsWith('Period'))) continue
      parts.push(other ? `Period ${key === 'dateFrom' ? value : other} → ${key === 'dateFrom' ? other : value}` : `${key === 'dateFrom' ? 'From' : 'Until'} ${value}`)
      continue
    }
    const label: Record<string, string> = {
      academicYear: 'Year',
      term: 'Term',
      routeName: 'Route',
      vehicleNo: 'Vehicle',
      driver: 'Driver',
      student: 'Student',
    }
    parts.push(`${label[key] ?? key}: ${value}`)
  }
  return parts.length ? parts.join(' · ') : 'All routes, vehicles and students'
}

/** Dropdown options for each filter, taken from the branch's own records. */
export function transportFilterOptions(records: EduRecords) {
  const unique = (values: string[]) => [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return {
    academicYears: unique((records.academicYear ?? []).map((row) => text(row.name))),
    terms: unique((records.termSemester ?? []).map((row) => text(row.name))),
    routes: unique((records.transportRoutes ?? []).map((row) => text(row.routeName))),
    vehicles: unique((records.transportVehicles ?? []).map((row) => text(row.vehicleNo))),
    drivers: unique((records.transportPersonnel ?? []).map((row) => text(row.fullName))),
    students: unique((records.studentTransportAssignments ?? []).map((row) => text(row.student))),
  }
}

/** Rows shaped for the Excel / CSV exporters, keyed by the visible column labels. */
export function transportExportRows(report: TransportReport): Record<string, unknown>[] {
  return report.rows.map((row) => {
    const next: Record<string, unknown> = {}
    for (const column of report.columns) next[column.label] = row[column.key]
    return next
  })
}

/** Flat "label: value" pairs for the metrics strip, useful in print headers. */
export function transportMetricLines(report: TransportReport): string[] {
  return report.metrics.map((metric) => `${metric.label}: ${metric.value}`)
}

export const transportReportFilename = (report: TransportReport) =>
  `transport-${report.id.replace(/([A-Z])/g, '-$1').toLowerCase()}-${todayIso()}`

/** Formats a cell for display: money columns get the currency format. */
export function formatReportCell(value: string | number, column?: TransportReportColumn): string {
  if (column?.money && typeof value === 'number') return ghs(value)
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return text(value) || '—'
}
