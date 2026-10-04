import { Users, CalendarCheck, Wallet, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Badge } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'

export function HrmPlaceholder({ title, description }: { title: string; description: string }) {
  const { activeBranch, staff, trainers, staffAttendance, payslips } = useApp()
  const { user } = useAuth()
  const contextName = activeBranch?.name || (user?.role === 'company_admin' ? 'Your company' : 'Selected context')
  const pendingPayroll = payslips.filter((p) => p.status === 'draft').length
  const presentToday = staffAttendance.filter((record) => record.date === new Date().toISOString().slice(0, 10) && record.status === 'present').length

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/hrm" className="hover:text-lime">Human Resource</Link>
        <span className="text-mist">/</span>
        <span className="font-semibold text-inherit">{title}</span>
      </div>
      <PageHeader title={title} desc={`${description} Selected branch: ${contextName}.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4"><Users className="size-5 text-lime" /><div><p className="text-xs text-mist">Employees</p><p className="stat-num text-2xl">{staff.length}</p></div></div>
        <div className="card flex items-center gap-3 p-4"><Dumbbell className="size-5 text-lime" /><div><p className="text-xs text-mist">Trainers</p><p className="stat-num text-2xl">{trainers.length}</p></div></div>
        <div className="card flex items-center gap-3 p-4"><CalendarCheck className="size-5 text-lime" /><div><p className="text-xs text-mist">Attendance today</p><p className="stat-num text-2xl">{presentToday}</p></div></div>
        <div className="card flex items-center gap-3 p-4"><Wallet className="size-5 text-lime" /><div><p className="text-xs text-mist">Pending payroll</p><p className="stat-num text-2xl">{pendingPayroll}</p></div></div>
      </div>
      <div className="card p-8 text-center">
        <Badge tone="lime">{contextName}</Badge>
        <Users className="mx-auto mt-4 size-10 text-mist" />
        <h3 className="mt-3 text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-mist">This module is coming soon. The summary above is scoped to the branch selected in the header.</p>
        <div className="mt-4">
          <Link to="/admin/staff">
            <Button variant="outline">← Back to Employees</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// HR Admin
export function HrAdmin() {
  return (
    <HrmPlaceholder
      title="HR Admin"
      description="Configure HR settings, permissions, and company-wide HR policies."
    />
  )
}

// Employee Account sub-items
export function EmployeeDirectory() {
  return <HrmPlaceholder title="Employee Directory" description="Master list of all employees with profile, contact, and employment details." />
}
export { EmployeeProfilePage as EmployeeProfile } from './EmployeeProfilePage'
export function Departments() {
  return <HrmPlaceholder title="Departments" description="Organise employees into departments and teams." />
}
export function Designations() {
  return <HrmPlaceholder title="Designations" description="Manage job titles, designations, and roles within the organisation." />
}

// Employee Attendance sub-items
export { AttendanceDashboard as AttendanceDashboard } from './AttendanceDashboard'
export { MarkAttendancePage as MarkAttendance } from './MarkAttendancePage'
export { MonthlyAttendance } from './MonthlyAttendance'
export { AttendanceReport } from './AttendanceReport'
export { ShiftManagement } from './ShiftManagement'
export { ShiftPolicies } from './ShiftPolicies'

// Training sub-items
export { TrainingPrograms as TrainingList } from './TrainingPrograms'
export function TrainersList() {
  return <HrmPlaceholder title="Trainers" description="Roster of internal trainers and coaches delivering training sessions." />
}
export { TrainingFeedbackPage as TrainingFeedback } from './TrainingFeedback'

// Leave Management sub-items
export { LeaveTypesPage as LeaveTypes } from './LeaveTypesPage'
export function LeaveApplications() {
  return <HrmPlaceholder title="Leave Applications" description="Review, approve, or reject employee leave requests." />
}
export { LeaveCalendarPage as LeaveCalendar } from './LeaveCalendarPage'

// Payroll sub-items
export { PayrollDashboard } from './PayrollDashboard'
export { SalaryBenefitsPage as SalaryBenefits } from './SalaryBenefitsPage'
export { SalaryStructurePage as SalaryStructure } from './SalaryStructurePage'
export { AssignSalaryPage as AssignSalary } from './AssignSalaryPage'
export { GenerateSalaryPage as GenerateSalary } from './GenerateSalaryPage'
export { PaymentChequePage as PaymentCheque } from './PaymentChequePage'
export { SalaryPaymentPage as SalaryPayment } from './SalaryPaymentPage'
import { SalaryPaymentPage as SalaryPaymentComp } from './SalaryPaymentPage'
import { SalaryBenefitsPage as SalaryBenefitsComp } from './SalaryBenefitsPage'
// Backwards-compat aliases for older routes/components
export function SalaryPayslips()   { return <SalaryPaymentComp /> }
export function SalarySettings()  { return <SalaryBenefitsComp /> }

// Loan Management sub-items
export { LoanApplicationsPage as LoanApplications } from './LoanApplicationsPage'
export { LoanInstallmentsPage as LoanInstallments } from './LoanInstallmentsPage'
export { LoanSettingsPage as LoanSettings } from './LoanSettingsPage'

// HRM Reports
export function HrmReports() {
  return <HrmPlaceholder title="HRM Reports" description="Headcount, turnover, attendance, leave, payroll, and training reports." />
}
