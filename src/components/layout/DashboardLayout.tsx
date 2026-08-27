import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCog, Building2, CreditCard, CalendarDays, Wallet,
  BarChart3, Bell, Settings, Shield, ShieldCheck, ClipboardList, Dumbbell, MessageSquare,
  Activity, QrCode, Target, LogOut, Moon, Sun, Menu, X, Sparkles, AlertTriangle,
  ChevronDown, Briefcase, FileText, ScanLine, Package, ShoppingCart, Receipt, Truck, RotateCcw, Percent, Star, Clock, Boxes, TrendingDown, ArrowLeftRight,
  Settings2, SlidersHorizontal, TerminalSquare, Banknote, Calculator, Tags, Gauge, PanelLeftClose, PanelLeftOpen, Handshake, ContactRound,
  BookOpen, ArrowDownToLine, ArrowUpFromLine, Landmark, ListOrdered, Table2, Scale, BookMarked, CheckSquare,
  MapPin, Globe, Menu as MenuIcon, LayoutTemplate, Images, Newspaper, HelpCircle, FolderOpen, Folder, Image, Search, Camera,
  Printer, Upload, Tag, DollarSign, Warehouse, Layers, Network, Users2, GraduationCap, HandCoins, CalendarCheck,
  LayoutGrid, FileSignature, UserCheck, FileSpreadsheet, Timer, Gift, UserPlus,
} from 'lucide-react'
import { Avatar, Logo, Badge, SearchField, Modal, Button } from '../ui'
import { Preloader } from '../Preloader'
import { useAuth, roleHome } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useApp } from '../../context/AppContext'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { cn } from '../../lib/utils'
import { roleName } from '../../lib/permissions'
import { hiddenNavKeys, navRank } from '../../lib/modules'
import { isDarkColor } from '../../lib/color'
import { APP_VERSION } from '../../lib/version'
import type { Role } from '../../types'

type Item = { to: string; key: string; icon: typeof LayoutDashboard; roles: Role[]; badge?: 'overdueInvoices' }
type SubGroup = { key: string; icon: typeof LayoutDashboard; roles: Role[]; children: Item[] }
/** Non-clickable section label inside a group (i18n key). */
type Heading = { heading: string; roles: Role[] }
type GroupChild = Item | SubGroup | Heading
type Group = { key: string; icon: typeof LayoutDashboard; roles: Role[]; children: GroupChild[] }
type NavEntry = ({ kind: 'link' } & Item) | ({ kind: 'group' } & Group)

