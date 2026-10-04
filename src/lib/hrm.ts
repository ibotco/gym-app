import type { Department, Payslip, JobPosting, Candidate, PerformanceReview, CandidateStage, JobType, StaffAttendance } from '../types'

export const DEPARTMENTS_KEY = 'fitpro_departments'
export const PAYSLIPS_KEY = 'fitpro_payslips'
export const JOBS_KEY = 'fitpro_jobs'
export const CANDIDATES_KEY = 'fitpro_candidates'
export const REVIEWS_KEY = 'fitpro_reviews'

export const DEPARTMENTS: Department[] = [
  { id: 'dept_1', name: 'Front of House', headUserId: 'u_staff', description: 'Reception, membership concierge, and check-in.' },
  { id: 'dept_2', name: 'Operations', headUserId: 'u_manager', description: 'Club operations, logistics, and facilities.' },
  { id: 'dept_3', name: 'Coaching', headUserId: 'u_trainer', description: 'Personal training and group fitness.' },
  { id: 'dept_4', name: 'Sales & Marketing', description: 'Membership sales, leads, and brand.' },
]

export const PAYSLIPS: Payslip[] = [
  { id: 'ps_1', staffUserId: 'u_manager', period: '2026-07', basic: 9800, allowances: 500, deductions: 1200, net: 9100, status: 'paid', paidAt: '2026-07-25' },
  { id: 'ps_2', staffUserId: 'u_staff', period: '2026-07', basic: 4200, allowances: 200, deductions: 500, net: 3900, status: 'paid', paidAt: '2026-07-25' },
  { id: 'ps_3', staffUserId: 'u_trainer', period: '2026-07', basic: 7200, allowances: 300, deductions: 900, net: 6600, status: 'paid', paidAt: '2026-07-25' },
]

export const JOB_TYPES: { id: JobType; label: string }[] = [
  { id: 'full-time', label: 'Full-time' },
  { id: 'part-time', label: 'Part-time' },
  { id: 'contract', label: 'Contract' },
]

export const CANDIDATE_STAGES: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']

export const JOBS: JobPosting[] = [
  {
    id: 'job_1', title: 'Membership Concierge', department: 'Front of House', location: 'Airport City',
    type: 'full-time', salary: 'GHS 4,200 / month', status: 'open',
    description: 'Welcome members, handle check-ins, and support membership renewals.',
    postedAt: '2026-08-01',
  },
  {
    id: 'job_2', title: 'Group Fitness Instructor', department: 'Coaching', location: 'Osu Oxford',
    type: 'part-time', salary: 'GHS 160 / session', status: 'open',
    description: 'Lead HIIT and spin classes across the Osu studio.',
    postedAt: '2026-08-05',
  },
  {
    id: 'job_3', title: 'Marketing Executive', department: 'Sales & Marketing', location: 'Accra',
    type: 'full-time', salary: 'GHS 5,500 / month', status: 'closed',
    description: 'Drive membership growth across social and offline channels.',
    postedAt: '2026-07-10',
  },
]

export const CANDIDATES: Candidate[] = [
  { id: 'ca_1', name: 'Rita Appiah', email: 'rita.appiah@mail.com', phone: '+233 24 700 1001', jobId: 'job_1', stage: 'interview', notes: 'Strong reception experience.', appliedAt: '2026-08-03' },
  { id: 'ca_2', name: 'Michael Addo', email: 'm.addo@mail.com', phone: '+233 24 700 1002', jobId: 'job_1', stage: 'screening', appliedAt: '2026-08-06' },
  { id: 'ca_3', name: 'Sandra Ofori', email: 'sandrao@mail.com', phone: '+233 24 700 1003', jobId: 'job_2', stage: 'applied', notes: 'Certified spin instructor.', appliedAt: '2026-08-08' },
  { id: 'ca_4', name: 'Papa Nkrumah', email: 'papa.n@mail.com', phone: '+233 24 700 1004', jobId: 'job_3', stage: 'hired', appliedAt: '2026-07-15' },
]

