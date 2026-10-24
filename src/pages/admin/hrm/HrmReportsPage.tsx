import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserPlus, CalendarCheck, ClipboardList, Wallet, Briefcase, TrendingUp,
  GraduationCap, Star, ArrowUpRight, FileText,
} from 'lucide-react'
import { PageHeader, StatCard, Select, MonthYearPicker, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, formatGhsExact } from '../../../lib/utils'
import { loadTrainingPrograms, programStats } from '../../../lib/trainingPrograms'
import { loadEmployeePromotions, type EmployeePromotionRecord } from '../../../lib/employeePromotions'
import type { TrainingProgram } from '../../../types'

type ReportKey = 'overview' | 'workforce' | 'attendance' | 'leave' | 'payroll' | 'promotions' | 'recruitment' | 'training' | 'performance' | 'loans'
type ReportRow = Record<string, string>

const REPORTS: { key: ReportKey; label: string; title: string; description: string; columns: string[] }[] = [
  { key: 'overview', label: 'Department overview', title: 'Department overview', description: 'Headcount, new hires, attendance, leave demand and net payroll by department.', columns: ['Department', 'Employees', 'New hires', 'Attendance rate', 'Leave requests', 'Net payroll'] },
  { key: 'workforce', label: 'Workforce & headcount', title: 'Workforce & headcount', description: 'Employee directory snapshot with department, role, hire date and current salary.', columns: ['Employee', 'Employee no.', 'Department', 'Job title', 'Category', 'Hire date', 'Salary'] },
  { key: 'attendance', label: 'Attendance', title: 'Attendance summary', description: 'Present, late, absent and leave records per employee for the selected year.', columns: ['Employee', 'Department', 'Present', 'Late', 'Absent', 'On leave', 'Marked', 'Attendance rate'] },
  { key: 'leave', label: 'Leave utilization', title: 'Leave utilization', description: 'Requests and approved leave days by employee and leave type.', columns: ['Employee', 'Department', 'Leave type', 'From', 'To', 'Days', 'Status'] },
  { key: 'payroll', label: 'Payroll', title: 'Payroll register', description: 'Monthly gross pay, deductions, loan/advance recovery, net pay and payment status.', columns: ['Employee', 'Department', 'Basic', 'Allowances', 'Bonus', 'Deductions', 'Loan', 'Advance', 'Net pay', 'Status'] },
  { key: 'promotions', label: 'Promotions & grades', title: 'Promotions & grades', description: 'Promotion decisions, proposed appointments, salary changes and effective dates.', columns: ['Employee', 'Department', 'Type', 'Current grade', 'Proposed grade', 'Current job title', 'Proposed job title', 'Current salary', 'Proposed salary', 'Increase', 'Effective date', 'Status'] },
  { key: 'recruitment', label: 'Recruitment pipeline', title: 'Recruitment pipeline', description: 'Candidate stages and hiring activity for the selected year.', columns: ['Candidate', 'Job', 'Department', 'Stage', 'Applied'] },
  { key: 'training', label: 'Training & development', title: 'Training & development', description: 'Program status, enrollment, attendance, feedback and budget utilization.', columns: ['Program', 'Department', 'Type', 'Status', 'Enrolled', 'Sessions', 'Attendance', 'Avg rating', 'Budget', 'Spent'] },
  { key: 'performance', label: 'Performance reviews', title: 'Performance reviews', description: 'Review completion and ratings by employee and review year.', columns: ['Employee', 'Department', 'Period', 'Rating', 'Status', 'Reviewed'] },
  { key: 'loans', label: 'Staff loans', title: 'Staff loan register', description: 'Staff loan applications by employee, product, term and current status.', columns: ['Employee', 'Department', 'Loan type', 'Principal', 'Term', 'Interest', 'Status', 'Applied'] },
]

function yearOf(value?: string) {
  const year = value?.slice(0, 4) || ''
  return /^\d{4}$/.test(year) ? year : ''
}

