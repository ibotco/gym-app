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
export function EmployeeProfile() {
  return <HrmPlaceholder title="Employee Profile" description="Detailed employee profile with documents, contracts, and personal information." />
}
export function Departments() {
  return <HrmPlaceholder title="Departments" description="Organise employees into departments and teams." />
}
export function Designations() {
  return <HrmPlaceholder title="Designations" description="Manage job titles, designations, and roles within the organisation." />
}

// Employee Attendance sub-items
export function AttendanceDashboard() {
  return <HrmPlaceholder title="Attendance Dashboard" description="Overview of daily attendance, presence, late arrivals, and absences." />
}
export function MonthlyAttendance() {
  return <HrmPlaceholder title="Monthly Attendance" description="Monthly summary of attendance records per employee." />
}
export function AttendanceReport() {
  return <HrmPlaceholder title="Attendance Report" description="Detailed attendance reports and exports." />
}
export function ShiftManagement() {
  return <HrmPlaceholder title="Shift Management" description="Define shifts, rosters, and work schedules for employees." />
}

// Training sub-items
export function TrainingList() {
  return <HrmPlaceholder title="Training Programs" description="Schedule and manage internal and external training programs." />
}
export function TrainersList() {
  return <HrmPlaceholder title="Trainers" description="Roster of internal trainers and coaches delivering training sessions." />
}
export function TrainingFeedback() {
  return <HrmPlaceholder title="Training Feedback" description="Collect and review feedback from trainees on completed sessions." />
}

// Leave Management sub-items
export function LeaveTypes() {
  return <HrmPlaceholder title="Leave Types" description="Configure leave categories: annual, sick, maternity, compassionate, etc." />
}
export function LeaveApplications() {
  return <HrmPlaceholder title="Leave Applications" description="Review, approve, or reject employee leave requests." />
}
export function LeaveCalendar() {
  return <HrmPlaceholder title="Leave Calendar" description="Calendar view of approved leave across the organisation." />
}

// Payroll sub-items
export function PayrollDashboard() {
  return <HrmPlaceholder title="Payroll Dashboard" description="Overview of the current payroll cycle, pending runs, totals, and recent payments." />
}
export function SalaryBenefits() {
  return <HrmPlaceholder title="Salary Benefits" description="Define benefits and allowances available to employees (housing, transport, meal, etc.)." />
}
export function BonusDeduction() {
  return <HrmPlaceholder title="Bonus/Deduction" description="Configure one-off bonuses, overtime, and recurring deductions." />
}
export function SalaryStructure() {
  return <HrmPlaceholder title="Salary Structure" description="Build salary templates combining base pay, benefits, and deductions." />
}
export function AssignSalary() {
  return <HrmPlaceholder title="Assign Salary" description="Assign salary structures to individual employees or grades." />
}
export function GenerateSalary() {
  return <HrmPlaceholder title="Generate Salary" description="Run payroll for the current period and generate payment batches." />
}
export function PaymentCheque() {
  return <HrmPlaceholder title="Set Payment Cheque" description="Configure cheque / bank payment references for salary runs." />
}
export function SalaryPayment() {
  return <HrmPlaceholder title="Salary Payment" description="Approve and record disbursed salary payments." />
}
// Backwards-compat aliases for older routes/components
export function SalaryPayslips()   { return <SalaryPayment /> }
export function SalarySettings()  { return <SalaryBenefits /> }

// Loan Management sub-items
export function LoanApplications() {
  return <HrmPlaceholder title="Loan Applications" description="Review and manage employee loan and advance requests." />
}
export function LoanInstallments() {
  return <HrmPlaceholder title="Loan Installments" description="Track installment deductions and loan repayment schedules." />
}
export function LoanSettings() {
  return <HrmPlaceholder title="Loan Settings" description="Configure loan policies, interest rates, and eligibility rules." />
}

// HRM Reports
export function HrmReports() {
  return <HrmPlaceholder title="HRM Reports" description="Headcount, turnover, attendance, leave, payroll, and training reports." />
}