export const REVIEWS: PerformanceReview[] = [
  { id: 'rv_1', staffUserId: 'u_staff', reviewerId: 'u_manager', period: '2026', rating: 4, strengths: 'Excellent member service.', improvements: 'Faster check-in during peak hours.', goals: 'Cross-train on membership sales.', status: 'completed', reviewedAt: '2026-07-30' },
  { id: 'rv_2', staffUserId: 'u_trainer', reviewerId: 'u_manager', period: '2026', rating: 5, strengths: 'Outstanding client retention.', goals: 'Launch a new small-group programme.', status: 'completed', reviewedAt: '2026-07-28' },
]

// ---- Loaders / savers ----

export function loadDepartments(): Department[] {
  try { const raw = localStorage.getItem(DEPARTMENTS_KEY); if (raw) return JSON.parse(raw) as Department[] } catch { /* ignore */ }
  return DEPARTMENTS
}
export function saveDepartments(list: Department[]) {
  try { localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadPayslips(): Payslip[] {
  try { const raw = localStorage.getItem(PAYSLIPS_KEY); if (raw) return JSON.parse(raw) as Payslip[] } catch { /* ignore */ }
  return PAYSLIPS
}
export function savePayslips(list: Payslip[]) {
  try { localStorage.setItem(PAYSLIPS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadJobs(): JobPosting[] {
  try { const raw = localStorage.getItem(JOBS_KEY); if (raw) return JSON.parse(raw) as JobPosting[] } catch { /* ignore */ }
  return JOBS
}
export function saveJobs(list: JobPosting[]) {
  try { localStorage.setItem(JOBS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadCandidates(): Candidate[] {
  try { const raw = localStorage.getItem(CANDIDATES_KEY); if (raw) return JSON.parse(raw) as Candidate[] } catch { /* ignore */ }
  return CANDIDATES
}
export function saveCandidates(list: Candidate[]) {
  try { localStorage.setItem(CANDIDATES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadReviews(): PerformanceReview[] {
  try { const raw = localStorage.getItem(REVIEWS_KEY); if (raw) return JSON.parse(raw) as PerformanceReview[] } catch { /* ignore */ }
  return REVIEWS
}
export function saveReviews(list: PerformanceReview[]) {
  try { localStorage.setItem(REVIEWS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const STAFF_ATTENDANCE_KEY = 'fitpro_staff_attendance'

export const STAFF_ATTENDANCE: StaffAttendance[] = [
  { id: 'sa_1', staffUserId: 'u_staff', date: '2026-08-17', checkIn: '08:00', checkOut: '17:00', status: 'present', branchId: 'br_airport' },
  { id: 'sa_2', staffUserId: 'u_staff2', date: '2026-08-17', checkIn: '08:12', checkOut: '17:04', status: 'late', branchId: 'br_osu', notes: 'Traffic on Oxford Street.' },
  { id: 'sa_3', staffUserId: 'u_manager', date: '2026-08-17', checkIn: '07:55', checkOut: '18:00', status: 'present', branchId: 'br_airport' },
  { id: 'sa_4', staffUserId: 'u_trainer', date: '2026-08-17', checkIn: '05:45', checkOut: '13:30', status: 'present', branchId: 'br_airport' },
  { id: 'sa_5', staffUserId: 'u_staff', date: '2026-08-18', status: 'leave', notes: 'Approved annual leave.' },
]

export function loadStaffAttendance(): StaffAttendance[] {
  try { const raw = localStorage.getItem(STAFF_ATTENDANCE_KEY); if (raw) return JSON.parse(raw) as StaffAttendance[] } catch { /* ignore */ }
  return STAFF_ATTENDANCE
}
export function saveStaffAttendance(list: StaffAttendance[]) {
  try { localStorage.setItem(STAFF_ATTENDANCE_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
