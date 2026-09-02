import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout } from './components/layout/PublicLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Protected } from './components/Protected'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Preloader } from './components/Preloader'
import { useApp } from './context/AppContext'

const Home = lazy(() => import('./pages/public/Home').then((m) => ({ default: m.Home })))
const About = lazy(() => import('./pages/public/About').then((m) => ({ default: m.About })))
const Services = lazy(() => import('./pages/public/Services').then((m) => ({ default: m.Services })))
const Membership = lazy(() => import('./pages/public/Membership').then((m) => ({ default: m.Membership })))
const Trainers = lazy(() => import('./pages/public/Trainers').then((m) => ({ default: m.Trainers })))
const Schedule = lazy(() => import('./pages/public/Schedule').then((m) => ({ default: m.Schedule })))
const Blog = lazy(() => import('./pages/public/Blog').then((m) => ({ default: m.Blog })))
const BlogPost = lazy(() => import('./pages/public/BlogPost').then((m) => ({ default: m.BlogPost })))
const Contact = lazy(() => import('./pages/public/Contact').then((m) => ({ default: m.Contact })))
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })))
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail').then((m) => ({ default: m.VerifyEmail })))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword').then((m) => ({ default: m.ChangePassword })))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })))
const Members = lazy(() => import('./pages/admin/Members').then((m) => ({ default: m.Members })))
const MemberDetail = lazy(() => import('./pages/admin/MemberDetail').then((m) => ({ default: m.MemberDetail })))
const StaffPage = lazy(() => import('./pages/admin/Staff').then((m) => ({ default: m.StaffPage })))
const StaffDetail = lazy(() => import('./pages/admin/StaffDetail').then((m) => ({ default: m.StaffDetail })))
const HrmDepartments = lazy(() => import('./pages/admin/hrm/Departments').then((m) => ({ default: m.Departments })))
const HrmLeave = lazy(() => import('./pages/admin/hrm/Leave').then((m) => ({ default: m.Leave })))
const HrmAttendance = lazy(() => import('./pages/admin/hrm/StaffAttendance').then((m) => ({ default: m.StaffAttendance })))
const HrmPayroll = lazy(() => import('./pages/admin/hrm/Payroll').then((m) => ({ default: m.Payroll })))
const HrmRecruitment = lazy(() => import('./pages/admin/hrm/Recruitment').then((m) => ({ default: m.Recruitment })))
const HrmPerformance = lazy(() => import('./pages/admin/hrm/Performance').then((m) => ({ default: m.Performance })))
// Each HR Admin sub-page is re-exported through its own module file so that
// React.lazy sees a unique module URL per page. Multiple lazy() calls
// pointing at the *same* module path can race under Vite's ESM transform
// and resolve the wrong named export as `.default` (blank/empty page).
const HrAdminLayout = lazy(() => import('./pages/admin/hrm/pages/HrAdminLayout'))
const HrDesignationPage = lazy(() => import('./pages/admin/hrm/pages/DesignationPage'))
const HrJobTitlePage = lazy(() => import('./pages/admin/hrm/pages/JobTitlePage'))
const HrEmploymentStatusPage = lazy(() => import('./pages/admin/hrm/pages/EmploymentStatusPage'))
const HrLeavePeriodPage = lazy(() => import('./pages/admin/hrm/pages/LeavePeriodPage'))
const HrLeaveTypePage = lazy(() => import('./pages/admin/hrm/pages/LeaveTypePage'))
const HrHolidaysPage = lazy(() => import('./pages/admin/hrm/pages/HolidaysPage'))
const HrWorkWeekPage = lazy(() => import('./pages/admin/hrm/pages/WorkWeekPage'))
const HrRecruitmentStatusPage = lazy(() => import('./pages/admin/hrm/pages/RecruitmentStatusPage'))
const HrJobCategoriesPage = lazy(() => import('./pages/admin/hrm/pages/JobCategoriesPage'))
const HrWorkShiftsPage = lazy(() => import('./pages/admin/hrm/pages/WorkShiftsPage'))
const HrSkillsPage = lazy(() => import('./pages/admin/hrm/pages/SkillsPage'))
const HrEducationPage = lazy(() => import('./pages/admin/hrm/pages/EducationPage'))
const HrLicensePage = lazy(() => import('./pages/admin/hrm/pages/LicensePage'))
const HrLanguagesPage = lazy(() => import('./pages/admin/hrm/pages/LanguagesPage'))
const HrMembershipPage = lazy(() => import('./pages/admin/hrm/pages/MembershipPage'))
const HrmDesignations = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.Designations })))
const HrmEmployeeProfile = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.EmployeeProfile })))
const HrmAttendanceDashboard = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.AttendanceDashboard })))
const HrmMonthlyAttendance = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.MonthlyAttendance })))
const HrmAttendanceReport = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.AttendanceReport })))
const HrmShiftManagement = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.ShiftManagement })))
const HrmTrainingList = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.TrainingList })))
const HrmTrainingFeedback = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.TrainingFeedback })))
const HrmLeaveTypes = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.LeaveTypes })))
const HrmLeaveCalendar = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.LeaveCalendar })))
const HrmPayrollDashboard = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.PayrollDashboard })))
const HrmSalaryBenefits = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.SalaryBenefits })))
const HrmBonusDeduction = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.BonusDeduction })))
const HrmSalaryStructure = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.SalaryStructure })))
const HrmAssignSalary = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.AssignSalary })))
const HrmGenerateSalary = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.GenerateSalary })))
const HrmPaymentCheque = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.PaymentCheque })))
const HrmSalaryPayment = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.SalaryPayment })))
const HrmLoanApplications = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.LoanApplications })))
const HrmLoanInstallments = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.LoanInstallments })))
const HrmLoanSettings = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.LoanSettings })))
const HrmReportsPage = lazy(() => import('./pages/admin/hrm/HrmPages').then((m) => ({ default: m.HrmReports })))
const Branches = lazy(() => import('./pages/admin/Branches').then((m) => ({ default: m.Branches })))
const Companies = lazy(() => import('./pages/admin/Companies').then((m) => ({ default: m.Companies })))
const Plans = lazy(() => import('./pages/admin/Plans').then((m) => ({ default: m.Plans })))
const ClassesAdmin = lazy(() => import('./pages/admin/Classes').then((m) => ({ default: m.ClassesAdmin })))
const Reports = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.Reports })))
const Leads = lazy(() => import('./pages/admin/Leads').then((m) => ({ default: m.Leads })))
const NotificationsAdmin = lazy(() => import('./pages/admin/Notifications').then((m) => ({ default: m.NotificationsAdmin })))
const CheckInDesk = lazy(() => import('./pages/admin/CheckIn').then((m) => ({ default: m.CheckInDesk })))
const Audit = lazy(() => import('./pages/admin/Audit').then((m) => ({ default: m.Audit })))
const Settings = lazy(() => import('./pages/admin/Settings').then((m) => ({ default: m.Settings })))
const BranchSettingsPage = lazy(() => import('./pages/admin/BranchSettings').then((m) => ({ default: m.BranchSettings })))
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettings').then((m) => ({ default: m.SystemSettingsPage })))
const CmsRouter = lazy(() => import('./pages/admin/cms/CmsRouter').then((m) => ({ default: m.CmsRouter })))
const Integrations = lazy(() => import('./pages/admin/Integrations').then((m) => ({ default: m.Integrations })))
const UsersAdmin = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.UsersAdmin })))
const TrainersAdmin = lazy(() => import('./pages/admin/Trainers').then((m) => ({ default: m.TrainersAdmin })))
const RolesAdmin = lazy(() => import('./pages/admin/Roles').then((m) => ({ default: m.RolesAdmin })))
const InventoryAdmin = lazy(() => import('./pages/admin/Inventory').then((m) => ({ default: m.Inventory })))
const InvUpdatePrice = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.UpdatePrice })))
const InvPrintLabels = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.PrintLabels })))
const InvImportProducts = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.ImportProducts })))
const InvImportOpeningStock = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.ImportOpeningStock })))
const InvPriceGroups = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvPriceGroups })))
const InvVariations = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvVariations })))
const InvCategories = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvCategories })))
const InvUnits = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvUnits })))
const InvBrands = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvBrands })))
const InvWarranties = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvWarranties })))
const InvWarehouses = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvWarehouses })))
const InvTaxes = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InvTaxes })))
const InvStockTransfer = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.StockTransfer })))
const InvStockAdjustments = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.StockAdjustments })))
const InvStockCounts = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.StockCounts })))
const InvStockAlerts = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.StockAlerts })))
const InvReports = lazy(() => import('./pages/admin/inventory/InventoryPages').then((m) => ({ default: m.InventoryReports })))
const AssetsAdmin = lazy(() => import('./pages/admin/Assets').then((m) => ({ default: m.Assets })))
const AssetDepreciationAdmin = lazy(() => import('./pages/admin/AssetDepreciation').then((m) => ({ default: m.AssetDepreciation })))
const AssetTransactionsAdmin = lazy(() => import('./pages/admin/AssetTransactions').then((m) => ({ default: m.AssetTransactions })))
const AssetCategorySettingsAdmin = lazy(() => import('./pages/admin/asset/AssetCategorySettings').then((m) => ({ default: m.AssetCategorySettings })))
const AssetConditionSettingsAdmin = lazy(() => import('./pages/admin/asset/AssetConditionSettings').then((m) => ({ default: m.AssetConditionSettings })))
const DepreciationPolicyAdmin = lazy(() => import('./pages/admin/asset/DepreciationPolicy').then((m) => ({ default: m.DepreciationPolicy })))
const AssetReportsAdmin = lazy(() => import('./pages/admin/asset/AssetReports').then((m) => ({ default: m.AssetReports })))
const SuppliersAdmin = lazy(() => import('./pages/admin/Suppliers').then((m) => ({ default: m.Suppliers })))
const CustomersAdmin = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.Customers })))
const SupplierCategoriesAdmin = lazy(() => import('./pages/admin/people/SupplierCategories').then((m) => ({ default: m.SupplierCategories })))
const CustomerCategoriesAdmin = lazy(() => import('./pages/admin/people/CustomerCategories').then((m) => ({ default: m.CustomerCategories })))
const AcctSettings = lazy(() => import('./pages/admin/accounting/AccountingSettings').then((m) => ({ default: m.AccountingSettings })))
const AcctChartOfAccounts = lazy(() => import('./pages/admin/accounting/ChartOfAccounts').then((m) => ({ default: m.ChartOfAccounts })))
const AcctReceiptVoucher = lazy(() => import('./pages/admin/accounting/ReceiptVoucher').then((m) => ({ default: m.ReceiptVoucherPage })))
const AcctPaymentVoucher = lazy(() => import('./pages/admin/accounting/PaymentVoucher').then((m) => ({ default: m.PaymentVoucherPage })))
const AcctJournalVoucher = lazy(() => import('./pages/admin/accounting/JournalVoucher').then((m) => ({ default: m.JournalVoucherPage })))
const AcctBanking = lazy(() => import('./pages/admin/accounting/Banking').then((m) => ({ default: m.Banking })))
const AcctChecks = lazy(() => import('./pages/admin/accounting/Checks').then((m) => ({ default: m.ChecksPage })))
const AcctRegister = lazy(() => import('./pages/admin/accounting/AccountRegister').then((m) => ({ default: m.AccountRegister })))
const AcctReconciliation = lazy(() => import('./pages/admin/accounting/BankReconciliation').then((m) => ({ default: m.BankReconciliationPage })))
const AcctBudget = lazy(() => import('./pages/admin/accounting/Budget').then((m) => ({ default: m.BudgetPage })))
const AcctValueBook = lazy(() => import('./pages/admin/accounting/ValueBookRegister').then((m) => ({ default: m.ValueBookRegisterPage })))
const AcctReports = lazy(() => import('./pages/admin/accounting/AccountingReports').then((m) => ({ default: m.AccountingReportsPage })))
const PointOfSaleAdmin = lazy(() => import('./pages/admin/PointOfSale').then((m) => ({ default: m.PointOfSale })))
const PointOfSaleAdmin2 = lazy(() => import('./pages/admin/PointOfSale').then((m) => ({ default: () => <m.PointOfSale screen={2} /> })))
const SalesAdmin = lazy(() => import('./pages/admin/Sales').then((m) => ({ default: m.Sales })))
const InvoicesAdmin = lazy(() => import('./pages/admin/Invoices').then((m) => ({ default: m.Invoices })))
const ReceivePaymentsAdmin = lazy(() => import('./pages/admin/ReceivePayments').then((m) => ({ default: m.ReceivePayments })))
const ShipmentsAdmin = lazy(() => import('./pages/admin/Shipments').then((m) => ({ default: m.Shipments })))
const DiscountsAdmin = lazy(() => import('./pages/admin/Discounts').then((m) => ({ default: m.Discounts })))
const SalesReturnsAdmin = lazy(() => import('./pages/admin/SalesReturns').then((m) => ({ default: m.SalesReturns })))
const SalesReportsAdmin = lazy(() => import('./pages/admin/SalesReports').then((m) => ({ default: m.SalesReports })))
const ProposalsAdmin = lazy(() => import('./pages/admin/Proposals').then((m) => ({ default: m.Proposals })))
const EstimatesAdmin = lazy(() => import('./pages/admin/Estimates').then((m) => ({ default: m.Estimates })))
const SalesOrdersAdmin = lazy(() => import('./pages/admin/SalesOrders').then((m) => ({ default: m.SalesOrders })))
const PurchasesAdmin = lazy(() => import('./pages/admin/Purchases').then((m) => ({ default: m.Purchases })))
const PurchaseOrdersAdmin = lazy(() => import('./pages/admin/PurchaseOrders').then((m) => ({ default: m.PurchaseOrders })))
const PurchaseReturnsAdmin = lazy(() => import('./pages/admin/PurchaseReturns').then((m) => ({ default: m.PurchaseReturns })))
const PurchaseRequisitionsAdmin = lazy(() => import('./pages/admin/procurement/PurchaseRequisitions').then((m) => ({ default: m.PurchaseRequisitions })))
const ProcPurchaseOrdersAdmin = lazy(() => import('./pages/admin/procurement/ProcPurchaseOrders').then((m) => ({ default: m.ProcPurchaseOrders })))
const GoodsReceiptsAdmin = lazy(() => import('./pages/admin/procurement/GoodsReceipts').then((m) => ({ default: m.GoodsReceipts })))
const SupplierInvoicesAdmin = lazy(() => import('./pages/admin/procurement/SupplierInvoices').then((m) => ({ default: m.SupplierInvoices })))
const SupplierPaymentsAdmin = lazy(() => import('./pages/admin/procurement/SupplierPayments').then((m) => ({ default: m.SupplierPayments })))
const ProcPurchaseReturnsAdmin = lazy(() => import('./pages/admin/procurement/ProcPurchaseReturns').then((m) => ({ default: m.ProcPurchaseReturns })))
const ProcurementReportsAdmin = lazy(() => import('./pages/admin/procurement/ProcurementReports').then((m) => ({ default: m.ProcurementReports })))
const PurchaseReportsAdmin = lazy(() => import('./pages/admin/PurchaseReports').then((m) => ({ default: m.PurchaseReports })))
const ProjectsList = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectsList })))
const ProjectContracts = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.Contracts })))
const ProjectTasksAssign = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.TasksAssign })))
const ProjectTasksTemplate = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.TasksTemplate })))
const ProjectTimesheet = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.Timesheet })))
const ProjectInvoice = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectInvoice })))
const ProjectReports = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectReports })))
const ProjectStatuses = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectStatuses })))
const ProjectPriorities = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectPriorities })))
const ProjectCategories = lazy(() => import('./pages/admin/project/ProjectPages').then((m) => ({ default: m.ProjectCategories })))
const AccountProfile = lazy(() => import('./pages/account/Profile').then((m) => ({ default: m.AccountProfile })))
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard').then((m) => ({ default: m.TrainerDashboard })))
const TrainerSchedule = lazy(() => import('./pages/trainer/TrainerSchedule').then((m) => ({ default: m.TrainerSchedule })))
const TrainerMembers = lazy(() => import('./pages/trainer/TrainerMembers').then((m) => ({ default: m.TrainerMembers })))
const TrainerMemberDetail = lazy(() => import('./pages/trainer/TrainerMemberDetail').then((m) => ({ default: m.TrainerMemberDetail })))
const TrainerClasses = lazy(() => import('./pages/trainer/TrainerClasses').then((m) => ({ default: m.TrainerClasses })))
const TrainerMessages = lazy(() => import('./pages/trainer/TrainerMessages').then((m) => ({ default: m.TrainerMessages })))
const TrainerWorkouts = lazy(() => import('./pages/trainer/TrainerWorkouts').then((m) => ({ default: m.TrainerWorkouts })))
const MemberDashboard = lazy(() => import('./pages/member/MemberDashboard').then((m) => ({ default: m.MemberDashboard })))
const MemberClasses = lazy(() => import('./pages/member/MemberClasses').then((m) => ({ default: m.MemberClasses })))
const MemberTraining = lazy(() => import('./pages/member/MemberTraining').then((m) => ({ default: m.MemberTraining })))
const MemberProgress = lazy(() => import('./pages/member/MemberProgress').then((m) => ({ default: m.MemberProgress })))
const MemberAI = lazy(() => import('./pages/member/MemberAI').then((m) => ({ default: m.MemberAI })))
const MemberPayments = lazy(() => import('./pages/member/MemberPayments').then((m) => ({ default: m.MemberPayments })))
const MemberCard = lazy(() => import('./pages/member/MemberCard').then((m) => ({ default: m.MemberCard })))
const MemberProfile = lazy(() => import('./pages/member/MemberProfile').then((m) => ({ default: m.MemberProfile })))
const CustomerPortal = lazy(() => import('./pages/customer/CustomerPortal').then((m) => ({ default: m.CustomerPortal })))
const SupplierPortal = lazy(() => import('./pages/supplier/SupplierPortal').then((m) => ({ default: m.SupplierPortal })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
const PaystackReturn = lazy(() => import('./pages/pay/PaystackReturn').then((m) => ({ default: m.PaystackReturn })))
const PayazaReturn = lazy(() => import('./pages/pay/PayazaReturn').then((m) => ({ default: m.PayazaReturn })))
const GatewayReturn = lazy(() => import('./pages/pay/GatewayReturn').then((m) => ({ default: m.GatewayReturn })))

const ops: Array<'super_admin' | 'gym_manager' | 'staff' | 'company_admin' | 'branch_admin' | 'head_office' | 'receptionist' | 'accountant'> = ['super_admin', 'gym_manager', 'staff', 'company_admin', 'branch_admin', 'head_office', 'receptionist', 'accountant']
const mgr: Array<'super_admin' | 'gym_manager' | 'company_admin' | 'branch_admin' | 'head_office'> = ['super_admin', 'gym_manager', 'company_admin', 'branch_admin', 'head_office']
const adminAcct: Array<'super_admin' | 'gym_manager' | 'staff' | 'accountant' | 'company_admin' | 'branch_admin' | 'head_office' | 'receptionist'> = ops
// Company (tenant) management — excludes branch-scoped admins.
const compAdmin: Array<'super_admin' | 'gym_manager' | 'company_admin' | 'head_office'> = ['super_admin', 'gym_manager', 'company_admin', 'head_office']
// Everyone who can sign into the admin console (including the Accountant role).
const admin: Array<'super_admin' | 'gym_manager' | 'staff' | 'accountant' | 'company_admin' | 'branch_admin' | 'head_office' | 'receptionist'> = ['super_admin', 'gym_manager', 'staff', 'accountant', 'company_admin', 'branch_admin', 'head_office', 'receptionist']

function Fallback() {
  return <RouteFallback />
}

function RouteFallback() {
  const { company } = useApp()
  if (company.preloaderEnabled === false) return null
  return <Preloader />
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>
}

function RoutedApp() {
  const loc = useLocation()
  return (
    <ErrorBoundary resetKey={loc.pathname}>
      <S>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/trainers" element={<Trainers />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/contact" element={<Contact />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/pay/paystack" element={<PaystackReturn />} />
          <Route path="/pay/payaza" element={<PayazaReturn />} />
          <Route path="/pay/flutterwave" element={<GatewayReturn />} />
          <Route path="/pay/stripe" element={<GatewayReturn />} />
          <Route path="/pay/paypal" element={<GatewayReturn />} />

          <Route
            path="/admin"
            element={
              <Protected roles={admin}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<Protected roles={mgr}><UsersAdmin /></Protected>} />
            <Route path="roles" element={<Protected roles={mgr}><RolesAdmin /></Protected>} />
            <Route path="inventory" element={<Protected roles={ops}><InventoryAdmin /></Protected>} />
            <Route path="inventory/update-price" element={<Protected roles={ops}><InvUpdatePrice /></Protected>} />
            <Route path="inventory/print-labels" element={<Protected roles={ops}><InvPrintLabels /></Protected>} />
            <Route path="inventory/import-products" element={<Protected roles={mgr}><InvImportProducts /></Protected>} />
            <Route path="inventory/import-opening-stock" element={<Protected roles={adminAcct}><InvImportOpeningStock /></Protected>} />
            <Route path="inventory/settings/price-groups" element={<Protected roles={mgr}><InvPriceGroups /></Protected>} />
            <Route path="inventory/settings/variations" element={<Protected roles={mgr}><InvVariations /></Protected>} />
            <Route path="inventory/settings/categories" element={<Protected roles={mgr}><InvCategories /></Protected>} />
            <Route path="inventory/settings/brands" element={<Protected roles={mgr}><InvBrands /></Protected>} />
            <Route path="inventory/settings/units" element={<Protected roles={mgr}><InvUnits /></Protected>} />
            <Route path="inventory/settings/warranties" element={<Protected roles={mgr}><InvWarranties /></Protected>} />
            <Route path="inventory/settings/warehouses" element={<Protected roles={mgr}><InvWarehouses /></Protected>} />
            <Route path="inventory/settings/taxes" element={<Protected roles={adminAcct}><InvTaxes /></Protected>} />
            <Route path="inventory/stock/transfer" element={<Protected roles={ops}><InvStockTransfer /></Protected>} />
            <Route path="inventory/stock/adjustments" element={<Protected roles={adminAcct}><InvStockAdjustments /></Protected>} />
            <Route path="inventory/stock/count" element={<Protected roles={adminAcct}><InvStockCounts /></Protected>} />
            <Route path="inventory/stock/alerts" element={<Protected roles={ops}><InvStockAlerts /></Protected>} />
            <Route path="inventory/reports" element={<Protected roles={ops}><InvReports /></Protected>} />
            <Route path="assets" element={<Protected roles={ops}><AssetsAdmin /></Protected>} />
            <Route path="assets/depreciation" element={<Protected roles={ops}><AssetDepreciationAdmin /></Protected>} />
            <Route path="assets/transactions" element={<Protected roles={ops}><AssetTransactionsAdmin /></Protected>} />
            <Route path="assets/setup/categories" element={<Protected roles={mgr}><AssetCategorySettingsAdmin /></Protected>} />
            <Route path="assets/setup/conditions" element={<Protected roles={mgr}><AssetConditionSettingsAdmin /></Protected>} />
            <Route path="assets/setup/policy" element={<Protected roles={mgr}><DepreciationPolicyAdmin /></Protected>} />
            <Route path="assets/reports" element={<Protected roles={ops}><AssetReportsAdmin /></Protected>} />
            <Route path="sales" element={<Protected roles={ops}><SalesAdmin /></Protected>} />
            <Route path="invoices" element={<Protected roles={ops}><InvoicesAdmin /></Protected>} />
            <Route path="receive-payments" element={<Protected roles={ops}><ReceivePaymentsAdmin /></Protected>} />
            <Route path="shipments" element={<Protected roles={ops}><ShipmentsAdmin /></Protected>} />
            <Route path="discounts" element={<Protected roles={ops}><DiscountsAdmin /></Protected>} />
            <Route path="sales-returns" element={<Protected roles={ops}><SalesReturnsAdmin /></Protected>} />
            <Route path="sales-reports" element={<Protected roles={ops}><SalesReportsAdmin /></Protected>} />
            <Route path="proposals" element={<Protected roles={ops}><ProposalsAdmin /></Protected>} />
            <Route path="estimates" element={<Protected roles={ops}><EstimatesAdmin /></Protected>} />
            <Route path="sales-orders" element={<Protected roles={ops}><SalesOrdersAdmin /></Protected>} />
            <Route path="purchases" element={<Protected roles={ops}><PurchasesAdmin /></Protected>} />
            <Route path="purchase-orders" element={<Protected roles={ops}><PurchaseOrdersAdmin /></Protected>} />
            <Route path="purchase-returns" element={<Protected roles={ops}><PurchaseReturnsAdmin /></Protected>} />
            <Route path="purchase-requisitions" element={<Protected roles={ops}><PurchaseRequisitionsAdmin /></Protected>} />
            <Route path="procurement-orders" element={<Protected roles={ops}><ProcPurchaseOrdersAdmin /></Protected>} />
            <Route path="goods-receipts" element={<Protected roles={ops}><GoodsReceiptsAdmin /></Protected>} />
            <Route path="supplier-invoices" element={<Protected roles={ops}><SupplierInvoicesAdmin /></Protected>} />
            <Route path="supplier-payments" element={<Protected roles={ops}><SupplierPaymentsAdmin /></Protected>} />
            <Route path="procurement-returns" element={<Protected roles={ops}><ProcPurchaseReturnsAdmin /></Protected>} />
            <Route path="procurement-reports" element={<Protected roles={ops}><ProcurementReportsAdmin /></Protected>} />
            <Route path="purchase-reports" element={<Protected roles={ops}><PurchaseReportsAdmin /></Protected>} />
            <Route path="projects" element={<Protected roles={mgr}><ProjectsList /></Protected>} />
            <Route path="projects/contracts" element={<Protected roles={mgr}><ProjectContracts /></Protected>} />
            <Route path="projects/tasks/assign" element={<Protected roles={mgr}><ProjectTasksAssign /></Protected>} />
            <Route path="projects/tasks/template" element={<Protected roles={mgr}><ProjectTasksTemplate /></Protected>} />
            <Route path="projects/timesheet" element={<Protected roles={mgr}><ProjectTimesheet /></Protected>} />
            <Route path="projects/invoices" element={<Protected roles={mgr}><ProjectInvoice /></Protected>} />
            <Route path="projects/reports" element={<Protected roles={mgr}><ProjectReports /></Protected>} />
            <Route path="projects/settings/statuses" element={<Protected roles={mgr}><ProjectStatuses /></Protected>} />
            <Route path="projects/settings/priorities" element={<Protected roles={mgr}><ProjectPriorities /></Protected>} />
            <Route path="projects/settings/categories" element={<Protected roles={mgr}><ProjectCategories /></Protected>} />
            <Route path="pos" element={<Protected roles={ops}><PointOfSaleAdmin /></Protected>} />
            <Route path="pos2" element={<Protected roles={ops}><PointOfSaleAdmin2 /></Protected>} />
            <Route path="profile" element={<AccountProfile />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:id" element={<MemberDetail />} />
            <Route path="suppliers" element={<Protected roles={admin}><SuppliersAdmin /></Protected>} />
            <Route path="supplier-categories" element={<Protected roles={admin}><SupplierCategoriesAdmin /></Protected>} />
            <Route path="customers" element={<Protected roles={admin}><CustomersAdmin /></Protected>} />
            <Route path="customer-categories" element={<Protected roles={admin}><CustomerCategoriesAdmin /></Protected>} />
            <Route path="staff" element={<Protected roles={mgr}><StaffPage /></Protected>} />
            <Route path="staff/:id" element={<Protected roles={mgr}><StaffDetail /></Protected>} />
            <Route path="trainers" element={<Protected roles={mgr}><TrainersAdmin /></Protected>} />
            <Route path="hrm/admin" element={<Protected roles={mgr}><HrAdminLayout /></Protected>}>
              <Route index element={<HrDesignationPage />} />
              <Route path="job-title" element={<HrJobTitlePage />} />
              <Route path="employment-status" element={<HrEmploymentStatusPage />} />
              <Route path="leave-period" element={<HrLeavePeriodPage />} />
              <Route path="leave-type" element={<HrLeaveTypePage />} />
              <Route path="holidays" element={<HrHolidaysPage />} />
              <Route path="work-week" element={<HrWorkWeekPage />} />
              <Route path="recruitment-status" element={<HrRecruitmentStatusPage />} />
              <Route path="job-categories" element={<HrJobCategoriesPage />} />
              <Route path="work-shifts" element={<HrWorkShiftsPage />} />
              <Route path="skills" element={<HrSkillsPage />} />
              <Route path="education" element={<HrEducationPage />} />
              <Route path="license" element={<HrLicensePage />} />
              <Route path="languages" element={<HrLanguagesPage />} />
              <Route path="membership" element={<HrMembershipPage />} />
            </Route>
            <Route path="hrm/departments" element={<Protected roles={mgr}><HrmDepartments /></Protected>} />
            <Route path="hrm/designations" element={<Protected roles={mgr}><HrDesignationPage /></Protected>} />
            <Route path="hrm/employee/profile" element={<Protected roles={mgr}><HrmEmployeeProfile /></Protected>} />
            <Route path="hrm/attendance/dashboard" element={<Protected roles={mgr}><HrmAttendanceDashboard /></Protected>} />
            <Route path="hrm/attendance" element={<Protected roles={mgr}><HrmAttendance /></Protected>} />
            <Route path="hrm/attendance/monthly" element={<Protected roles={mgr}><HrmMonthlyAttendance /></Protected>} />
            <Route path="hrm/attendance/report" element={<Protected roles={mgr}><HrmAttendanceReport /></Protected>} />
            <Route path="hrm/attendance/shifts" element={<Protected roles={mgr}><HrmShiftManagement /></Protected>} />
            <Route path="hrm/training" element={<Protected roles={mgr}><HrmTrainingList /></Protected>} />
            <Route path="hrm/training/feedback" element={<Protected roles={mgr}><HrmTrainingFeedback /></Protected>} />
            <Route path="hrm/leave/types" element={<Protected roles={mgr}><HrmLeaveTypes /></Protected>} />
            <Route path="hrm/leave" element={<Protected roles={mgr}><HrmLeave /></Protected>} />
            <Route path="hrm/leave/calendar" element={<Protected roles={mgr}><HrmLeaveCalendar /></Protected>} />
            <Route path="hrm/payroll/dashboard" element={<Protected roles={mgr}><HrmPayrollDashboard /></Protected>} />
            <Route path="hrm/payroll/salary-benefits" element={<Protected roles={mgr}><HrmSalaryBenefits /></Protected>} />
            <Route path="hrm/payroll/bonus-deduction" element={<Protected roles={mgr}><HrmBonusDeduction /></Protected>} />
            <Route path="hrm/payroll/salary-structure" element={<Protected roles={mgr}><HrmSalaryStructure /></Protected>} />
            <Route path="hrm/payroll/assign-salary" element={<Protected roles={mgr}><HrmAssignSalary /></Protected>} />
            <Route path="hrm/payroll/generate-salary" element={<Protected roles={mgr}><HrmGenerateSalary /></Protected>} />
            <Route path="hrm/payroll/payment-cheque" element={<Protected roles={mgr}><HrmPaymentCheque /></Protected>} />
            <Route path="hrm/payroll/salary-payment" element={<Protected roles={mgr}><HrmSalaryPayment /></Protected>} />
            {/* Legacy payroll aliases */}
            <Route path="hrm/payroll/payslips" element={<Protected roles={mgr}><HrmSalaryPayment /></Protected>} />
            <Route path="hrm/payroll/settings" element={<Protected roles={mgr}><HrmSalaryBenefits /></Protected>} />
            <Route path="hrm/payroll" element={<Protected roles={mgr}><HrmPayrollDashboard /></Protected>} />
            <Route path="hrm/recruitment" element={<Protected roles={mgr}><HrmRecruitment /></Protected>} />
            <Route path="hrm/performance" element={<Protected roles={mgr}><HrmPerformance /></Protected>} />
            <Route path="hrm/loans/applications" element={<Protected roles={mgr}><HrmLoanApplications /></Protected>} />
            <Route path="hrm/loans/installments" element={<Protected roles={mgr}><HrmLoanInstallments /></Protected>} />
            <Route path="hrm/loans/settings" element={<Protected roles={mgr}><HrmLoanSettings /></Protected>} />
            <Route path="hrm/reports" element={<Protected roles={mgr}><HrmReportsPage /></Protected>} />
            <Route path="branches" element={<Protected roles={mgr}><Branches /></Protected>} />
            <Route path="companies" element={<Protected roles={compAdmin}><Companies /></Protected>} />
            <Route path="plans" element={<Protected roles={mgr}><Plans /></Protected>} />
            <Route path="accounting/settings" element={<Protected roles={admin}><AcctSettings /></Protected>} />
            <Route path="accounting/receipt-voucher" element={<Protected roles={admin}><AcctReceiptVoucher /></Protected>} />
            <Route path="accounting/payment-voucher" element={<Protected roles={admin}><AcctPaymentVoucher /></Protected>} />
            <Route path="accounting/journal-voucher" element={<Protected roles={admin}><AcctJournalVoucher /></Protected>} />
            <Route path="accounting/banking" element={<Protected roles={admin}><AcctBanking /></Protected>} />
            <Route path="accounting/checks" element={<Protected roles={admin}><AcctChecks /></Protected>} />
            <Route path="accounting/register" element={<Protected roles={admin}><AcctRegister /></Protected>} />
            <Route path="accounting/chart-of-accounts" element={<Protected roles={admin}><AcctChartOfAccounts /></Protected>} />
            <Route path="accounting/reconciliation" element={<Protected roles={admin}><AcctReconciliation /></Protected>} />
            <Route path="accounting/budget" element={<Protected roles={admin}><AcctBudget /></Protected>} />
            <Route path="accounting/value-book" element={<Protected roles={admin}><AcctValueBook /></Protected>} />
            <Route path="accounting/reports" element={<Protected roles={admin}><AcctReports /></Protected>} />
            <Route path="classes" element={<ClassesAdmin />} />
            <Route path="payments" element={<Navigate to="/admin/receive-payments?tab=all" replace />} />
            <Route path="reports" element={<Protected roles={mgr}><Reports /></Protected>} />
            <Route path="leads" element={<Leads />} />
            <Route path="notifications" element={<Protected roles={mgr}><NotificationsAdmin /></Protected>} />
            <Route path="checkin" element={<CheckInDesk />} />
            <Route path="audit" element={<Protected roles={['super_admin', 'company_admin']}><Audit /></Protected>} />
            <Route path="settings" element={<Protected roles={compAdmin}><Settings /></Protected>} />
            <Route path="settings/branch" element={<Protected roles={mgr}><BranchSettingsPage /></Protected>} />
            <Route path="settings/system" element={<Protected roles={['super_admin']}><SystemSettingsPage /></Protected>} />
            <Route path="cms" element={<Protected roles={compAdmin}><CmsRouter /></Protected>} />
            <Route path="cms/:section" element={<Protected roles={compAdmin}><CmsRouter /></Protected>} />
            <Route path="integrations" element={<Protected roles={mgr}><Integrations /></Protected>} />
          </Route>

          <Route
            path="/coach"
            element={
              <Protected roles={['trainer']}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<TrainerDashboard />} />
            <Route path="schedule" element={<TrainerSchedule />} />
            <Route path="members" element={<TrainerMembers />} />
            <Route path="members/:id" element={<TrainerMemberDetail />} />
            <Route path="classes" element={<TrainerClasses />} />
            <Route path="workouts" element={<TrainerWorkouts />} />
            <Route path="messages" element={<TrainerMessages />} />
            <Route path="profile" element={<AccountProfile />} />
          </Route>

          <Route
            path="/app"
            element={
              <Protected roles={['member']}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<MemberDashboard />} />
            <Route path="classes" element={<MemberClasses />} />
            <Route path="training" element={<MemberTraining />} />
            <Route path="progress" element={<MemberProgress />} />
            <Route path="ai" element={<MemberAI />} />
            <Route path="payments" element={<MemberPayments />} />
            <Route path="card" element={<MemberCard />} />
            <Route path="profile" element={<MemberProfile />} />
          </Route>

          <Route
            path="/customer"
            element={
              <Protected roles={['customer']}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<CustomerPortal />} />
            <Route path="profile" element={<AccountProfile />} />
          </Route>

          <Route
            path="/supplier"
            element={
              <Protected roles={['supplier']}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<SupplierPortal />} />
            <Route path="profile" element={<AccountProfile />} />
          </Route>

          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </S>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  )
}