const NAV: NavEntry[] = [
  { kind: 'link', to: '/admin', key: 'nav.overview', icon: LayoutDashboard, roles: ['super_admin', 'gym_manager', 'staff'] },
  { kind: 'link', to: '/admin/branches', key: 'nav.branches', icon: Building2, roles: ['super_admin', 'gym_manager'] },
  {
    kind: 'group', key: 'nav.people', icon: Users, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'],
    children: [
      { to: '/admin/leads', key: 'nav.leads', icon: Briefcase, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/members', key: 'nav.members', icon: Users, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'] },
      { to: '/admin/suppliers', key: 'nav.suppliers', icon: Handshake, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/supplier-categories', key: 'nav.supplierCategories', icon: Tags, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/customers', key: 'nav.customers', icon: ContactRound, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/customer-categories', key: 'nav.customerCategories', icon: Tags, roles: ['super_admin', 'gym_manager', 'accountant'] },
    ],
  },
  {
    kind: 'group', key: 'nav.userManagement', icon: UserCog, roles: ['super_admin', 'gym_manager'],
    children: [
      { to: '/admin/users', key: 'nav.users', icon: UserCog, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/roles', key: 'nav.roles', icon: ShieldCheck, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/audit', key: 'nav.audit', icon: Shield, roles: ['super_admin'] },
    ],
  },
  {
    kind: 'group', key: 'nav.hrm', icon: Network, roles: ['super_admin', 'gym_manager'],
    children: [
      { to: '/admin/hrm/admin', key: 'nav.hrAdmin', icon: Settings2, roles: ['super_admin', 'gym_manager'] },
      {
        key: 'nav.hrEmployeeAccount', icon: Users2, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/staff', key: 'nav.employees', icon: Users, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/employee/profile', key: 'nav.hrEmployeeProfile', icon: ContactRound, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/departments', key: 'nav.departments', icon: Building2, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      {
        key: 'nav.hrEmployeeAttendance', icon: Clock, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/hrm/attendance/dashboard', key: 'nav.hrAttendanceDashboard', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/attendance/monthly', key: 'nav.staffAttendance', icon: CalendarCheck, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/attendance/report', key: 'nav.hrAttendanceReport', icon: FileText, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/attendance/shifts', key: 'nav.hrShiftManagement', icon: CalendarDays, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      {
        key: 'nav.hrTraining', icon: GraduationCap, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/hrm/training', key: 'nav.hrTrainingList', icon: ClipboardList, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/trainers', key: 'nav.trainers', icon: Dumbbell, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/training/feedback', key: 'nav.hrTrainingFeedback', icon: MessageSquare, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      { to: '/admin/hrm/recruitment', key: 'nav.recruitment', icon: Briefcase, roles: ['super_admin', 'gym_manager'] },
      {
        key: 'nav.hrLeaveManagement', icon: CalendarDays, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/hrm/leave/types', key: 'nav.hrLeaveTypes', icon: Tags, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/leave', key: 'nav.leave', icon: FileText, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/leave/calendar', key: 'nav.hrLeaveCalendar', icon: CalendarDays, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      {
        key: 'nav.hrPayroll', icon: Wallet, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/hrm/payroll/dashboard', key: 'nav.hrPayrollDashboard', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/salary-benefits', key: 'nav.hrSalaryBenefits', icon: Gift, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/bonus-deduction', key: 'nav.hrBonusDeduction', icon: Percent, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/salary-structure', key: 'nav.hrSalaryStructure', icon: Calculator, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/assign-salary', key: 'nav.hrAssignSalary', icon: UserPlus, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/generate-salary', key: 'nav.hrGenerateSalary', icon: FileSpreadsheet, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/payment-cheque', key: 'nav.hrPaymentCheque', icon: Banknote, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/payroll/salary-payment', key: 'nav.hrSalaryPayment', icon: Receipt, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      { to: '/admin/hrm/performance', key: 'nav.performance', icon: Star, roles: ['super_admin', 'gym_manager'] },
      {
        key: 'nav.hrLoanManagement', icon: HandCoins, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/hrm/loans/applications', key: 'nav.hrLoanApplications', icon: FileText, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/loans/installments', key: 'nav.hrLoanInstallments', icon: Landmark, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/hrm/loans/settings', key: 'nav.hrLoanSettings', icon: Settings2, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      { to: '/admin/hrm/reports', key: 'nav.hrReports', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
    ],
  },
  { kind: 'link', to: '/admin/companies', key: 'nav.companies', icon: Building2, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
  {
    kind: 'group', key: 'nav.programs', icon: Dumbbell, roles: ['super_admin', 'gym_manager', 'staff'],
    children: [
      { to: '/admin/plans', key: 'nav.plans', icon: CreditCard, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/classes', key: 'nav.classes', icon: CalendarDays, roles: ['super_admin', 'gym_manager', 'staff'] },
    ],
  },
  {
    kind: 'group', key: 'nav.accounting', icon: BookOpen, roles: ['super_admin', 'gym_manager', 'accountant'],
    children: [
      { to: '/admin/accounting/settings', key: 'nav.acctSettings', icon: Settings2, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/receipt-voucher', key: 'nav.receiptVoucher', icon: ArrowDownToLine, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/payment-voucher', key: 'nav.paymentVoucher', icon: ArrowUpFromLine, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/journal-voucher', key: 'nav.journalVoucher', icon: BookOpen, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/banking', key: 'nav.banking', icon: Landmark, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/checks', key: 'nav.checks', icon: CheckSquare, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/register', key: 'nav.accountRegister', icon: ListOrdered, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/chart-of-accounts', key: 'nav.chartOfAccounts', icon: Table2, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/reconciliation', key: 'nav.bankReconciliation', icon: Scale, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/budget', key: 'nav.budget', icon: Target, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/value-book', key: 'nav.valueBook', icon: BookMarked, roles: ['super_admin', 'gym_manager', 'accountant'] },
      { to: '/admin/accounting/reports', key: 'nav.acctReports', icon: BarChart3, roles: ['super_admin', 'gym_manager', 'accountant'] },
    ],
  },
  {
    kind: 'group', key: 'nav.inventory', icon: Package, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'],
    children: [
      { to: '/admin/inventory', key: 'nav.invProducts', icon: Boxes, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'] },
      { to: '/admin/inventory/update-price', key: 'nav.invUpdatePrice', icon: DollarSign, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/inventory/print-labels', key: 'nav.invPrintLabels', icon: Printer, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/inventory/import-products', key: 'nav.invImportProducts', icon: Upload, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/inventory/import-opening-stock', key: 'nav.invImportOpeningStock', icon: ArrowDownToLine, roles: ['super_admin', 'gym_manager', 'accountant'] },
      {
        key: 'nav.invProductSettings', icon: Settings2, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/inventory/settings/price-groups', key: 'nav.invPriceGroups', icon: Tags, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/inventory/settings/variations', key: 'nav.invVariations', icon: Layers, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/inventory/settings/categories', key: 'nav.invCategories', icon: Tag, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/inventory/settings/brands', key: 'nav.invBrands', icon: Building2, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/inventory/settings/units', key: 'nav.invUnits', icon: ListOrdered, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/inventory/settings/warranties', key: 'nav.invWarranties', icon: ShieldCheck, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      {
        key: 'nav.invStockManagement', icon: ClipboardList, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'],
        children: [
          { to: '/admin/inventory/stock/transfer', key: 'nav.invStockTransfer', icon: ArrowLeftRight, roles: ['super_admin', 'gym_manager', 'staff'] },
          { to: '/admin/inventory/stock/adjustments', key: 'nav.invStockAdjust', icon: SlidersHorizontal, roles: ['super_admin', 'gym_manager', 'accountant'] },
          { to: '/admin/inventory/stock/alerts', key: 'nav.invStockAlerts', icon: Bell, roles: ['super_admin', 'gym_manager', 'staff'] },
        ],
      },
      { to: '/admin/inventory/reports', key: 'nav.invReports', icon: BarChart3, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'] },
    ],
  },
  {
    kind: 'group', key: 'nav.assets', icon: Boxes, roles: ['super_admin', 'gym_manager', 'staff'],
    children: [
      { to: '/admin/assets', key: 'nav.assetsRegister', icon: Boxes, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/assets/depreciation', key: 'nav.assetDepreciation', icon: TrendingDown, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/assets/transactions', key: 'nav.assetTransactions', icon: ArrowLeftRight, roles: ['super_admin', 'gym_manager', 'staff'] },
      {
        key: 'nav.assetSetup', icon: Settings2, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/assets/setup/conditions', key: 'nav.assetConditionSettings', icon: SlidersHorizontal, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/assets/setup/categories', key: 'nav.assetCategorySettings', icon: Tags, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/assets/setup/policy', key: 'nav.assetDepreciationPolicy', icon: Gauge, roles: ['super_admin', 'gym_manager'] },
        ],
      },
      { to: '/admin/assets/reports', key: 'nav.assetReports', icon: BarChart3, roles: ['super_admin', 'gym_manager', 'staff'] },
    ],
  },
  {
    kind: 'group', key: 'nav.sales', icon: Receipt, roles: ['super_admin', 'gym_manager', 'staff'],
    children: [
      { heading: 'nav.secSell', roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/pos', key: 'nav.pos', icon: ShoppingCart, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/sales', key: 'nav.salesList', icon: Clock, roles: ['super_admin', 'gym_manager', 'staff'] },
      { heading: 'nav.secQuoteToCash', roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/estimates', key: 'nav.estimates', icon: Calculator, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/proposals', key: 'nav.proposals', icon: BookMarked, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/sales-orders', key: 'nav.salesOrders', icon: ClipboardList, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/invoices', key: 'nav.invoices', icon: FileText, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/receive-payments', key: 'nav.receivePayments', icon: Banknote, roles: ['super_admin', 'gym_manager', 'staff'], badge: 'overdueInvoices' },
      { heading: 'nav.secFulfilment', roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/shipments', key: 'nav.shipments', icon: Truck, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/sales-returns', key: 'nav.salesReturns', icon: RotateCcw, roles: ['super_admin', 'gym_manager', 'staff'] },
      { heading: 'nav.secInsights', roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/discounts', key: 'nav.discounts', icon: Percent, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/sales-reports', key: 'nav.salesReports', icon: BarChart3, roles: ['super_admin', 'gym_manager', 'staff'] },
    ],
  },
  {
    kind: 'group', key: 'nav.purchases', icon: Truck, roles: ['super_admin', 'gym_manager', 'staff'],
    children: [
      { to: '/admin/purchase-orders', key: 'nav.purchaseOrders', icon: ClipboardList, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/purchases', key: 'nav.purchasesList', icon: Truck, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/purchase-returns', key: 'nav.purchaseReturns', icon: RotateCcw, roles: ['super_admin', 'gym_manager', 'staff'] },
      { to: '/admin/purchase-reports', key: 'nav.purchaseReports', icon: BarChart3, roles: ['super_admin', 'gym_manager', 'staff'] },
    ],
  },
  {
    kind: 'group', key: 'nav.projects', icon: LayoutGrid, roles: ['super_admin', 'gym_manager'],
    children: [
      { to: '/admin/projects', key: 'nav.projectsList', icon: LayoutGrid, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/contracts', key: 'nav.projectsContracts', icon: FileSignature, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/tasks/assign', key: 'nav.projectsTasksAssign', icon: UserCheck, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/tasks/template', key: 'nav.projectsTasksTemplate', icon: FileSpreadsheet, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/timesheet', key: 'nav.projectsTimesheet', icon: Timer, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/invoices', key: 'nav.projectsInvoice', icon: Receipt, roles: ['super_admin', 'gym_manager'] },
      { to: '/admin/projects/reports', key: 'nav.projectsReports', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
      {
        key: 'nav.projectsSettings', icon: Settings2, roles: ['super_admin', 'gym_manager'],
        children: [
          { to: '/admin/projects/settings/statuses', key: 'nav.projStatuses', icon: CheckSquare, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/projects/settings/priorities', key: 'nav.projPriorities', icon: Star, roles: ['super_admin', 'gym_manager'] },
          { to: '/admin/projects/settings/categories', key: 'nav.projCategories', icon: Tags, roles: ['super_admin', 'gym_manager'] },
        ],
      },
    ],
  },
  { kind: 'link', to: '/admin/reports', key: 'nav.reports', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
  { kind: 'link', to: '/admin/notifications', key: 'nav.notifications', icon: Bell, roles: ['super_admin', 'gym_manager'] },
  { kind: 'link', to: '/admin/checkin', key: 'nav.checkin', icon: ScanLine, roles: ['super_admin', 'gym_manager', 'staff'] },
  {
    kind: 'group', key: 'nav.frontCms', icon: Globe, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'],
    children: [
      { to: '/admin/cms/settings', key: 'nav.cmsSettings', icon: Settings2, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/menus', key: 'nav.cmsMenus', icon: MenuIcon, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/sections', key: 'nav.cmsSections', icon: LayoutTemplate, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/pages', key: 'nav.cmsPages', icon: FileText, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/sliders', key: 'nav.cmsSliders', icon: Images, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/events', key: 'nav.cmsEvents', icon: CalendarDays, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/news', key: 'nav.cmsNews', icon: Newspaper, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/services', key: 'nav.cmsServices', icon: Briefcase, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/features', key: 'nav.cmsFeatures', icon: Sparkles, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/testimonials', key: 'nav.cmsTestimonials', icon: MessageSquare, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/faqs', key: 'nav.cmsFaqs', icon: HelpCircle, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/gallery-categories', key: 'nav.cmsGalleryCategories', icon: FolderOpen, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/gallery', key: 'nav.cmsGallery', icon: Camera, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/media', key: 'nav.cmsMedia', icon: Folder, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/banners', key: 'nav.cmsBanners', icon: Image, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/cms/seo', key: 'nav.cmsSeo', icon: Search, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
    ],
  },
  {
    kind: 'group', key: 'nav.settings', icon: Settings, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office', 'branch_admin'],
    children: [
      { to: '/admin/settings/system', key: 'nav.systemSettings', icon: TerminalSquare, roles: ['super_admin'] },
      { to: '/admin/settings', key: 'nav.companySettings', icon: Settings, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office'] },
      { to: '/admin/settings/branch', key: 'nav.branchSettings', icon: Building2, roles: ['super_admin', 'gym_manager', 'company_admin', 'head_office', 'branch_admin'] },
    ],
  },
  { kind: 'link', to: '/admin/profile', key: 'nav.profile', icon: Target, roles: ['super_admin', 'gym_manager', 'staff', 'accountant'] },

  { kind: 'link', to: '/coach', key: 'nav.today', icon: LayoutDashboard, roles: ['trainer'] },
  { kind: 'link', to: '/coach/schedule', key: 'nav.schedule', icon: CalendarDays, roles: ['trainer'] },
  { kind: 'link', to: '/coach/members', key: 'nav.assigned', icon: Users, roles: ['trainer'] },
  { kind: 'link', to: '/coach/classes', key: 'nav.myClasses', icon: Dumbbell, roles: ['trainer'] },
  { kind: 'link', to: '/coach/workouts', key: 'nav.workouts', icon: ClipboardList, roles: ['trainer'] },
  { kind: 'link', to: '/coach/messages', key: 'nav.messages', icon: MessageSquare, roles: ['trainer'] },
  { kind: 'link', to: '/coach/profile', key: 'nav.profile', icon: Target, roles: ['trainer'] },

  { kind: 'link', to: '/app', key: 'nav.home', icon: LayoutDashboard, roles: ['member'] },
  { kind: 'link', to: '/app/classes', key: 'nav.bookClasses', icon: CalendarDays, roles: ['member'] },
  { kind: 'link', to: '/app/training', key: 'nav.training', icon: Dumbbell, roles: ['member'] },
  { kind: 'link', to: '/app/progress', key: 'nav.progress', icon: Activity, roles: ['member'] },
  { kind: 'link', to: '/app/ai', key: 'nav.ai', icon: Sparkles, roles: ['member'] },
  { kind: 'link', to: '/app/payments', key: 'nav.payments', icon: Wallet, roles: ['member'] },
  { kind: 'link', to: '/app/card', key: 'nav.card', icon: QrCode, roles: ['member'] },
  { kind: 'link', to: '/app/profile', key: 'nav.profile', icon: Target, roles: ['member'] },

  { kind: 'link', to: '/customer', key: 'nav.customerPortal', icon: ContactRound, roles: ['customer'] },
  { kind: 'link', to: '/customer/profile', key: 'nav.profile', icon: Target, roles: ['customer'] },

  { kind: 'link', to: '/supplier', key: 'nav.supplierPortal', icon: Handshake, roles: ['supplier'] },
  { kind: 'link', to: '/supplier/profile', key: 'nav.profile', icon: Target, roles: ['supplier'] },
]

export function DashboardLayout() {
  const { user, logout, impersonate, hasRole } = useAuth()
  const { isDark, toggle } = useTheme()
  const {
    users, roles, notifications, markAllNotifRead, modules, sidebarOrder, company,
    companies, branches, activeCompany, activeBranch, activeCompanyId, activeBranchId,
    productMode, setActiveCompany, setActiveBranch, setProductMode, systemSettings,
  } = useApp()
  // Sidebar scroll behaviour: pinned/independent by default, or scroll with the page.
  const sidebarSticky = company.sidebarSticky !== false
  // Custom chrome (sidebar/header) theming.
  const sidebarColor = company.sidebarColor
  const headerColor = company.headerColor
  const sidebarChromeDark = sidebarColor ? isDarkColor(sidebarColor) : isDark
  const headerChromeDark = headerColor ? isDarkColor(headerColor) : isDark
  // Multi-company / multi-branch context.
  const canManageTenants = user ? ['super_admin', 'gym_manager', 'company_admin', 'head_office'].includes(user.role) : false
  const isBranchScoped = user?.role === 'branch_admin'
  const advanceMode = productMode === 'advance'
  const companyBranches = useMemo(
    () => branches.filter((b) => (b.companyId || 'co_fitpro') === (activeCompany?.id || 'co_fitpro')),
    [branches, activeCompany],
  )
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  // Hovering the collapsed rail temporarily re-expands it (icon rail UX).
  const [sbHover, setSbHover] = useState(false)
  const mini = collapsed && !sbHover && !open
  const [q, setQ] = useState('')
  const [menuQuery, setMenuQuery] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showCompany, setShowCompany] = useState(false)
  const [showBranch, setShowBranch] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  const headerSearchRef = useRef<HTMLInputElement>(null)

  // Show a page preloader on every sidebar navigation (route change).
  const [pageLoading, setPageLoading] = useState(false)
  useEffect(() => {
    setPageLoading(true)
    const t = window.setTimeout(() => setPageLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [loc.pathname])

  // Press "/" to focus the header search (unless already typing in an input).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/') return
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      headerSearchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = useMemo(() => {
    const hidden = hiddenNavKeys(modules)
    // The Super Admin must never be locked out of Settings (it hosts Module
    // Management), so Settings always stays visible for them regardless of
    // its toggle. For other roles the toggle hides it as normal.
    const isSuper = user?.role === 'super_admin'
    const isHidden = (key: string) => hidden.has(key) && !(isSuper && key === 'nav.settings')
    // New enterprise roles mirror an existing role for navigation purposes so
    // they inherit the same menu without editing every NAV entry.
    const ROLE_MIRROR: Record<string, Role> = {
      company_admin: 'gym_manager',
      head_office: 'gym_manager',
      branch_admin: 'gym_manager',
      receptionist: 'staff',
    }
    // Company-level entries a branch admin must never see, even though their
    // role mirrors gym_manager for the rest of the menu.
    const COMPANY_LEVEL_KEYS = new Set(['nav.companies', 'nav.companySettings', 'nav.roles', 'nav.users', 'nav.audit'])
    const canSee = (roles: Role[], key?: string) => {
      if (!user) return false
      if (roles.includes(user.role)) return true
      if (user.role === 'branch_admin' && key && COMPANY_LEVEL_KEYS.has(key)) return false
      return roles.includes(ROLE_MIRROR[user.role] as Role)
    }
    return NAV.filter((i) => canSee(i.roles, i.key))
      .map((entry) => {
        // Hide module-controlled top-level links and groups.
        if (entry.kind === 'link') return isHidden(entry.key) ? null : entry
        if (isHidden(entry.key)) return null
        // Filter module-controlled children out of groups (and nested subgroups).
        const children = entry.children
          .map((c) => {
            if ('heading' in c) return canSee(c.roles) ? c : null
            if (!canSee(c.roles, c.key)) return null
            if ('children' in c) {
              const gc = c.children.filter((g) => canSee(g.roles, g.key) && !isHidden(g.key))
              if (!gc.length) return null
              return { ...c, children: gc }
            }
            return isHidden(c.key) ? null : c
          })
          .filter((c): c is GroupChild => c != null)
        if (!children.some((c) => !('heading' in c))) return null
        return { ...entry, children }
      })
      .filter((e): e is NavEntry => e != null)
      // Apply custom sidebar ordering (module order). Entries not in the
      // order (e.g. profile) keep their relative position at the end.
      .sort((a, b) => {
        const rankOf = (key: string) => {
          if (key === 'nav.programs') return Math.min(navRank(sidebarOrder, 'nav.plans'), navRank(sidebarOrder, 'nav.classes'))
          if (key === 'nav.userManagement') return Math.min(navRank(sidebarOrder, 'nav.users'), navRank(sidebarOrder, 'nav.roles'))
          return navRank(sidebarOrder, key)
        }
        return rankOf(a.key) - rankOf(b.key)
      })
  }, [user, modules, sidebarOrder])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Flatten the (role-filtered) nav into searchable entries: links plus
  // group children (including nested sub-groups), each remembering its parent.
  const searchIndex = useMemo(() => {
    const out: { to: string; key: string; icon: typeof LayoutDashboard; parent?: string }[] = []
    for (const e of items) {
      if (e.kind === 'group') {
        for (const c of e.children) {
          if ('heading' in c) continue
          if ('children' in c) {
            for (const gc of c.children) out.push({ to: gc.to, key: gc.key, icon: gc.icon, parent: c.key })
          } else {
            out.push({ to: c.to, key: c.key, icon: c.icon, parent: e.key })
          }
        }
      } else {
        out.push({ to: e.to, key: e.key, icon: e.icon })
      }
    }
    return out
  }, [items])

  const menuResults = useMemo(() => {
    const ql = menuQuery.trim().toLowerCase()
    if (!ql) return []
    return searchIndex.filter((s) => {
      const label = t(s.key).toLowerCase()
      const parent = s.parent ? t(s.parent).toLowerCase() : ''
      return label.includes(ql) || parent.includes(ql)
    })
  }, [menuQuery, searchIndex, t])

  // Auto-expand any group (and nested sub-group) whose child route is active.
  useEffect(() => {
    const match = (to: string) => loc.pathname === to || loc.pathname.startsWith(to + '/')
    const open: Record<string, boolean> = {}
    for (const e of NAV) {
      if (e.kind !== 'group') continue
      for (const c of e.children) {
        if ('heading' in c) continue
        if ('children' in c) {
          if (c.children.some((gc) => match(gc.to))) { open[e.key] = true; open[c.key] = true }
        } else if (match(c.to)) {
          open[e.key] = true
        }
      }
    }
    setOpenGroups((s) => ({ ...s, ...open }))
  }, [loc.pathname])
  const unread = notifications.filter((n) => n.userId === user?.id && !n.read)
  const myNotifs = notifications.filter((n) => n.userId === user?.id).slice(0, 6)

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f4f4ef] text-zinc-900 dark:bg-[#0b0b0d] dark:text-zinc-100">
      <div className="dash-shell flex min-h-screen">
        <aside
          onMouseEnter={() => setSbHover(true)}
          onMouseLeave={() => setSbHover(false)}
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-[260px] shrink-0 overflow-hidden border-r border-black/5 bg-white transition-[transform,width] duration-200 dark:border-white/5 dark:bg-[#0e0e11] lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
            mini ? 'lg:w-[76px]' : 'lg:w-[260px]',
            sidebarSticky ? 'lg:sticky lg:top-0 lg:h-screen' : 'lg:static lg:h-auto',
            sidebarChromeDark ? 'sidebar-dark dark' : 'sidebar-light',
          )}
          style={sidebarColor ? { backgroundColor: sidebarColor } : undefined}
        >
          <div className={cn('flex h-16 items-center justify-between', mini ? 'justify-center px-0 lg:justify-center' : 'px-4')}>
            <Link to="/" onClick={() => setOpen(false)} className={cn(mini && 'mx-auto')}><Logo compact={mini} text={advanceMode ? 'Advance FitPro' : company.logoText || 'FitPro'} logoImage={company.logoImage} /></Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
          </div>
          <div className={cn('px-3 pb-3', mini && 'hidden')}>
            <div className="sidebar-card rounded-xl border border-black/5 bg-zinc-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist">{t('signedIn')}</p>
              <p className="sidebar-user-name truncate text-sm font-semibold">{user.name}</p>
              <p className="text-[11px] text-lime">{roleName(user.role, roles)}</p>
            </div>
          </div>
          <nav className={cn('px-2 pb-8', sidebarSticky && 'h-[calc(100vh-180px)] overflow-y-auto')}>
            {/* Sticky search bar — opaque background (matching the sidebar) so
                scrolled menu items never show through behind the field. */}
            <div
              className={cn('sidebar-search-sticky sticky top-0 z-10 -mx-2 mb-1 border-b border-black/5 px-2 pb-1.5 pt-0.5 dark:border-white/5', mini && 'hidden')}
              style={{ backgroundColor: sidebarColor || (isDark ? '#0e0e11' : '#ffffff') }}
            >
              <SearchField value={menuQuery} onChange={setMenuQuery} placeholder={t('searchMenu')} />
            </div>

            {menuQuery.trim() ? (
              <div className="space-y-0.5">
                {menuResults.map((r) => {
                  const Icon = r.icon
                  return (
                    <NavLink
                      key={r.to}
                      to={r.to}
                      end
                      onClick={() => { setMenuQuery(''); setOpen(false) }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                        'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{t(r.key)}</span>
                      {r.parent && <span className="text-[10px] font-medium text-mist">{t(r.parent)}</span>}
                    </NavLink>
                  )
                })}
                {!menuResults.length && (
                  <p className="px-3 py-4 text-center text-xs text-mist">{t('searchNoResults')}</p>
                )}
              </div>
            ) : (
            <div className="space-y-0.5">
            {items.map((entry) => {
              if (entry.kind === 'group') {
                return (
                  <NavGroup
                    key={entry.key}
                    group={entry}
                    activePath={loc.pathname}
                    open={!!openGroups[entry.key]}
                    openGroups={openGroups}
                    onToggleGroup={(k) => setOpenGroups((s) => ({ ...s, [k]: !s[k] }))}
                    onNavigate={() => setOpen(false)}
                    mini={mini}
                  />
                )
              }
              const Icon = entry.icon
              const active = loc.pathname === entry.to || (entry.to !== '/admin' && entry.to !== '/coach' && entry.to !== '/app' && loc.pathname.startsWith(entry.to))
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/admin' || entry.to === '/coach' || entry.to === '/app'}
                  onClick={() => setOpen(false)}
                  title={mini ? t(entry.key) : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                    mini && 'justify-center px-0',
                    active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                <Icon className={cn('shrink-0', mini ? 'size-5' : 'size-4')} />
                  {!mini && t(entry.key)}
                </NavLink>
              )
            })}
            </div>
            )}
          </nav>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              'sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/10 bg-[#e7e7df] px-3 dark:border-white/10 dark:bg-[#050506] md:px-6',
              headerColor && (headerChromeDark ? 'dark' : 'chrome-light'),
            )}
            style={headerColor ? { backgroundColor: headerColor } : undefined}
          >
            <button className="grid size-9 place-items-center rounded-lg hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <button
              className="hidden size-9 place-items-center rounded-lg text-mist hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white lg:grid"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
            <div className="relative hidden min-w-0 flex-1 items-center md:flex">
              <SearchField value={q} onChange={setQ} placeholder={t('searchPlaceholder')} className="max-w-md" shortcut="/" inputRef={headerSearchRef} />
            </div>
            <div className="ml-auto flex items-center gap-1">
              {canManageTenants && (
                <button
                  onClick={() => { setProductMode(productMode === 'advance' ? 'fitpro' : 'advance') }}
                  className={cn(
                    'hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition sm:inline-flex',
                    advanceMode ? 'border-lime/40 text-lime' : 'border-line text-mist hover:text-zinc-900 dark:hover:text-white',
                  )}
                  title="Toggle product edition"
                >
                  {advanceMode ? 'Advance FitPro' : 'FitPro'}
                  <Badge tone={advanceMode ? 'lime' : 'zinc'}>{advanceMode ? 'Multi' : 'Classic'}</Badge>
                </button>
              )}
              {advanceMode && !isBranchScoped && companies.length > 0 && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => { setShowCompany((v) => !v); setShowBranch(false) }}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Building2 className="size-3.5 text-mist" />
                    <span className="max-w-[10rem] truncate">{activeCompany?.name || 'Company'}</span>
                    <ChevronDown className="size-3 text-mist" />
                  </button>
                  {showCompany && (
                    <div className="menu-pop absolute right-0 mt-2 w-64 rounded-2xl p-2">
                      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mist">Switch company</p>
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setActiveCompany(c.id); setShowCompany(false); setShowBranch(false) }}
                          className={cn(
                            'menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                            c.id === activeCompanyId && 'text-lime',
                          )}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: c.brandPrimary }} />
                          <span className="truncate">{c.name}</span>
                          {c.status === 'inactive' && <Badge tone="zinc" className="ml-auto">Inactive</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {advanceMode && (isBranchScoped || companyBranches.length > 1) && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => { setShowBranch((v) => !v); setShowCompany(false) }}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <MapPin className="size-3.5 text-mist" />
                    <span className="max-w-[10rem] truncate">{isBranchScoped ? (branches.find((b) => b.id === user?.branchId)?.name || 'Branch') : (activeBranch?.name || 'All branches')}</span>
                    {!isBranchScoped && <ChevronDown className="size-3 text-mist" />}
                  </button>
                  {showBranch && !isBranchScoped && (
                    <div className="menu-pop absolute right-0 mt-2 w-64 rounded-2xl p-2">
                      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mist">Switch branch</p>
                      {companyBranches.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => { setActiveBranch(b.id); setShowBranch(false) }}
                          className={cn(
                            'menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                            b.id === activeBranchId && 'text-lime',
                          )}
                        >
                          <MapPin className="size-3.5 text-mist" />
                          <span className="truncate">{b.name}</span>
                          <span className="ml-auto text-[10px] text-mist">{b.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <LanguageSwitcher compact />
              <button onClick={toggle} className="grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" aria-label="Theme">
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <div className="relative">
                <button onClick={() => { setShowNotif((v) => !v); setShowUser(false) }} className="relative grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ember" />}
                </button>
                {showNotif && (
                  <div className="menu-pop absolute right-0 mt-2 w-80 rounded-2xl p-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-mist">{t('inbox')}</p>
                      <button className="text-[11px] font-semibold text-lime" onClick={() => markAllNotifRead(user.id)}>{t('markAllRead')}</button>
                    </div>
                    {myNotifs.length === 0 && <p className="p-4 text-sm text-mist">{t('caughtUp')}</p>}
                    {myNotifs.map((n) => (
                      <div key={n.id} className={cn('rounded-xl px-3 py-2', !n.read && 'bg-lime/5')}>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="text-xs text-mist">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowUser((v) => !v); setShowNotif(false) }} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/5">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <ChevronDown className="hidden size-3 text-mist sm:block" />
                </button>
                {showUser && (
                  <div className="menu-pop absolute right-0 mt-2 w-64 rounded-2xl p-2">
                    <div className="px-2 py-2">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-mist">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUser(false)
                        nav(`${roleHome(user.role)}/profile`)
                      }}
                      className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold"
                    >
                      {t('editProfile')}
                    </button>
                    {hasRole('super_admin') && (
                      <div className="menu-pop-divider border-t p-2">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mist">{t('impersonate')}</p>
                        {users.filter((u) => u.id !== user.id).slice(0, 6).map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              impersonate(u.id)
                              setShowUser(false)
                              nav(roleHome(u.role))
                            }}
                            className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                          >
                            <Avatar src={u.avatar} name={u.name} size="sm" />
                            <span className="truncate">{u.name}</span>
                            <Badge tone="zinc" className="ml-auto">{roleName(u.role, roles)}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { setShowUser(false); setConfirmLogout(true) }}
                      className="menu-pop-item mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember"
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 px-3 py-6 md:px-6">
            {q && (
              <SearchResults q={q} onPick={() => setQ('')} />
            )}
            {pageLoading && company.preloaderEnabled !== false ? <Preloader /> : <Outlet />}
          </div>

          {/* Footer — mirrors the header chrome so it follows the light/dark
              theme and any custom header colour from Settings. */}
          <footer
            className={cn(
              'mt-auto border-t border-black/10 bg-[#e7e7df] px-4 py-3 dark:border-white/10 dark:bg-[#050506] md:px-6',
              headerColor && (headerChromeDark ? 'dark' : 'chrome-light'),
            )}
            style={headerColor ? { backgroundColor: headerColor } : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="font-bold">Copyright © {systemSettings.appName || `${company.name} App`} {new Date().getFullYear()}</span>{' '}
                <a
                  href={company.footerUrl || company.webAddress || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {company.footerBrand || company.name}.
                </a>{' '}
                <span className="text-mist">All rights reserved.</span>
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="font-bold">Version</span> <span className="text-mist">{systemSettings.appVersion || APP_VERSION}</span>
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Sign-out confirmation */}
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Confirmation" narrow>
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-9 shrink-0" />
          <p className="text-sm">Are you sure you want to logout?</p>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={() => setConfirmLogout(false)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-600/10"
          >
            No
          </button>
          <Button
            className="bg-blue-600 text-white ring-4 ring-blue-300/60 hover:bg-blue-700"
            onClick={() => { setConfirmLogout(false); logout(); nav('/') }}
          >
            Yes
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/** Live counts for menu badges (e.g. invoices needing collection). */
function useNavBadges(): Record<string, number> {
  const { invoices } = useApp()
  const today = new Date().toISOString().slice(0, 10)
  return {
    overdueInvoices: invoices.filter((i) => i.status === 'overdue' || (i.status === 'unpaid' && i.dueAt < today)).length,
  }
}

function NavGroup({
  group,
  activePath,
  open,
  openGroups,
  onToggleGroup,
  onNavigate,
  mini,
}: {
  group: Group
  activePath: string
  open: boolean
  openGroups: Record<string, boolean>
  onToggleGroup: (key: string) => void
  onNavigate: () => void
  mini?: boolean
}) {
  const { t } = useI18n()
  const badges = useNavBadges()
  const Icon = group.icon
  const match = (to: string) => activePath === to || activePath.startsWith(to + '/')
  const childActive = group.children.some((c) => ('heading' in c ? false : 'children' in c ? c.children.some((gc) => match(gc.to)) : match(c.to)))

  // Pick exactly one active child by the longest matching route, so a parent
  // route like `/admin/assets` doesn't also light up its nested sub-pages.
  // Also pick one active grandchild per sub-group using the same rule.
  let activeChildKey: string | null = null
  let bestLen = 0
  const activeGrandChildKey: Record<string, string> = {}
  for (const c of group.children) {
    if ('heading' in c) continue
    if ('children' in c) {
      let gcBestLen = 0
      let gcBestKey: string | null = null
      for (const gc of c.children) {
        if (match(gc.to)) {
          if (gc.to.length > bestLen) { activeChildKey = c.key; bestLen = gc.to.length }
          if (gc.to.length > gcBestLen) { gcBestKey = gc.key; gcBestLen = gc.to.length }
        }
      }
      if (gcBestKey) activeGrandChildKey[c.key] = gcBestKey
    } else if (match(c.to) && c.to.length > bestLen) {
      activeChildKey = c.key
      bestLen = c.to.length
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup(group.key)}
        aria-expanded={open}
        title={mini ? t(group.key) : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
          mini && 'justify-center px-0',
          childActive
            ? 'text-zinc-900 dark:text-white'
            : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
        )}
      >
        <Icon className={cn('shrink-0', mini ? 'size-5' : 'size-4')} />
        {!mini && <span className="flex-1 text-left">{t(group.key)}</span>}
        {!mini && <ChevronDown className={cn('size-3.5 text-mist transition-transform', open && 'rotate-180')} />}
      </button>
      {open && !mini && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-black/10 pl-2 dark:border-white/10">
          {group.children.map((c) => {
            if ('heading' in c) {
              return (
                <p key={c.heading} className="px-3 pb-0.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-mist first:pt-1">
                  {t(c.heading)}
                </p>
              )
            }
            if ('children' in c) {
              const SubIcon = c.icon
              const subOpen = !!openGroups[c.key]
              const subActive = activeChildKey === c.key
              return (
                <div key={c.key}>
                  <button
                    type="button"
                    onClick={() => onToggleGroup(c.key)}
                    aria-expanded={subOpen}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                      subActive
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                    )}
                  >
                    <SubIcon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{t(c.key)}</span>
                    <ChevronDown className={cn('size-3.5 text-mist transition-transform', subOpen && 'rotate-180')} />
                  </button>
                  {subOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-black/10 pl-2 dark:border-white/10">
                      {c.children.map((gc) => {
                        const GIcon = gc.icon
                        const active = activeGrandChildKey[c.key] === gc.key
                        return (
                          <NavLink
                            key={gc.to}
                            to={gc.to}
                            end
                            onClick={onNavigate}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                              active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                            )}
                          >
                            <GIcon className="size-4 shrink-0" />
                            {t(gc.key)}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            const CIcon = c.icon
            const active = activeChildKey === c.key
            return (
              <NavLink
                key={c.to}
                to={c.to}
                end
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                  active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                )}
              >
                <CIcon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{t(c.key)}</span>
                {c.badge && badges[c.badge] > 0 && (
                  <span className={cn(
                    'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    active ? 'bg-black/15 text-lime-ink' : 'bg-rose-500/15 text-rose-500',
                  )}>
                    {badges[c.badge]}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SearchResults({ q, onPick }: { q: string; onPick: () => void }) {
  const { members, users, classes, invoices } = useApp()
  const nav = useNavigate()
  const ql = q.toLowerCase()
  const ms = members.filter((m) => {
    const u = users.find((x) => x.id === m.userId)
    return u?.name.toLowerCase().includes(ql) || u?.email.toLowerCase().includes(ql)
  }).slice(0, 4)
  const cs = classes.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 3)
  const inv = invoices.filter((i) => i.number.toLowerCase().includes(ql)).slice(0, 3)
  if (!ms.length && !cs.length && !inv.length) return null
  return (
    <div className="card mb-4 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Results</p>
      {ms.map((m) => {
        const u = users.find((x) => x.id === m.userId)!
        return (
          <button key={m.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav(`/admin/members/${m.id}`); onPick() }}>
            <Users className="size-4 text-lime" /> {u.name}
          </button>
        )
      })}
      {cs.map((c) => (
        <button key={c.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav('/admin/classes'); onPick() }}>
          <CalendarDays className="size-4 text-lime" /> {c.name} · {c.startTime}
        </button>
      ))}
      {inv.map((i) => (
        <button key={i.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav('/admin/receive-payments?tab=all'); onPick() }}>
          <FileText className="size-4 text-lime" /> {i.number}
        </button>
      ))}
    </div>
  )
}
