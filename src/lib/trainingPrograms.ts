// Training Programs data layer — seeded, deterministic, localStorage-backed.
import type { TrainingProgram, TrainingSession } from '../types'

export const TRAINING_PROGRAMS_KEY = 'fitpro_training_programs_v1'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => iso(new Date())

export const addDays = (base: string, days: number) => {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

/** Weekly sessions from a start date; first `held` are marked held. */
export function weeklySessions(
  prefix: string,
  start: string,
  weeks: number,
  topics: string[],
  held: number,
  attendees: number[],
): TrainingSession[] {
  const out: TrainingSession[] = []
  for (let i = 0; i < weeks; i++) {
    out.push({
      id: `${prefix}_s${i + 1}`,
      date: addDays(start, i * 7),
      topic: topics[i % topics.length],
      held: i < held,
      attendees: i < held ? (attendees[i] ?? 0) : 0,
    })
  }
  return out
}

export interface ProgramStats {
  totalSessions: number
  heldSessions: number
  enrolled: number
  attendancePct: number
  avgRating: number
  ratingsCount: number
  progressPct: number
}

export function programStats(p: TrainingProgram): ProgramStats {
  const totalSessions = p.sessions.length
  const held = p.sessions.filter((s) => s.held)
  const enrolled = p.enrollments.length
  const attendeeSum = held.reduce((s, x) => s + x.attendees, 0)
  const attendancePct = held.length && enrolled ? Math.round((attendeeSum / (held.length * enrolled)) * 100) : 0
  const rated = p.enrollments.filter((e) => typeof e.rating === 'number')
  const avgRating = rated.length
    ? Math.round((rated.reduce((s, e) => s + (e.rating || 0), 0) / rated.length) * 10) / 10
    : 0
  return {
    totalSessions,
    heldSessions: held.length,
    enrolled,
    attendancePct,
    avgRating,
    ratingsCount: rated.length,
    progressPct: totalSessions ? Math.round((held.length / totalSessions) * 100) : 0,
  }
}

export const nextSession = (p: TrainingProgram) => p.sessions.find((s) => !s.held) || null

export const STATUS_META: Record<TrainingProgram['status'], { label: string; tone: 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' }> = {
  draft: { label: 'Draft', tone: 'zinc' },
  scheduled: { label: 'Scheduled', tone: 'sky' },
  in_progress: { label: 'In progress', tone: 'lime' },
  completed: { label: 'Completed', tone: 'violet' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
}

export const TYPE_LABEL: Record<TrainingProgram['type'], string> = {
  internal: 'Internal',
  external: 'External',
  online: 'Online',
}

const T = todayIso()

export const SEED_TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: 'tp_1', code: 'TRN-001', title: 'Customer Service Excellence', type: 'internal',
    trainerStaffUserId: 'u_manager', department: 'Front of House', location: 'Airport Room 2',
    startDate: addDays(T, -130), endDate: addDays(T, -74), capacity: 8, budget: 6000, spent: 5400,
    status: 'completed',
    objectives: 'Raise member satisfaction scores; consistent greeting, complaint handling and follow-up standards.',
    sessions: weeklySessions('tp_1', addDays(T, -130), 8, ['Service mindset', 'Handling complaints', 'Member journeys', 'Difficult conversations', 'Recovery & follow-up', 'Role play & review'], 8, [6, 6, 5, 6, 6, 5, 6, 6]),
    enrollments: [
      { staffUserId: 'u_staff', attended: 8, rating: 5, comment: 'Excellent delivery — the complaint-handling role plays changed how I work at the desk.', feedbackDate: addDays(T, -70) },
      { staffUserId: 'u_staff2', attended: 7, rating: 4, comment: 'Very useful, though I would have liked more time on recovery calls.', feedbackDate: addDays(T, -71) },
      { staffUserId: 'u_trainer4', attended: 8, rating: 5 },
      { staffUserId: 'u_trainer2', attended: 6, rating: 4 },
      { staffUserId: 'u_accountant', attended: 7, rating: 4 },
      { staffUserId: 'u_trainer3', attended: 8, rating: 5, comment: 'Best internal training so far — practical and fast-paced.', feedbackDate: addDays(T, -72) },
    ],
    createdAt: addDays(T, -150),
  },
  {
    id: 'tp_2', code: 'TRN-002', title: 'Strength Coaching Certification — Level 2', type: 'internal',
    trainerStaffUserId: 'u_trainer', department: 'Coaching', location: 'Strength Hall',
    startDate: addDays(T, -21), endDate: addDays(T, 35), capacity: 6, budget: 9500, spent: 3200,
    status: 'in_progress',
    objectives: 'Progression programming, barbell coaching cues and spotting standards for all coaching staff.',
    sessions: weeklySessions('tp_2', addDays(T, -21), 9, ['Assessment & screening', 'Squat mechanics', 'Hinge & deadlift', 'Pressing & pulling', 'Programming blocks', 'Coaching practice'], 3, [4, 4, 3]),
    enrollments: [
      { staffUserId: 'u_trainer2', attended: 3 },
      { staffUserId: 'u_trainer3', attended: 2 },
      { staffUserId: 'u_trainer4', attended: 3 },
      { staffUserId: 'u_trainer', attended: 3 },
    ],
    createdAt: addDays(T, -40),
  },
  {
    id: 'tp_3', code: 'TRN-003', title: 'First Aid & CPR Certification', type: 'external',
    externalTrainer: 'LifeCare Training Ghana', department: 'All departments', location: 'Osu Studio 1',
    startDate: addDays(T, 14), endDate: addDays(T, 42), capacity: 12, budget: 12000, spent: 2400,
    status: 'scheduled',
    objectives: 'Certify all floor staff in first aid and CPR; statutory compliance for gym operations.',
    sessions: weeklySessions('tp_3', addDays(T, 14), 5, ['CPR basics', 'AED use', 'Bleeding & fractures', 'Emergency response', 'Assessment'], 0, []),
    enrollments: [
      { staffUserId: 'u_staff', attended: 0 },
      { staffUserId: 'u_staff2', attended: 0 },
      { staffUserId: 'u_trainer', attended: 0 },
      { staffUserId: 'u_trainer2', attended: 0 },
      { staffUserId: 'u_trainer3', attended: 0 },
      { staffUserId: 'u_trainer4', attended: 0 },
      { staffUserId: 'u_manager', attended: 0 },
    ],
    createdAt: addDays(T, -18),
  },
  {
    id: 'tp_4', code: 'TRN-004', title: 'POS & Payments Refresher', type: 'online',
    trainerStaffUserId: 'u_staff2', department: 'Front of House', location: 'Online (Teams)',
    startDate: addDays(T, 7), endDate: addDays(T, 21), capacity: 10, budget: 1500, spent: 0,
    status: 'scheduled',
    objectives: 'New POS flows, refunds, mobile money reconciliation and end-of-day cash-up.',
    sessions: weeklySessions('tp_4', addDays(T, 7), 3, ['POS basics & sales', 'Refunds & disputes', 'Cash-up & reconciliation'], 0, []),
    enrollments: [
      { staffUserId: 'u_staff', attended: 0 },
      { staffUserId: 'u_staff2', attended: 0 },
      { staffUserId: 'u_accountant', attended: 0 },
    ],
    createdAt: addDays(T, -10),
  },
  {
    id: 'tp_5', code: 'TRN-005', title: 'Workplace Health & Safety', type: 'internal',
    trainerStaffUserId: 'u_manager', department: 'All departments', location: 'Airport Boardroom',
    startDate: addDays(T, -210), endDate: addDays(T, -168), capacity: 14, budget: 4000, spent: 3900,
    status: 'completed',
    objectives: 'Hazard reporting, equipment lock-out, fire safety and incident documentation.',
    sessions: weeklySessions('tp_5', addDays(T, -210), 6, ['Hazard spotting', 'Fire safety', 'Equipment safety', 'Incident reporting', 'Manual handling', 'Review'], 6, [7, 7, 6, 7, 7, 7]),
    enrollments: [
      { staffUserId: 'u_staff', attended: 6, rating: 4 },
      { staffUserId: 'u_staff2', attended: 6, rating: 4 },
      { staffUserId: 'u_manager', attended: 6, rating: 5, comment: 'Clear, compliant and well organised.', feedbackDate: addDays(T, -161) },
      { staffUserId: 'u_trainer', attended: 5, rating: 4 },
      { staffUserId: 'u_trainer2', attended: 6, rating: 3, comment: 'Content was good but the room was too small for the group.', feedbackDate: addDays(T, -160) },
      { staffUserId: 'u_trainer3', attended: 6, rating: 4 },
      { staffUserId: 'u_trainer4', attended: 6, rating: 4 },
    ],
    createdAt: addDays(T, -230),
  },
  {
    id: 'tp_6', code: 'TRN-006', title: 'Member Onboarding & Experience', type: 'internal',
    trainerStaffUserId: 'u_staff2', department: 'Front of House', location: 'Osu Meeting Room',
    startDate: addDays(T, -7), endDate: addDays(T, 28), capacity: 8, budget: 3000, spent: 600,
    status: 'in_progress',
    objectives: '7-day onboarding journey for new members; induction bookings and 30-day check-ins.',
    sessions: weeklySessions('tp_6', addDays(T, -7), 6, ['Onboarding journey', 'Induction standards', 'Check-in calls', 'Retention flags', 'Practice week', 'Review'], 1, [5]),
    enrollments: [
      { staffUserId: 'u_staff', attended: 1 },
      { staffUserId: 'u_staff2', attended: 1 },
      { staffUserId: 'u_trainer4', attended: 1 },
      { staffUserId: 'u_trainer2', attended: 0 },
      { staffUserId: 'u_trainer3', attended: 1 },
    ],
    createdAt: addDays(T, -20),
  },
  {
    id: 'tp_7', code: 'TRN-007', title: 'Data-Driven Coaching with Wearables', type: 'online',
    externalTrainer: 'CoachMetrics Academy', department: 'Coaching', location: 'Online (Zoom)',
    startDate: addDays(T, 45), endDate: addDays(T, 73), capacity: 6, budget: 7800, spent: 0,
    status: 'draft',
    objectives: 'Interpret HRV, load and recovery data; adjust programming with objective metrics.',
    sessions: weeklySessions('tp_7', addDays(T, 45), 5, ['Metrics that matter', 'HRV & recovery', 'Load management', 'Case studies', 'Certification exam'], 0, []),
    enrollments: [
      { staffUserId: 'u_trainer', attended: 0 },
      { staffUserId: 'u_trainer3', attended: 0 },
    ],
    createdAt: addDays(T, -5),
  },
  {
    id: 'tp_8', code: 'TRN-008', title: 'Leadership Essentials for Supervisors', type: 'external',
    externalTrainer: 'Akosua Mensah & Co.', department: 'Operations', location: 'Airport Boardroom',
    startDate: addDays(T, -30), endDate: addDays(T, -9), capacity: 5, budget: 8500, spent: 850,
    status: 'cancelled',
    objectives: 'Delegation, feedback and shift-leadership skills for supervisors. Cancelled — provider rescheduling.',
    sessions: weeklySessions('tp_8', addDays(T, -30), 4, ['Delegation', 'Feedback', 'Conflict', 'Leading shifts'], 0, []),
    enrollments: [
      { staffUserId: 'u_manager', attended: 0 },
      { staffUserId: 'u_staff2', attended: 0 },
    ],
    createdAt: addDays(T, -55),
  },
  {
    id: 'tp_9', code: 'TRN-009', title: 'Hygiene & Cleaning Standards', type: 'internal',
    trainerStaffUserId: 'u_staff2', department: 'Operations', location: 'Legon Studio',
    startDate: addDays(T, -95), endDate: addDays(T, -60), capacity: 10, budget: 2200, spent: 2050,
    status: 'completed',
    objectives: 'Cleaning rota, sanitising stations, studio turnover standards and audit checklist.',
    sessions: weeklySessions('tp_9', addDays(T, -95), 5, ['Standards & rota', 'Chemicals & safety', 'Studio turnover', 'Audit checklist', 'Sign-off'], 5, [6, 6, 6, 5, 6]),
    enrollments: [
      { staffUserId: 'u_staff', attended: 5, rating: 4 },
      { staffUserId: 'u_trainer4', attended: 5, rating: 4 },
      { staffUserId: 'u_trainer2', attended: 4, rating: 3, comment: 'Would like more hands-on time with the new cleaning chemicals.', feedbackDate: addDays(T, -56) },
      { staffUserId: 'u_trainer3', attended: 5, rating: 4 },
      { staffUserId: 'u_staff2', attended: 5, rating: 5, comment: 'The audit checklist is now part of our daily close-down routine.', feedbackDate: addDays(T, -55) },
      { staffUserId: 'u_manager', attended: 5, rating: 4 },
    ],
    createdAt: addDays(T, -110),
  },
  {
    id: 'tp_10', code: 'TRN-010', title: 'Sales & Membership Growth', type: 'internal',
    trainerStaffUserId: 'u_manager', department: 'Front of House', location: 'Tema Office',
    startDate: addDays(T, 21), endDate: addDays(T, 56), capacity: 8, budget: 5200, spent: 0,
    status: 'scheduled',
    objectives: 'Tour-to-close conversion, referral asks and corporate partnership basics.',
    sessions: weeklySessions('tp_10', addDays(T, 21), 6, ['Tour & discovery', 'Objections', 'Closing & signup', 'Referrals', 'Corporate leads', 'Role play'], 0, []),
    enrollments: [
      { staffUserId: 'u_staff', attended: 0 },
      { staffUserId: 'u_staff2', attended: 0 },
      { staffUserId: 'u_trainer4', attended: 0 },
    ],
    createdAt: addDays(T, -3),
  },
]