function daysInYear(from: string, to: string, year: string) {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  const startMs = new Date(`${year}-01-01T00:00:00Z`).getTime()
  const endMs = new Date(`${year}-12-31T00:00:00Z`).getTime()
  if (![fromMs, toMs, startMs, endMs].every(Number.isFinite) || toMs < fromMs) return 0
  const first = Math.max(fromMs, startMs)
  const last = Math.min(toMs, endMs)
  return last < first ? 0 : Math.floor((last - first) / 86400000) + 1
}

export function HrmReportsPage() {
  const {
    staff, users, departments: departmentRecords, staffAttendance, leaves, leaveTypes,
    payslips, jobs, candidates, reviews, loans, activeCompanyId,
  } = useApp()
  const toast = useToast()
  const today = new Date()
  const currentYear = String(today.getFullYear())
  const [report, setReport] = useState<ReportKey>('overview')
  const [year, setYear] = useState(currentYear)
  const [payrollPeriod, setPayrollPeriod] = useState(`${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const [department, setDepartment] = useState('all')
  const [trainingPrograms] = useState<TrainingProgram[]>(() => loadTrainingPrograms())
  const [promotionRecords, setPromotionRecords] = useState<EmployeePromotionRecord[]>(() => loadEmployeePromotions(activeCompanyId))

  useEffect(() => { setPromotionRecords(loadEmployeePromotions(activeCompanyId)) }, [activeCompanyId])

  const staffByUser = useMemo(() => new Map(staff.map((person) => [person.userId, person])), [staff])
  const staffName = (id: string) => users.find((user) => user.id === id)?.name || id
  const departmentOf = (id: string) => {
    const person = staffByUser.get(id)
    return person ? person.department || 'Unassigned' : '—'
  }
  const inDepartment = (value: string) => department === 'all' || value === department

  const departmentNames = useMemo(() => [...new Set([
    ...departmentRecords.map((item) => item.name),
    ...staff.map((person) => person.department || 'Unassigned'),
    ...jobs.map((job) => job.department).filter(Boolean),
    ...trainingPrograms.map((program) => program.department).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [departmentRecords, staff, jobs, trainingPrograms])

  const years = useMemo(() => {
    const values = new Set<string>([currentYear, String(Number(currentYear) - 1)])
    const dates = [
      ...staff.map((person) => person.hireDate),
      ...staffAttendance.map((record) => record.date),
      ...leaves.flatMap((leave) => [leave.from, leave.to]),
      ...payslips.map((slip) => slip.period),
      ...jobs.map((job) => job.postedAt),
      ...candidates.map((candidate) => candidate.appliedAt),
      ...reviews.map((review) => review.period),
      ...promotionRecords.map((record) => record.effectiveDate),
      ...trainingPrograms.map((program) => program.startDate),
      ...loans.map((loan) => loan.appliedAt),
    ]
    dates.forEach((date) => { const value = yearOf(date); if (value) values.add(value) })
    return [...values].sort((a, b) => b.localeCompare(a))
  }, [currentYear, staff, staffAttendance, leaves, payslips, jobs, candidates, reviews, promotionRecords, trainingPrograms, loans])

  const staffInScope = useMemo(() => staff.filter((person) => inDepartment(person.department || 'Unassigned')), [staff, department])
  const newHires = useMemo(() => staffInScope.filter((person) => yearOf(person.hireDate) === year), [staffInScope, year])
  const attendanceInYear = useMemo(() => staffAttendance.filter((record) => {
    return yearOf(record.date) === year && inDepartment(departmentOf(record.staffUserId))
  }), [staffAttendance, year, department, staffByUser])
  const leavesInYear = useMemo(() => leaves.filter((leave) => {
    return daysInYear(leave.from, leave.to, year) > 0 && inDepartment(departmentOf(leave.staffUserId))
  }), [leaves, year, department, staffByUser])
  const payrollInPeriod = useMemo(() => payslips.filter((slip) => {
    return slip.period === payrollPeriod && inDepartment(departmentOf(slip.staffUserId))
  }), [payslips, payrollPeriod, department, staffByUser])
  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'open' && inDepartment(job.department)), [jobs, department])
  const pendingLeaves = leavesInYear.filter((leave) => leave.status === 'pending').length
  const netPayroll = payrollInPeriod.reduce((sum, slip) => sum + slip.net, 0)
  const markedAttendance = attendanceInYear.length
  const attendanceRate = markedAttendance
    ? Math.round((attendanceInYear.filter((record) => record.status === 'present' || record.status === 'late').length / markedAttendance) * 100)
    : null

  const reportRows = useMemo<ReportRow[]>(() => {
    const byDepartment = (name: string) => staff.filter((person) => name === 'Unassigned' ? !person.department : person.department === name)

    switch (report) {
      case 'overview':
        return departmentNames.filter((name) => inDepartment(name)).map((name) => {
          const people = byDepartment(name)
          const peopleIds = new Set(people.map((person) => person.userId))
          const attendance = attendanceInYear.filter((record) => peopleIds.has(record.staffUserId))
          const attended = attendance.filter((record) => record.status === 'present' || record.status === 'late').length
          const leaveCount = leavesInYear.filter((leave) => peopleIds.has(leave.staffUserId)).length
          const net = payrollInPeriod.filter((slip) => peopleIds.has(slip.staffUserId)).reduce((sum, slip) => sum + slip.net, 0)
          return {
            Department: name,
            Employees: String(people.length),
            'New hires': String(people.filter((person) => yearOf(person.hireDate) === year).length),
            'Attendance rate': attendance.length ? `${Math.round((attended / attendance.length) * 100)}%` : '—',
            'Leave requests': String(leaveCount),
            'Net payroll': formatGhsExact(net),
          }
        })

      case 'workforce':
        return staffInScope.slice().sort((a, b) => staffName(a.userId).localeCompare(staffName(b.userId))).map((person) => ({
          Employee: staffName(person.userId),
          'Employee no.': person.employeeNumber || '—',
          Department: person.department || 'Unassigned',
          'Job title': person.staffDesignation || person.title || '—',
          Category: person.staffCategory || person.staffType || person.employmentCategory || '—',
          'Hire date': person.hireDate ? formatDate(person.hireDate) : '—',
          Salary: formatGhsExact(person.salary || 0),
        }))

      case 'attendance': {
        return staffInScope.slice().sort((a, b) => staffName(a.userId).localeCompare(staffName(b.userId))).map((person) => {
          const records = attendanceInYear.filter((record) => record.staffUserId === person.userId)
          const count = (status: string) => records.filter((record) => record.status === status).length
          const worked = count('present') + count('late')
          return {
            Employee: staffName(person.userId),
            Department: person.department || 'Unassigned',
            Present: String(count('present')),
            Late: String(count('late')),
            Absent: String(count('absent')),
            'On leave': String(count('leave')),
            Marked: String(records.length),
            'Attendance rate': records.length ? `${Math.round((worked / records.length) * 100)}%` : '—',
          }
        })
      }

      case 'leave':
        return leavesInYear.slice().sort((a, b) => b.from.localeCompare(a.from)).map((leave) => ({
          Employee: staffName(leave.staffUserId),
          Department: departmentOf(leave.staffUserId),
          'Leave type': leaveTypes.find((type) => type.id === leave.type)?.name || leave.type,
          From: formatDate(leave.from),
          To: formatDate(leave.to),
          Days: String(daysInYear(leave.from, leave.to, year)),
          Status: leave.status,
        }))

      case 'payroll':
        return payrollInPeriod.slice().sort((a, b) => staffName(a.staffUserId).localeCompare(staffName(b.staffUserId))).map((slip) => ({
          Employee: staffName(slip.staffUserId),
          Department: departmentOf(slip.staffUserId),
          Basic: formatGhsExact(slip.basic),
          Allowances: formatGhsExact(slip.allowances),
          Bonus: formatGhsExact(slip.bonus || 0),
          Deductions: formatGhsExact(slip.deductions),
          Loan: formatGhsExact(slip.loanDeduction || 0),
          Advance: formatGhsExact(slip.advanceDeduction || 0),
          'Net pay': formatGhsExact(slip.net),
          Status: slip.status,
        }))

      case 'promotions':
        return promotionRecords.filter((record) => {
          return yearOf(record.effectiveDate) === year && inDepartment(record.department)
        }).slice().sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).map((record) => ({
          Employee: record.employeeName,
          Department: record.department || '—',
          Type: record.promotionType,
          'Current grade': record.currentGrade || '—',
          'Proposed grade': record.newGrade || '—',
          'Current job title': record.currentTitle || '—',
          'Proposed job title': record.newJobTitle || '—',
          'Current salary': formatGhsExact(record.oldSalary),
          'Proposed salary': formatGhsExact(record.newSalary),
          Increase: formatGhsExact(record.salaryDifference),
          'Effective date': formatDate(record.effectiveDate),
          Status: record.status,
        }))

      case 'recruitment':
        return candidates.filter((candidate) => {
          const job = jobs.find((item) => item.id === candidate.jobId)
          return yearOf(candidate.appliedAt) === year && inDepartment(job?.department || '—')
        }).slice().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).map((candidate) => {
          const job = jobs.find((item) => item.id === candidate.jobId)
          return {
            Candidate: candidate.name,
            Job: job?.title || '—',
            Department: job?.department || '—',
            Stage: candidate.stage,
            Applied: formatDate(candidate.appliedAt),
          }
        })

      case 'training':
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        return trainingPrograms.filter((program) => {
          return program.startDate <= yearEnd && program.endDate >= yearStart && inDepartment(program.department)
        }).map((program) => {
          const stats = programStats(program)
          return {
            Program: program.title,
            Department: program.department || '—',
            Type: program.type,
            Status: program.status.replace('_', ' '),
            Enrolled: String(stats.enrolled),
            Sessions: `${stats.heldSessions}/${stats.totalSessions}`,
            Attendance: `${stats.attendancePct}%`,
            'Avg rating': stats.ratingsCount ? `${stats.avgRating}/5` : '—',
            Budget: formatGhsExact(program.budget),
            Spent: formatGhsExact(program.spent),
          }
        })

      case 'performance':
        return reviews.filter((review) => {
          return review.period === year && inDepartment(departmentOf(review.staffUserId))
        }).slice().sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).map((review) => ({
          Employee: staffName(review.staffUserId),
          Department: departmentOf(review.staffUserId),
          Period: review.period,
          Rating: `${review.rating}/5`,
          Status: review.status,
          Reviewed: formatDate(review.reviewedAt),
        }))

      case 'loans':
        return loans.filter((loan) => yearOf(loan.appliedAt) === year && inDepartment(departmentOf(loan.staffUserId)))
          .slice().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).map((loan) => ({
            Employee: staffName(loan.staffUserId),
            Department: departmentOf(loan.staffUserId),
            'Loan type': loan.loanTypeName || 'Not specified',
            Principal: formatGhsExact(loan.principal),
            Term: `${loan.months} months`,
            Interest: `${loan.interestPercent}%`,
            Status: loan.status,
            Applied: formatDate(loan.appliedAt),
          }))
    }
  }, [report, departmentNames, department, staffInScope, staff, users, year, attendanceInYear, leavesInYear, payrollInPeriod, leaveTypes, candidates, jobs, trainingPrograms, reviews, promotionRecords, loans, staffByUser])

  const config = REPORTS.find((item) => item.key === report) || REPORTS[0]
  const totalHires = newHires.length
  const currentReportName = config.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const links = [
    { to: '/admin/staff', label: 'Employee directory' },
    { to: '/admin/hrm/attendance/report', label: 'Attendance report' },
    { to: '/admin/hrm/leave/reports', label: 'Leave reports' },
    { to: '/admin/hrm/payroll/reports', label: 'Payroll reports' },
    { to: '/admin/hrm/payroll/promotions', label: 'Promotions & grades' },
    { to: '/admin/hrm/recruitment', label: 'Recruitment' },
    { to: '/admin/hrm/training', label: 'Training' },
    { to: '/admin/hrm/performance', label: 'Performance' },
    { to: '/admin/hrm/loans/applications', label: 'Staff loans' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/hrm" className="hover:text-lime">Human Resource</Link><span>/</span><span className="font-semibold text-inherit">Reports</span>
      </div>
      <PageHeader
        title="HRM Reports"
        desc="People analytics across workforce, attendance, leave, payroll, recruitment, training, performance and staff loans."
        actions={<ExportButtons filename={`hrm-${currentReportName}-${year}`} rows={reportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />}
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Report</p>
          <Select value={report} onChange={(event) => setReport(event.target.value as ReportKey)} aria-label="Report type">
            {REPORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Report year</p>
          <Select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Report year">
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Department</p>
          <Select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Department">
            <option value="all">All departments</option>
            {departmentNames.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-mist">Payroll month</p>
          <MonthYearPicker value={payrollPeriod} onChange={setPayrollPeriod} className="w-full" aria-label="Payroll month" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Employees" value={String(staffInScope.length)} icon={<Users className="size-4" />} hint={department === 'all' ? 'all departments' : department} />
        <StatCard label={`New hires · ${year}`} value={String(totalHires)} icon={<UserPlus className="size-4" />} />
        <StatCard label="Attendance rate" value={attendanceRate == null ? '—' : `${attendanceRate}%`} icon={<CalendarCheck className="size-4" />} hint={`${markedAttendance} marked record(s) · ${year}`} />
        <StatCard label="Pending leave" value={String(pendingLeaves)} icon={<ClipboardList className="size-4" />} hint={`requests in ${year}`} />
        <StatCard label="Net payroll" value={formatGhsExact(netPayroll)} icon={<Wallet className="size-4" />} hint={payrollPeriod} />
        <StatCard label="Open positions" value={String(openJobs.length)} icon={<Briefcase className="size-4" />} hint="recruitment" />
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-sm">
        <Badge tone="amber">Data note</Badge>
        <p className="text-mist">Turnover rate is not shown because employee records do not currently capture termination or exit dates. The workforce report includes hire dates so headcount growth can still be reviewed.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold transition hover:border-lime/50 hover:bg-lime/5">
            {item.label}<ArrowUpRight className="size-3.5" />
          </Link>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-extrabold">{config.title}</h2>
            <p className="mt-0.5 text-xs text-mist">{config.description}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime">
            <TrendingUp className="size-3.5" /> {reportRows.length} row(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                {config.columns.map((column) => <th key={column} className="px-3 py-2.5">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, index) => (
                <tr key={`${report}-${index}`} className="border-b border-line last:border-0 hover:bg-lime/[0.03]">
                  {config.columns.map((column, columnIndex) => (
                    <td key={column} className={`px-3 py-2.5 ${columnIndex === 0 ? 'font-semibold' : 'text-mist'}`}>
                      {row[column] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {!reportRows.length && <tr><td colSpan={config.columns.length} className="px-4 py-10 text-center text-mist">No records match these report filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="card flex items-start gap-3 p-4">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-lime" />
          <div><p className="text-sm font-bold">Use one report center</p><p className="mt-1 text-xs text-mist">Choose a category, year, department and payroll month, then export the filtered rows to Excel, CSV or PDF.</p></div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <GraduationCap className="mt-0.5 size-5 shrink-0 text-lime" />
          <div><p className="text-sm font-bold">Training outcomes included</p><p className="mt-1 text-xs text-mist">Program summaries combine enrollment, session attendance, ratings and budget utilization.</p></div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <Star className="mt-0.5 size-5 shrink-0 text-lime" />
          <div><p className="text-sm font-bold">Performance & loan snapshots</p><p className="mt-1 text-xs text-mist">Review scores and loan applications are available alongside standard people and payroll reports.</p></div>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-mist"><FileText className="size-3.5" /> Reports use records available in the active HR context. For detailed attendance, leave and payroll layouts, use the quick links above.</p>
    </div>
  )
}
