import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { Button, PageHeader, SearchInput, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { exportExcel, type ExportRow } from '../../../lib/export'
import {
  formatTransportPickupPoints,
  loadEduRecords,
  type EduRecords,
  type EduRow,
} from '../../../lib/eduRecords'
import { formatDateTime, formatGhs } from '../../../lib/utils'
import type { AuditLog, InventoryItem, User } from '../../../types'

type ReportRouteGroup = { key: string }
type ReportRouteLeaf = { id: string; key: string }
type ReportRow = { id: string } & Record<string, string>
type ReportColumn = { key: string; label: string; numeric?: boolean }
type ReportMetric = { label: string; value: string; hint?: string }
type ReportDefinition = {
  description: string
  columns: ReportColumn[]
  rows: ReportRow[]
  metrics?: ReportMetric[]
  emptyTitle: string
  emptyDescription: string
}

const text = (value: unknown) => String(value ?? '').trim()
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
const number = (value: unknown) => Number(value) || 0
const today = () => new Date().toISOString().slice(0, 10)
const reportRow = (id: string, values: Record<string, unknown>): ReportRow =>
  Object.fromEntries([['id', id], ...Object.entries(values).map(([key, value]) => [key, String(value ?? '')])]) as ReportRow

function attendanceSummary(records: EduRecords): EduRow[] {
  const saved = records.attendanceReports ?? []
  if (saved.length) return saved
  const grouped = new Map<string, { date: string; className: string; present: number; absent: number; late: number }>()
  ;(records.studentAttendance ?? []).forEach((row) => {
    const date = text(row.date) || 'Unspecified'
    const className = text(row.className) || 'Unspecified'
    const key = `${date}\u0000${className}`
    const item = grouped.get(key) ?? { date, className, present: 0, absent: 0, late: 0 }
    const status = text(row.status).toLocaleLowerCase()
    if (status.includes('late')) item.late += 1
    else if (status.includes('absent')) item.absent += 1
    else if (status.includes('present')) item.present += 1
    grouped.set(key, item)
  })
  return [...grouped.values()].map((row, index) => ({
    id: `attendance-summary-${index}`,
    period: row.date,
    className: row.className,
    present: String(row.present),
    absent: String(row.absent),
    late: String(row.late),
  }))
}

function buildReport(
  reportId: string,
  records: EduRecords,
  inventory: InventoryItem[],
  audit: AuditLog[],
  users: User[],
  activeBranchId: string,
): ReportDefinition {
  switch (reportId) {
    case 'reportStudentInformation': {
      const students = records.studentList ?? []
      return {
        description: 'Student register and contact details for the selected branch.',
        columns: [
          { key: 'admissionNo', label: 'Admission No' }, { key: 'name', label: 'Student' },
          { key: 'className', label: 'Class' }, { key: 'rollNo', label: 'Roll No' },
          { key: 'guardian', label: 'Guardian' }, { key: 'phone', label: 'Phone' }, { key: 'status', label: 'Status' },
        ],
        rows: students.map((row) => reportRow(row.id, {
          admissionNo: row.admissionNo, name: row.name, className: row.className,
          rollNo: row.rollNo, guardian: row.guardian, phone: row.phone, status: row.status || 'Active',
        })),
        metrics: [
          { label: 'Students', value: String(students.length) },
          { label: 'Active', value: String(students.filter((row) => !row.status || row.status === 'Active').length) },
          { label: 'Classes', value: String(new Set(students.map((row) => text(row.className)).filter(Boolean)).size) },
        ],
        emptyTitle: 'No student information',
        emptyDescription: 'Student records for this branch will appear here.',
      }
    }
    case 'reportFinance': {
      const payments = records.feeCollection ?? []
      const outstanding = records.outstandingFees ?? []
      const rows = [
        ...payments.map((row) => reportRow(row.id, {
          type: 'Payment', reference: row.receiptNo, student: row.student, date: row.date,
          amount: formatGhs(number(row.amount)), status: 'Paid', method: row.method,
        })),
        ...outstanding.map((row) => reportRow(row.id, {
          type: 'Outstanding', reference: row.feeType, student: row.student, date: row.dueDate,
          amount: formatGhs(number(row.amount)), status: row.status || (text(row.dueDate) < today() ? 'Overdue' : 'Unpaid'), method: '—',
        })),
      ]
      return {
        description: 'Collected fees and outstanding balances for the selected branch.',
        columns: [
          { key: 'type', label: 'Type' }, { key: 'reference', label: 'Receipt / Fee' },
          { key: 'student', label: 'Student' }, { key: 'date', label: 'Payment / Due date' },
          { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'method', label: 'Method' },
        ],
        rows,
        metrics: [
          { label: 'Collected', value: formatGhs(payments.reduce((sum, row) => sum + number(row.amount), 0)) },
          { label: 'Outstanding', value: formatGhs(outstanding.reduce((sum, row) => sum + number(row.amount), 0)) },
          { label: 'Payments', value: String(payments.length) },
          { label: 'Unpaid items', value: String(outstanding.length) },
        ],
        emptyTitle: 'No finance records',
        emptyDescription: 'Fee payments and balances for this branch will appear here.',
      }
    }
    case 'reportAttendance': {
      const summaries = attendanceSummary(records)
      const rows = summaries.map((row) => reportRow(row.id, {
        period: row.period, className: row.className, present: row.present, absent: row.absent, late: row.late,
      }))
      const total = (key: string) => summaries.reduce((sum, row) => sum + number(row[key]), 0)
      return {
        description: 'Attendance totals by period and class. Daily logs are summarized when no report snapshots exist.',
        columns: [
          { key: 'period', label: 'Period' }, { key: 'className', label: 'Class' },
          { key: 'present', label: 'Present', numeric: true }, { key: 'absent', label: 'Absent', numeric: true }, { key: 'late', label: 'Late', numeric: true },
        ],
        rows,
        metrics: [
          { label: 'Report rows', value: String(rows.length) }, { label: 'Present', value: String(total('present')) },
          { label: 'Absent', value: String(total('absent')) }, { label: 'Late', value: String(total('late')) },
        ],
        emptyTitle: 'No attendance records',
        emptyDescription: 'Attendance data for this branch will appear here.',
      }
    }
    case 'reportExaminations': {
      const marks = records.marksEntry ?? []
      const cards = records.reportCards ?? []
      const results = records.examResults ?? []
      let columns: ReportColumn[]
      let rows: ReportRow[]
      if (marks.length) {
        columns = [
          { key: 'exam', label: 'Examination' }, { key: 'student', label: 'Student' },
          { key: 'subject', label: 'Subject' }, { key: 'marks', label: 'Marks', numeric: true },
          { key: 'maxMarks', label: 'Maximum', numeric: true }, { key: 'percentage', label: 'Percentage' },
        ]
        rows = marks.map((row) => {
          const earned = number(row.marks)
          const maximum = number(row.maxMarks)
          return reportRow(row.id, {
            exam: row.exam, student: row.student, subject: row.subject, marks: earned,
            maxMarks: maximum, percentage: maximum ? `${Math.round(earned / maximum * 100)}%` : '—',
          })
        })
      } else if (cards.length) {
        columns = [
          { key: 'student', label: 'Student' }, { key: 'className', label: 'Class' },
          { key: 'term', label: 'Term' }, { key: 'total', label: 'Total', numeric: true }, { key: 'grade', label: 'Grade' },
        ]
        rows = cards.map((row) => reportRow(row.id, { student: row.student, className: row.className, term: row.term, total: row.total, grade: row.grade }))
      } else {
        columns = [
          { key: 'exam', label: 'Examination' }, { key: 'className', label: 'Class' }, { key: 'published', label: 'Result status' },
        ]
        rows = results.map((row) => reportRow(row.id, { exam: row.exam, className: row.className, published: row.published }))
      }
      return {
        description: 'Examination performance using mark entries, report cards, and published result records.',
        columns, rows,
        metrics: [
          { label: 'Results', value: String(rows.length) },
          { label: 'Marks entered', value: String(marks.length) },
          { label: 'Report cards', value: String(cards.length) },
        ],
        emptyTitle: 'No examination results',
        emptyDescription: 'Exam marks and report-card results for this branch will appear here.',
      }
    }
    case 'reportOnlineExaminations': {
      const attempts = records.examAttempts ?? []
      const exams = records.onlineExams ?? []
      const rows = attempts.length
        ? attempts.map((row) => reportRow(row.id, {
            exam: row.exam, student: row.student, date: row.date, score: row.score, outcome: row.outcome || row.status,
          }))
        : exams.map((row) => reportRow(row.id, {
            exam: row.title, student: '—', date: row.date, score: '—', outcome: `${row.className || ''}${row.subject ? ` · ${row.subject}` : ''}`,
          }))
      return {
        description: 'Online exam attempts, results, and scheduled assessments.',
        columns: [
          { key: 'exam', label: 'Online examination' }, { key: 'student', label: 'Student' },
          { key: 'date', label: 'Date' }, { key: 'score', label: 'Score', numeric: true }, { key: 'outcome', label: 'Outcome / Class' },
        ],
        rows,
        metrics: [
          { label: 'Online exams', value: String(exams.length) }, { label: 'Attempts', value: String(attempts.length) },
          { label: 'Passed', value: String(attempts.filter((row) => /pass|complete/i.test(text(row.outcome ?? row.status))).length) },
        ],
        emptyTitle: 'No online exam activity',
        emptyDescription: 'Online exams and attempts for this branch will appear here.',
      }
    }
    case 'reportLessonPlan': {
      const plans = records.lessonPlans ?? []
      return {
        description: 'Teacher lesson plans, topics, weekly coverage, and approval status.',
        columns: [
          { key: 'teacher', label: 'Teacher' }, { key: 'subject', label: 'Subject' }, { key: 'className', label: 'Class' },
          { key: 'week', label: 'Week starting' }, { key: 'topic', label: 'Topic' }, { key: 'status', label: 'Status' },
        ],
        rows: plans.map((row) => reportRow(row.id, {
          teacher: row.teacher, subject: row.subject, className: row.className, week: row.week, topic: row.topic, status: row.status,
        })),
        metrics: [
          { label: 'Lesson plans', value: String(plans.length) },
          { label: 'Approved', value: String(plans.filter((row) => /approved/i.test(text(row.status))).length) },
          { label: 'Pending / draft', value: String(plans.filter((row) => !/approved/i.test(text(row.status))).length) },
        ],
        emptyTitle: 'No lesson plans',
        emptyDescription: 'Lesson plans for this branch will appear here.',
      }
    }
    case 'reportHumanResource': {
      const staff = records.staffList ?? []
      return {
        description: 'Staff directory and employment status for the selected branch.',
        columns: [
          { key: 'staffNo', label: 'Staff No' }, { key: 'name', label: 'Staff member' },
          { key: 'designation', label: 'Designation' }, { key: 'department', label: 'Department' },
          { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' },
        ],
        rows: staff.map((row) => reportRow(row.id, {
          staffNo: row.staffNo, name: row.name, designation: row.designation, department: row.department,
          phone: row.phone, email: row.email, status: row.status || 'Active',
        })),
        metrics: [
          { label: 'Staff', value: String(staff.length) },
          { label: 'Active', value: String(staff.filter((row) => !row.status || row.status === 'Active').length) },
          { label: 'On leave', value: String((records.staffLeave ?? []).filter((row) => /approved/i.test(text(row.status))).length) },
        ],
        emptyTitle: 'No staff records',
        emptyDescription: 'Human resource records for this branch will appear here.',
      }
    }
    case 'reportHomework': {
      const homework = records.homework ?? []
      return {
        description: 'Homework assignments by class, subject, and due date.',
        columns: [
          { key: 'title', label: 'Homework' }, { key: 'className', label: 'Class' },
          { key: 'subject', label: 'Subject' }, { key: 'dueDate', label: 'Due date' }, { key: 'instructions', label: 'Instructions' },
        ],
        rows: homework.map((row) => reportRow(row.id, {
          title: row.title, className: row.className, subject: row.subject, dueDate: row.dueDate, instructions: row.instructions,
        })),
        metrics: [
          { label: 'Assignments', value: String(homework.length) },
          { label: 'Upcoming', value: String(homework.filter((row) => text(row.dueDate) >= today()).length) },
          { label: 'Past due', value: String(homework.filter((row) => text(row.dueDate) && text(row.dueDate) < today()).length) },
        ],
        emptyTitle: 'No homework assignments',
        emptyDescription: 'Homework for this branch will appear here.',
      }
    }
    case 'reportLibrary': {
      const issues = records.bookIssueReturn ?? []
      const books = records.books ?? []
      const rows = issues.length
        ? issues.map((row) => reportRow(row.id, {
            book: row.book, member: row.member, issueDate: row.issueDate, dueDate: row.dueDate,
            returnDate: row.returnDate, status: row.status,
          }))
        : books.map((row) => reportRow(row.id, {
            book: row.title, member: '—', issueDate: '—', dueDate: '—', returnDate: '—', status: `${row.totalStock || row.copies || '0'} copies in catalogue`,
          }))
      return {
        description: 'Library circulation and catalogue status for the selected branch.',
        columns: [
          { key: 'book', label: 'Book' }, { key: 'member', label: 'Member' }, { key: 'issueDate', label: 'Issue date' },
          { key: 'dueDate', label: 'Due date' }, { key: 'returnDate', label: 'Return date' }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Catalogue titles', value: String(books.length) }, { label: 'Loans', value: String(issues.length) },
          { label: 'Open / overdue', value: String(issues.filter((row) => !/returned/i.test(text(row.status))).length) },
        ],
        emptyTitle: 'No library records',
        emptyDescription: 'Book catalogue and circulation records for this branch will appear here.',
      }
    }
    case 'reportInventory': {
      const scoped = inventory.filter((item) => {
        const ids = item.branchIds?.length ? item.branchIds : item.branchId ? [item.branchId] : []
        return !ids.length || !activeBranchId || ids.includes(activeBranchId)
      })
      const rows = scoped.map((item) => {
        const status = item.nonInventory ? 'Non-inventory' : item.quantity <= 0 ? 'Out of stock' : item.quantity <= item.reorderPoint ? 'Low stock' : 'In stock'
        return reportRow(item.id, {
          item: item.name, sku: item.sku, category: item.category, quantity: item.quantity,
          unit: item.unit, reorderPoint: item.reorderPoint, status,
        })
      })
      return {
        description: 'Branch-scoped inventory quantities, reorder points, and stock status.',
        columns: [
          { key: 'item', label: 'Item' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
          { key: 'quantity', label: 'In stock', numeric: true }, { key: 'unit', label: 'Unit' },
          { key: 'reorderPoint', label: 'Reorder point', numeric: true }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Items', value: String(scoped.length) },
          { label: 'Low stock', value: String(scoped.filter((item) => !item.nonInventory && item.quantity > 0 && item.quantity <= item.reorderPoint).length) },
          { label: 'Out of stock', value: String(scoped.filter((item) => !item.nonInventory && item.quantity <= 0).length) },
        ],
        emptyTitle: 'No inventory records',
        emptyDescription: 'Inventory for this branch will appear here.',
      }
    }
    case 'reportTransport': {
      const routes = records.transportRoutes ?? []
      const vehicles = records.transportVehicles ?? []
      const assignments = records.studentTransportAssignments ?? []
      const legacy = records.transport ?? []
      const rows = [
        ...routes.map((row) => reportRow(row.id, {
          recordType: 'Route', vehicle: '—', route: row.routeName || row.route, student: '—',
          pickupPoint: formatTransportPickupPoints(row.pickupPoints), driver: '—', capacity: '—', status: row.status,
        })),
        ...vehicles.map((row) => reportRow(row.id, {
          recordType: 'Vehicle', vehicle: row.vehicleNo || row.vehicleName || row.vehicle, route: '—', student: '—',
          pickupPoint: '—', driver: row.driverName || row.driver, capacity: row.capacity, status: row.status,
        })),
        ...assignments.map((row) => reportRow(row.id, {
          recordType: 'Student assignment', vehicle: row.vehicleNo || row.vehicle, route: row.routeName || row.route,
          student: row.student, pickupPoint: row.pickupPoint, driver: row.driverName || row.driver,
          capacity: '—', status: row.status,
        })),
        ...legacy.map((row) => reportRow(row.id, {
          recordType: row.recordType || 'Transport record', vehicle: row.vehicleNo || row.vehicle || row.vehicleName,
          route: row.routeName || row.route, student: row.student, pickupPoint: row.pickupPoint,
          driver: row.driverName || row.driver, capacity: row.capacity, status: row.status,
        })),
      ]
      return {
        description: 'Transport routes, vehicles, drivers, and assigned students for the selected branch.',
        columns: [
          { key: 'recordType', label: 'Record type' }, { key: 'vehicle', label: 'Vehicle' }, { key: 'route', label: 'Route' },
          { key: 'student', label: 'Student' }, { key: 'pickupPoint', label: 'Pickup point' }, { key: 'driver', label: 'Driver' },
          { key: 'capacity', label: 'Capacity', numeric: true }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Routes', value: String(routes.length) }, { label: 'Vehicles', value: String(vehicles.length) },
          { label: 'Student assignments', value: String(assignments.length) },
        ],
        emptyTitle: 'No transport records yet',
        emptyDescription: 'Transport reporting is ready; add route and vehicle records to populate it.',
      }
    }
    case 'studentTransportAllocationReport': {
      const assignments = records.studentTransportAssignments ?? []
      const students = records.studentList ?? []
      const active = assignments.filter((row) => text(row.status).toLocaleLowerCase() !== 'inactive')
      const inactive = assignments.filter((row) => text(row.status).toLocaleLowerCase() === 'inactive')
      const rows = assignments.map((assignment, index) => {
        const student = students.find((row) => text(row.id) === text(assignment.studentId))
          || students.find((row) => text(row.name).toLocaleLowerCase() === text(assignment.student).toLocaleLowerCase())
        return reportRow(text(assignment.id) || `transport-allocation-${index}`, {
          student: assignment.student || student?.name,
          admissionNo: student?.admissionNo,
          className: assignment.className || student?.className,
          route: assignment.routeName || assignment.route,
          vehicle: assignment.vehicleNo || assignment.vehicle,
          pickupPoint: assignment.pickupPoint || assignment.stoppageName,
          fee: text(assignment.fee) ? formatGhs(number(assignment.fee)) : '—',
          status: assignment.status || 'Active',
        })
      })
      return {
        description: 'Student transport allocations by student, class, route, vehicle, pickup point, fee and status.',
        columns: [
          { key: 'student', label: 'Student' }, { key: 'admissionNo', label: 'Admission No' },
          { key: 'className', label: 'Class' }, { key: 'route', label: 'Route' },
          { key: 'vehicle', label: 'Vehicle' }, { key: 'pickupPoint', label: 'Pickup point' },
          { key: 'fee', label: 'Transport fee' }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Assignments', value: String(assignments.length) },
          { label: 'Active', value: String(active.length) },
          { label: 'Inactive', value: String(inactive.length) },
        ],
        emptyTitle: 'No student transport allocations yet',
        emptyDescription: 'Add student transport assignments to populate this report.',
      }
    }
    case 'reportHostel': {
      const hostels = records.hostelList ?? []
      const rooms = records.hostelRooms ?? []
      const allocations = records.studentHostelAllocation ?? records.hostelAssignments ?? []
      const studentRows = (records.studentList ?? []).filter((row) =>
        text(row.hostel || row.hostelName || row.room) || /boarder/i.test(text(row.studentCategory || row.category)),
      )
      const rows = [
        ...allocations.map((row) => reportRow(row.id, {
          recordType: 'Student allocation', student: row.student || row.name, className: row.className,
          hostel: row.hostelName || row.hostel, room: row.roomNumber || row.room, capacity: '—', status: row.status,
        })),
        ...studentRows.map((row) => reportRow(row.id, {
          recordType: 'Student record', student: row.name, className: row.className,
          hostel: row.hostelName || row.hostel, room: row.roomNumber || row.room, capacity: '—', status: row.status,
        })),
        ...hostels.map((row) => reportRow(row.id, {
          recordType: 'Hostel', student: '—', className: '—', hostel: row.hostelName || row.name,
          room: '—', capacity: row.capacity, status: row.status,
        })),
        ...rooms.map((row) => reportRow(row.id, {
          recordType: 'Room', student: '—', className: '—', hostel: row.hostelName || row.hostel,
          room: row.roomNumber || row.name, capacity: row.capacity, status: row.status,
        })),
      ]
      return {
        description: 'Hostel facilities, rooms, residents, and student assignments for the selected branch.',
        columns: [
          { key: 'recordType', label: 'Record type' }, { key: 'student', label: 'Student' }, { key: 'className', label: 'Class' },
          { key: 'hostel', label: 'Hostel' }, { key: 'room', label: 'Room' }, { key: 'capacity', label: 'Capacity', numeric: true }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Residents', value: String(allocations.length || studentRows.length) },
          { label: 'Hostels', value: String(hostels.length) }, { label: 'Rooms', value: String(rooms.length) },
        ],
        emptyTitle: 'No hostel records yet',
        emptyDescription: 'Hostel reporting is ready; add hostels, rooms, and student allocations to populate it.',
      }
    }
    case 'studentHostelAllocationReport': {
      const allocations = records.studentHostelAllocation ?? []
      const students = records.studentList ?? []
      const rows = allocations.map((allocation, index) => {
        const student = students.find((row) => text(row.id) === text(allocation.studentId))
          || students.find((row) => text(row.name).toLocaleLowerCase() === text(allocation.student).toLocaleLowerCase())
        const academicYear = (records.academicYear ?? []).find((row) => text(row.id) === text(allocation.academicYearId))
        const termIds = new Set(listValues(allocation.termIds))
        const configuredTerms = (records.termSemester ?? [])
          .filter((row) => termIds.has(text(row.id)))
          .map((row) => text(row.name))
          .filter(Boolean)
        return reportRow(text(allocation.id) || `hostel-allocation-${index}`, {
          student: allocation.student || student?.name,
          admissionNo: student?.admissionNo,
          className: allocation.className || student?.className,
          academicYear: academicYear?.name || allocation.academicYear || allocation.session || 'Unscoped / legacy',
          terms: configuredTerms.length ? configuredTerms.join(', ') : listText(allocation.terms) || 'Not specified',
          hostel: allocation.hostelName || allocation.hostel,
          room: allocation.roomNumber || allocation.room,
          allocationDate: allocation.allocationDate || allocation.date,
          status: allocation.status || 'Allocated',
        })
      })
      const current = allocations.filter((row) => text(row.status).toLocaleLowerCase() !== 'checked out')
      const checkedOut = allocations.filter((row) => text(row.status).toLocaleLowerCase() === 'checked out')
      return {
        description: 'Student Hostel allocations by Academic Year / Session, Terms / Semesters, student, class, Hostel, room, allocation date and status.',
        columns: [
          { key: 'student', label: 'Student' }, { key: 'admissionNo', label: 'Admission No' },
          { key: 'className', label: 'Class' }, { key: 'academicYear', label: 'Academic Year / Session' },
          { key: 'terms', label: 'Term / Semester(s)' }, { key: 'hostel', label: 'Hostel' },
          { key: 'room', label: 'Room' }, { key: 'allocationDate', label: 'Allocation date' }, { key: 'status', label: 'Status' },
        ],
        rows,
        metrics: [
          { label: 'Current allocations', value: String(current.length) },
          { label: 'Checked out', value: String(checkedOut.length) },
          { label: 'Hostels in use', value: String(new Set(current.map((row) => text(row.hostelName || row.hostel)).filter(Boolean)).size) },
        ],
        emptyTitle: 'No student Hostel allocations yet',
        emptyDescription: 'Add individual or bulk allocations in Student Allocations to populate this report.',
      }
    }
    case 'reportAlumni': {
      const past = records.pastStudents ?? []
      const withdrawn = records.withdrawnStudents ?? []
      const rows = [
        ...past.map((row) => reportRow(row.id, {
          name: row.name, admissionNo: row.admissionNo, lastClass: row.className, session: row.session,
          status: row.status || 'Past student', remarks: row.remarks,
        })),
        ...withdrawn.map((row) => reportRow(row.id, {
          name: row.name || row.student, admissionNo: row.admissionNo, lastClass: row.className,
          session: row.withdrawalDate, status: row.status || 'Withdrawn', remarks: row.reason,
        })),
      ]
      return {
        description: 'Past and withdrawn students for the selected branch.',
        columns: [
          { key: 'name', label: 'Student' }, { key: 'admissionNo', label: 'Admission No' },
          { key: 'lastClass', label: 'Last class' }, { key: 'session', label: 'Session / date' },
          { key: 'status', label: 'Status' }, { key: 'remarks', label: 'Remarks' },
        ],
        rows,
        metrics: [{ label: 'Alumni / past students', value: String(past.length) }, { label: 'Withdrawn', value: String(withdrawn.length) }],
        emptyTitle: 'No alumni records',
        emptyDescription: 'Past-student and alumni records for this branch will appear here.',
      }
    }
    case 'reportUserLog':
    case 'reportAuditTrail': {
      const scoped = audit.filter((row) => !row.branchId || !activeBranchId || row.branchId === activeBranchId)
      const rows = scoped.map((row) => reportRow(row.id, {
        when: formatDateTime(row.createdAt), actor: users.find((user) => user.id === row.userId)?.name || row.userId,
        action: row.action, entity: row.entity, details: row.details,
      }))
      const isAudit = reportId === 'reportAuditTrail'
      return {
        description: isAudit
          ? 'Detailed, read-only audit trail for events visible to the selected branch.'
          : 'User activity log for the selected branch, including actor and event details.',
        columns: isAudit
          ? [{ key: 'when', label: 'When' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entity', label: 'Entity' }, { key: 'details', label: 'Details' }]
          : [{ key: 'when', label: 'When' }, { key: 'actor', label: 'User' }, { key: 'action', label: 'Activity' }, { key: 'details', label: 'Details' }],
        rows: isAudit ? rows : rows.map(({ entity: _entity, ...row }) => row),
        metrics: [
          { label: 'Events', value: String(rows.length) },
          { label: 'Users', value: String(new Set(scoped.map((row) => row.userId)).size) },
          { label: 'Actions', value: String(new Set(scoped.map((row) => row.action)).size) },
        ],
        emptyTitle: 'No log entries',
        emptyDescription: 'User activity and audit events for this branch will appear here.',
      }
    }
    default:
      return {
        description: 'Report data for this category.', columns: [], rows: [],
        emptyTitle: 'Report not found', emptyDescription: 'This report category is not configured.',
      }
  }
}

export function EduReportsPage({ group, leaf }: { group: ReportRouteGroup; leaf: ReportRouteLeaf }) {
  const { activeBranchId, branches, inventory, audit, users } = useApp()
  const { t } = useI18n()
  const toast = useToast()
  const branchName = branches.find((branch) => branch.id === activeBranchId)?.name
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [query, setQuery] = useState('')

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setQuery('')
  }, [activeBranchId])

  const definition = useMemo(
    () => buildReport(leaf.id, records, inventory, audit, users, activeBranchId),
    [leaf.id, records, inventory, audit, users, activeBranchId],
  )
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return definition.rows
    return definition.rows.filter((row) => Object.entries(row)
      .filter(([key]) => key !== 'id')
      .some(([, value]) => value.toLocaleLowerCase().includes(needle)))
  }, [definition.rows, query])

  const columns: Column<ReportRow>[] = [
    { key: 'sl', header: 'Sl', render: (row) => String(definition.rows.findIndex((item) => item.id === row.id) + 1) },
    ...definition.columns.map((column) => ({
      key: column.key,
      header: column.label,
      align: column.numeric ? 'right' as const : undefined,
      sortValue: (row: ReportRow) => column.numeric ? number(row[column.key]) : row[column.key] || '',
      render: (row: ReportRow) => row[column.key] || <span className="text-mist">—</span>,
    })),
  ]

  const exportReport = async () => {
    const rows: ExportRow[] = filteredRows.map((row, index) => {
      const output: ExportRow = { Sl: index + 1 }
      definition.columns.forEach((column) => { output[column.label] = row[column.key] ?? '' })
      return output
    })
    const filenameBase = `${leaf.id}-${branchName || 'branch'}`.replace(/[^a-z0-9_-]+/gi, '-')
    const ok = await exportExcel(filenameBase, rows)
    if (ok) toast.success('Report exported', `${t(leaf.key)} · Excel`)
    else toast.error('Could not export report')
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>{t(group.key)}</span>
        <span>/</span><span className="font-semibold text-inherit">{t(leaf.key)}</span>
      </div>
      <PageHeader
        title={t(leaf.key)}
        desc={`${branchName ? `${branchName} · ` : ''}${definition.description}`}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button size="sm" onClick={exportReport} disabled={!filteredRows.length}><Download className="size-4" /> Export Excel</Button>
          </div>
        )}
      />

      {definition.metrics?.length ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {definition.metrics.map((metric) => <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />)}
        </div>
      ) : null}

      <div className="card">
        <div className="border-b border-line p-3">
          <SearchInput value={query} onChange={setQuery} placeholder={`Search ${t(leaf.key).toLowerCase()}…`} />
        </div>
        <DataTable
          columns={columns}
          data={filteredRows}
          rowKey={(row) => row.id}
          emptyTitle={definition.emptyTitle}
          emptyDesc={definition.emptyDescription}
        />
      </div>
    </div>
  )
}