export function loadTrainingPrograms(): TrainingProgram[] {
  try {
    const raw = localStorage.getItem(TRAINING_PROGRAMS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as TrainingProgram[]
      if (Array.isArray(arr)) return arr
    }
  } catch { /* fall through */ }
  return SEED_TRAINING_PROGRAMS
}

export function saveTrainingPrograms(list: TrainingProgram[]) {
  try { localStorage.setItem(TRAINING_PROGRAMS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const ghs = (n: number) => `GHS ${n.toLocaleString()}`

// ---------------------------------------------------------------------------
// Feedback aggregation (HRM -> Training -> Training Feedback)
// ---------------------------------------------------------------------------
export interface FeedbackEntry {
  programId: string
  programCode: string
  programTitle: string
  programStatus: TrainingProgram['status']
  staffUserId: string
  rating: number
  comment?: string
  date?: string
}

export function feedbackEntries(programs: TrainingProgram[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  for (const p of programs) {
    for (const e of p.enrollments) {
      if (typeof e.rating === 'number') {
        out.push({
          programId: p.id, programCode: p.code, programTitle: p.title, programStatus: p.status,
          staffUserId: e.staffUserId, rating: e.rating, comment: e.comment,
          date: e.feedbackDate || p.endDate,
        })
      }
    }
  }
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

/** Counts indexed 0..4 for 1..5 stars. */
export const ratingDistribution = (entries: FeedbackEntry[]) => {
  const dist = [0, 0, 0, 0, 0]
  for (const e of entries) dist[Math.min(5, Math.max(1, Math.round(e.rating))) - 1] += 1
  return dist
}

export const averageRating = (entries: FeedbackEntry[]) =>
  entries.length ? Math.round((entries.reduce((s, e) => s + e.rating, 0) / entries.length) * 10) / 10 : 0
