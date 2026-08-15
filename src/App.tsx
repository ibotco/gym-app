import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout } from './components/layout/PublicLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Protected } from './components/Protected'
import { ErrorBoundary } from './components/ErrorBoundary'

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
const Branches = lazy(() => import('./pages/admin/Branches').then((m) => ({ default: m.Branches })))
const Plans = lazy(() => import('./pages/admin/Plans').then((m) => ({ default: m.Plans })))
const ClassesAdmin = lazy(() => import('./pages/admin/Classes').then((m) => ({ default: m.ClassesAdmin })))
const Payments = lazy(() => import('./pages/admin/Payments').then((m) => ({ default: m.Payments })))
const Reports = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.Reports })))
const Leads = lazy(() => import('./pages/admin/Leads').then((m) => ({ default: m.Leads })))
const NotificationsAdmin = lazy(() => import('./pages/admin/Notifications').then((m) => ({ default: m.NotificationsAdmin })))
const CheckInDesk = lazy(() => import('./pages/admin/CheckIn').then((m) => ({ default: m.CheckInDesk })))
const Audit = lazy(() => import('./pages/admin/Audit').then((m) => ({ default: m.Audit })))
const Settings = lazy(() => import('./pages/admin/Settings').then((m) => ({ default: m.Settings })))
const Integrations = lazy(() => import('./pages/admin/Integrations').then((m) => ({ default: m.Integrations })))
const UsersAdmin = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.UsersAdmin })))
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
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
const PaystackReturn = lazy(() => import('./pages/pay/PaystackReturn').then((m) => ({ default: m.PaystackReturn })))

const ops: Array<'super_admin' | 'gym_manager' | 'staff'> = ['super_admin', 'gym_manager', 'staff']
const mgr: Array<'super_admin' | 'gym_manager'> = ['super_admin', 'gym_manager']

function Fallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime border-t-transparent" />
    </div>
  )
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

          <Route
            path="/admin"
            element={
              <Protected roles={ops}>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<Protected roles={mgr}><UsersAdmin /></Protected>} />
            <Route path="profile" element={<AccountProfile />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:id" element={<MemberDetail />} />
            <Route path="staff" element={<Protected roles={mgr}><StaffPage /></Protected>} />
            <Route path="staff/:id" element={<Protected roles={mgr}><StaffDetail /></Protected>} />
            <Route path="branches" element={<Protected roles={mgr}><Branches /></Protected>} />
            <Route path="plans" element={<Protected roles={mgr}><Plans /></Protected>} />
            <Route path="classes" element={<ClassesAdmin />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Protected roles={mgr}><Reports /></Protected>} />
            <Route path="leads" element={<Leads />} />
            <Route path="notifications" element={<Protected roles={mgr}><NotificationsAdmin /></Protected>} />
            <Route path="checkin" element={<CheckInDesk />} />
            <Route path="audit" element={<Protected roles={['super_admin']}><Audit /></Protected>} />
            <Route path="settings" element={<Protected roles={mgr}><Settings /></Protected>} />
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
